import { getActivityPubConfig } from '@/plugins/activitypub/config';
import { federationService, getActivityPubService } from '@/plugins/activitypub/service';
import { Article, Create } from "@fedify/fedify";
import { db, eq, objects, activities, followers } from "astro:db";
import { v4 as uuidv4 } from "uuid";

// Hook to publish blog posts to ActivityPub
export async function publishToActivityPub(post: {
  title: string;
  content: string;
  slug: string;
  excerpt?: string;
}) {
  try {
    const config = getActivityPubConfig();
    if (!config.federation.enabled) {
      console.log('ActivityPub federation is disabled');
      return;
    }

    const username = config.actor.preferredUsername;
    const postUrl = new URL(`/blog/${post.slug}`, config.baseUrl);
    const objectId = new URL(`/ap/objects/${post.slug}`, config.baseUrl);
    
    // Create a summary for ActivityPub (use excerpt or truncated content)
    const summary = post.excerpt || (post.content.length > 500 
      ? post.content.substring(0, 500) + '...' 
      : post.content);

    // Context is required to send activities. We can build it using federation.createContext
    // We pass a dummy request just to satisfy the context requirement
    const dummyReq = new Request(config.baseUrl);
    const ctx = federationService.createContext(dummyReq, undefined);

    const article = new Article({
      id: objectId,
      name: post.title,
      summary: summary,
      content: post.content,
      url: postUrl,
      attribution: ctx.getActorUri(username),
      published: new Date(),
    });

    const createActivity = new Create({
      id: new URL(`/ap/activities/${uuidv4()}`, config.baseUrl),
      actor: ctx.getActorUri(username),
      object: article,
      published: new Date(),
      tos: [new URL("https://www.w3.org/ns/activitystreams#Public")],
    });

    // Store locally in DB
    const objData = await article.toJsonLd();
    await db.insert(objects).values({
      id: article.id?.href || uuidv4(),
      type: "Article",
      attributed_to: article.attributionId?.href,
      name: post.title,
      content: post.content,
      url: postUrl.href,
      published: article.published || new Date(),
      raw: JSON.stringify(objData),
    });

    const actData = await createActivity.toJsonLd();
    await db.insert(activities).values({
      id: createActivity.id?.href || uuidv4(),
      type: "Create",
      actor: createActivity.actorId?.href || "",
      object: article.id?.href,
      published: createActivity.published || new Date(),
      raw: JSON.stringify(actData),
    });

    // Fetch followers from database
    const followersList = await db
      .select()
      .from(followers)
      .where(eq(followers.actor_id, ctx.getActorUri(username).href));

    // Send to followers using Fedify
    for (const follower of followersList) {
      if (follower.follower_actor_id) {
        await ctx.sendActivity(
          { username },
          new URL(follower.follower_actor_id),
          createActivity
        );
      }
    }

    console.log(`Published post "${post.title}" to ActivityPub`);
  } catch (error) {
    console.error('Error publishing to ActivityPub:', error);
  }
}

// Initialize ActivityPub on server start
export async function initializeActivityPub() {
  try {
    const service = getActivityPubService();
    await service.initializeActor();
    console.log('ActivityPub initialized successfully');
  } catch (error) {
    console.error('Error initializing ActivityPub:', error);
  }
}