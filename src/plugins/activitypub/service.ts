import {
  createFederation,
  InProcessMessageQueue,
  Person,
  Endpoints,
  Follow,
  Accept,
  Undo,
  Create,
  Like,
  Announce,
} from "@fedify/fedify";
import { AstroDbKvStore } from "./kv.ts";
import { getActivityPubConfig } from "./config.ts";
import { db, eq, and, actors, followers, objects, activities } from "astro:db";
import crypto from "node:crypto";
import { v4 as uuidv4 } from "uuid";

export const federationService = createFederation<void>({
  kv: new AstroDbKvStore(),
  queue: new InProcessMessageQueue(),
});

// Helper to convert PEM to CryptoKey
async function pemToCryptoKey(pem: string, type: "public" | "private"): Promise<CryptoKey> {
  const pemHeader = `-----BEGIN ${type === "public" ? "PUBLIC" : "PRIVATE"} KEY-----`;
  const pemFooter = `-----END ${type === "public" ? "PUBLIC" : "PRIVATE"} KEY-----`;
  const pemContents = pem.substring(
    pem.indexOf(pemHeader) + pemHeader.length,
    pem.indexOf(pemFooter)
  ).replace(/\s+/g, "");

  const binaryDer = Buffer.from(pemContents, "base64");

  return await crypto.webcrypto.subtle.importKey(
    type === "public" ? "spki" : "pkcs8",
    binaryDer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    true,
    type === "public" ? ["verify"] : ["sign"]
  );
}

// Helper to generate key pair if none exist
async function generateKeyPair() {
  return await crypto.webcrypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"]
  );
}

async function exportPem(key: CryptoKey, type: "public" | "private"): Promise<string> {
  const exported = await crypto.webcrypto.subtle.exportKey(type === "public" ? "spki" : "pkcs8", key);
  const exportedAsString = Buffer.from(exported).toString("base64");
  let pem = `-----BEGIN ${type === "public" ? "PUBLIC" : "PRIVATE"} KEY-----\n`;
  for (let i = 0; i < exportedAsString.length; i += 64) {
    pem += exportedAsString.substring(i, i + 64) + "\n";
  }
  pem += `-----END ${type === "public" ? "PUBLIC" : "PRIVATE"} KEY-----\n`;
  return pem;
}

// Configure Actor Dispatcher
// This handles requests to /ap/users/[username] and WebFinger queries
federationService.setActorDispatcher("/ap/users/{identifier}", async (ctx, username) => {
  const config = getActivityPubConfig();
  if (!config.enabled) return null;

  // We only support the configured preferredUsername (usually 'ap' or from site config)
  if (username !== config.actor.preferredUsername) {
    return null;
  }

  const actorsList = await db
    .select()
    .from(actors)
    .where(eq(actors.preferred_username, username))
    .limit(1);

  let actorDb = actorsList[0];

  if (!actorDb) {
    // Auto-initialize actor if missing
    let { publicKey, privateKey } = config.keypair || {};
    if (!publicKey || !privateKey) {
      const keys = await generateKeyPair();
      publicKey = await exportPem(keys.publicKey, "public");
      privateKey = await exportPem(keys.privateKey, "private");
      console.warn("Generated new key pair. Please save these keys to your environment variables:");
      console.warn("ACTIVITYPUB_PUBLIC_KEY:", publicKey.replace(/\n/g, "\\n"));
      console.warn("ACTIVITYPUB_PRIVATE_KEY:", privateKey.replace(/\n/g, "\\n"));
    }

    const actorIdUrl = new URL(`/ap/users/${username}`, config.baseUrl).href;

    await db.insert(actors).values({
      id: actorIdUrl,
      type: "Person",
      preferred_username: username,
      name: config.actor.name,
      summary: config.actor.summary,
      inbox: `${actorIdUrl}/inbox`,
      outbox: `${actorIdUrl}/outbox`,
      followers: `${actorIdUrl}/followers`,
      following: `${actorIdUrl}/following`,
      public_key: publicKey,
      private_key: privateKey,
      icon: config.actor.icon,
      image: config.actor.image,
      created_at: new Date(),
      updated_at: new Date(),
    });

    actorDb = (await db
      .select()
      .from(actors)
      .where(eq(actors.preferred_username, username))
      .limit(1))[0];
  }

  // Map our DB representation to a Fedify Person object
  return new Person({
    id: ctx.getActorUri(username),
    preferredUsername: actorDb.preferred_username,
    name: actorDb.name || undefined,
    summary: actorDb.summary || undefined,
    inbox: ctx.getInboxUri(username),
    outbox: ctx.getOutboxUri(username),
    followers: ctx.getFollowersUri(username),
    endpoints: new Endpoints({
      sharedInbox: new URL("/ap/inbox", config.baseUrl),
    }),
    // Public keys are automatically appended by Fedify based on setKeyPairsDispatcher
    // Icon and Image could be set here using the built-in Fedify classes if needed
  });
}).setKeyPairsDispatcher(async (ctx, username) => {
  const actorsList = await db
    .select()
    .from(actors)
    .where(eq(actors.preferred_username, username))
    .limit(1);

  if (actorsList.length === 0) return [];
  const actor = actorsList[0];

  const config = getActivityPubConfig();
  // Environment variables override DB
  const pubPem = config.keypair?.publicKey || actor.public_key;
  const privPem = config.keypair?.privateKey || actor.private_key;

  if (!pubPem || !privPem) return [];

  const publicKey = await pemToCryptoKey(pubPem, "public");
  const privateKey = await pemToCryptoKey(privPem, "private");

  return [{ privateKey, publicKey }];
});


// Configure Inbox listeners
const inbox = federationService.setInboxListeners("/ap/users/{identifier}/inbox", "/ap/inbox");

// 1. Follow Activity
inbox.on(Follow, async (ctx, follow) => {
  const parsed = ctx.getActorUri(follow.objectId?.href || "");
  if (!parsed) return;
  const targetUsername = parsed.pathname.split("/").pop(); // Simplistic extraction
  if (!targetUsername) return;

  const followerActorId = follow.actorId?.href;
  const targetActorId = follow.objectId?.href;

  if (!followerActorId || !targetActorId) return;

  // Insert follower
  const existing = await db
    .select()
    .from(followers)
    .where(
      and(
        eq(followers.follower_actor_id, followerActorId),
        eq(followers.actor_id, targetActorId)
      )
    )
    .limit(1);

  if (!existing || existing.length === 0) {
    await db.insert(followers).values({
      id: uuidv4(),
      actor_id: targetActorId,
      follower_actor_id: followerActorId,
      accepted: true,
      created_at: new Date(),
    });
  } else if (!existing[0].accepted) {
    await db
      .update(followers)
      .set({ accepted: true })
      .where(
        and(
          eq(followers.follower_actor_id, followerActorId),
          eq(followers.actor_id, targetActorId)
        )
      );
  }

  // Send Accept activity
  const config = getActivityPubConfig();
  if (config.federation.enabled && follow.actorId) {
    await ctx.sendActivity(
      { username: targetUsername },
      follow.actorId,
      new Accept({
        actor: ctx.getActorUri(targetUsername),
        object: follow,
      })
    );
  }
});

// 2. Undo Activity (e.g. Unfollow)
inbox.on(Undo, async (ctx, undo) => {
  const object = await undo.getObject();
  if (object instanceof Follow) {
    const followerActorId = undo.actorId?.href;
    const targetActorId = object.objectId?.href;

    if (followerActorId && targetActorId) {
      await db
        .delete(followers)
        .where(
          and(
            eq(followers.follower_actor_id, followerActorId),
            eq(followers.actor_id, targetActorId)
          )
        );
    }
  }
});

// 3. Create Activity (Reply)
inbox.on(Create, async (ctx, create) => {
  const object = await create.getObject();
  if (object) {
      // Check if it's a reply to one of our posts
      const inReplyTo = object.replyToId?.href;
      
      const objData = await object.toJsonLd();
      await db.insert(objects).values({
          id: object.id?.href || uuidv4(),
          type: object.constructor.name,
          attributed_to: object.attributionId?.href,
          name: typeof (object as any).name === "string" ? (object as any).name : undefined,
          content: typeof (object as any).content === "string" ? (object as any).content : undefined,
          url: object.url?.href,
          published: object.published || new Date(),
          in_reply_to: inReplyTo,
          raw: JSON.stringify(objData),
      });
  }
  
  const actData = await create.toJsonLd();
  await db.insert(activities).values({
      id: create.id?.href || uuidv4(),
      type: "Create",
      actor: create.actorId?.href || "",
      object: object?.replyToId?.href || object?.id?.href, // Track which object this activity relates to
      published: create.published || new Date(),
      raw: JSON.stringify(actData),
  });
});

// 4. Like Activity
inbox.on(Like, async (ctx, like) => {
  const object = await like.getObject();
  if (object) {
      const actData = await like.toJsonLd();
      await db.insert(activities).values({
          id: like.id?.href || uuidv4(),
          type: "Like",
          actor: like.actorId?.href || "",
          object: object?.id?.href,
          published: like.published || new Date(),
          raw: JSON.stringify(actData),
      });
  }
});

// 5. Announce Activity (Repost)
inbox.on(Announce, async (ctx, announce) => {
  const object = await announce.getObject();
  if (object) {
      const actData = await announce.toJsonLd();
      await db.insert(activities).values({
          id: announce.id?.href || uuidv4(),
          type: "Announce",
          actor: announce.actorId?.href || "",
          object: object?.id?.href,
          published: announce.published || new Date(),
          raw: JSON.stringify(actData),
      });
  }
});



export async function getRepliesAndLikes(postUrl: string) {
  const activitiesList = await db
      .select()
      .from(activities)
      .where(eq(activities.object, postUrl));
  
  const replies = [];
  const likes = [];
  const reposts = [];
  
  for (const act of activitiesList) {
      if (act.type === "Create") {
          replies.push(JSON.parse(act.raw));
      } else if (act.type === "Like") {
          likes.push(JSON.parse(act.raw));
      } else if (act.type === "Announce") {
          reposts.push(JSON.parse(act.raw));
      }
  }
  
  return { replies, likes, reposts };
}

export class ActivityPubService {
    async initializeActor() {
        // Now handled inside the actor dispatcher automatically.
        // Keeping this for compatibility with integration.ts
        const config = getActivityPubConfig();
        if (!config.enabled) return;
        
        const username = config.actor.preferredUsername;
        const actorsList = await db
            .select()
            .from(actors)
            .where(eq(actors.preferred_username, username))
            .limit(1);
        
        if(actorsList.length === 0) {
            // Trigger dispatcher manually to initialize
            const req = new Request(new URL(`/ap/users/${username}`, config.baseUrl).href, {
                headers: { Accept: "application/activity+json"}
            });
            await federationService.fetch(req, {contextData: undefined});
        }
    }
}

let activityPubService: ActivityPubService;
export function getActivityPubService(): ActivityPubService {
    if (!activityPubService) {
        activityPubService = new ActivityPubService();
    }
    return activityPubService;
}