import { eq, and } from 'drizzle-orm';
import { getDatabase, schema } from '@/plugins/activitypub/db/config.ts';
import { generateKeyPair, createHttpSignature } from './crypto.ts';
import { 
  createActor, 
  createCreateActivity, 
  createFollowActivity, 
  createAcceptActivity,
  generateActivityId,
  generateActorUrl,
  createActivityPubResponse 
} from './utils.ts';
import { getActivityPubConfig } from './config.ts';
import { v4 as uuidv4 } from 'uuid';

export class ActivityPubService {
  private db: any;
  private config: any;

  constructor() {
    this.db = getDatabase();
    this.config = getActivityPubConfig();
  }

  // Initialize the main actor if it doesn't exist
  async initializeActor(): Promise<void> {
    // If ActivityPub is disabled via config, don't initialize actor
    if (!this.config.enabled) {
      console.warn('ActivityPub is disabled; skipping actor initialization.');
      return;
    }

    const { preferredUsername, name, summary, icon, image } = this.config.actor;
    const actorUrl = generateActorUrl(preferredUsername);

    // Check if actor already exists
    const existingActor = await this.db
      .select()
      .from(schema.actors)
      .where(eq(schema.actors.id, actorUrl))
      .limit(1);

    if (existingActor.length === 0) {
      // Generate key pair if not provided
      let { publicKey, privateKey } = this.config.keypair;
      if (!publicKey || !privateKey) {
        const keyPair = generateKeyPair();
        publicKey = keyPair.publicKey;
        privateKey = keyPair.privateKey;
        console.warn('Generated new key pair. Please save these keys to your environment variables:');
        console.warn('ACTIVITYPUB_PUBLIC_KEY:', publicKey.replace(/\n/g, '\\n'));
        console.warn('ACTIVITYPUB_PRIVATE_KEY:', privateKey.replace(/\n/g, '\\n'));
      }

      // Create actor
      await this.db.insert(schema.actors).values({
        id: actorUrl,
        type: 'Person',
        preferredUsername,
        name,
        summary,
        inbox: `${actorUrl}/inbox`,
        outbox: `${actorUrl}/outbox`,
        followers: `${actorUrl}/followers`,
        following: `${actorUrl}/following`,
        publicKey,
        privateKey,
        icon,
        image,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // Get actor by username
  async getActor(username: string): Promise<any> {
    const actorUrl = generateActorUrl(username);
    const actors = await this.db
      .select()
      .from(schema.actors)
      .where(eq(schema.actors.id, actorUrl))
      .limit(1);

    if (actors.length === 0) return null;

    const actor = actors[0];
    return createActor(
      actor.preferredUsername,
      actor.name || '',
      actor.summary || '',
      actor.publicKey,
      actor.icon,
      actor.image
    );
  }

  // Handle incoming activities
  async handleInboxActivity(activity: any, actorUsername?: string): Promise<Response> {
    // If ActivityPub is disabled, reject requests with 503
    if (!this.config.enabled) {
      console.warn('Received ActivityPub activity while ActivityPub is disabled');
      return new Response('ActivityPub disabled', { status: 503 });
    }

    try {
      // Store the activity
      await this.db.insert(schema.activities).values({
        id: activity.id || generateActivityId('activities'),
        type: activity.type,
        actor: activity.actor,
        object: typeof activity.object === 'string' ? activity.object : JSON.stringify(activity.object),
        target: activity.target,
        published: new Date(activity.published || Date.now()),
        content: activity.content,
        raw: JSON.stringify(activity),
      });

      // Handle different activity types
      switch (activity.type) {
        case 'Follow':
          return await this.handleFollowActivity(activity, actorUsername);
        case 'Undo':
          return await this.handleUndoActivity(activity);
        case 'Create':
          return await this.handleCreateActivity(activity);
        default:
          console.log('Unhandled activity type:', activity.type);
      }

      return new Response('', { status: 202 });
    } catch (error) {
      console.error('Error handling inbox activity:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  }

  // Handle Follow activity
  private async handleFollowActivity(activity: any, actorUsername?: string): Promise<Response> {
    const followerActor = activity.actor;
    const targetActor = activity.object;

    // Auto-accept follows for now (you might want to add approval logic)
    const followId = uuidv4();
    await this.db.insert(schema.followers).values({
      id: followId,
      actorId: targetActor,
      followerActorId: followerActor,
      accepted: true,
      createdAt: new Date(),
    });

    // Send Accept activity
    const acceptActivity = createAcceptActivity(targetActor, activity);
    await this.sendActivity(acceptActivity, followerActor);

    return new Response('', { status: 202 });
  }

  // Handle Undo activity (e.g., unfollow)
  private async handleUndoActivity(activity: any): Promise<Response> {
    if (activity.object?.type === 'Follow') {
      const followerActor = activity.actor;
      const targetActor = activity.object.object;

      await this.db
        .delete(schema.followers)
        .where(
          and(
            eq(schema.followers.followerActorId, followerActor),
            eq(schema.followers.actorId, targetActor)
          )
        );
    }

    return new Response('', { status: 202 });
  }

  // Handle Create activity
  private async handleCreateActivity(activity: any): Promise<Response> {
    const object = activity.object;
    
    await this.db.insert(schema.objects).values({
      id: object.id || generateActivityId('objects'),
      type: object.type,
      attributedTo: object.attributedTo,
      name: object.name,
      content: object.content,
      url: object.url,
      published: new Date(object.published || Date.now()),
      updated: object.updated ? new Date(object.updated) : null,
      inReplyTo: object.inReplyTo,
      raw: JSON.stringify(object),
    });

    return new Response('', { status: 202 });
  }

  // Send activity to remote actor
  async sendActivity(activity: any, targetActor: string): Promise<void> {
    try {
      // If federation is disabled, do not send
      if (!this.config.federation?.enabled) {
        console.warn('Federation disabled: not sending activity');
        return;
      }

      // Fetch target actor to get inbox
      const actorResponse = await fetch(targetActor, {
        headers: { 'Accept': 'application/activity+json' }
      });
      
      if (!actorResponse.ok) {
        throw new Error(`Failed to fetch actor: ${targetActor}`);
      }

      const actor = await actorResponse.json();
      const inbox = actor.inbox;

      // Get our actor's private key
      const ourActor = await this.db
        .select()
        .from(schema.actors)
        .where(eq(schema.actors.preferredUsername, this.config.actor.preferredUsername))
        .limit(1);

      if (ourActor.length === 0 || !ourActor[0].privateKey) {
        throw new Error('No private key found for signing');
      }

      const privateKey = ourActor[0].privateKey;
      const keyId = `${ourActor[0].id}#main-key`;
      const body = JSON.stringify(activity);

      // Create signature
      const headers: Record<string, string> = {
        'Content-Type': 'application/activity+json',
      };

      const signature = createHttpSignature(inbox, 'POST', headers, body, privateKey, keyId);
      headers['Signature'] = signature;

      // Send the activity
      const response = await fetch(inbox, {
        method: 'POST',
        headers,
        body,
      });

      if (!response.ok) {
        console.error(`Failed to send activity to ${inbox}:`, response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error sending activity:', error);
    }
  }

  // Get followers for an actor
  async getFollowers(username: string): Promise<any> {
    const actorUrl = generateActorUrl(username);
    const followers = await this.db
      .select()
      .from(schema.followers)
      .where(eq(schema.followers.actorId, actorUrl));

    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'OrderedCollection',
      id: `${actorUrl}/followers`,
      totalItems: followers.length,
      orderedItems: followers.map((f:{ followerActorId: string }) => f.followerActorId),
    };
  }

  // Get outbox for an actor
  async getOutbox(username: string): Promise<any> {
    const actorUrl = generateActorUrl(username);
    const activities = await this.db
      .select()
      .from(schema.activities)
      .where(eq(schema.activities.actor, actorUrl))
      .orderBy(schema.activities.published);

    return {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'OrderedCollection',
      id: `${actorUrl}/outbox`,
      totalItems: activities.length,
      orderedItems: activities.map((a: {raw: string}) => JSON.parse(a.raw)),
    };
  }

  // Publish a new post to ActivityPub
  async publishPost(title: string, content: string, url: string): Promise<void> {
    const actor = await this.db
      .select()
      .from(schema.actors)
      .where(eq(schema.actors.preferredUsername, this.config.actor.preferredUsername))
      .limit(1);

    if (actor.length === 0) return;

    const note = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Article',
      id: generateActivityId('objects'),
      name: title,
      content,
      attributedTo: actor[0].id,
      url,
      published: new Date().toISOString(),
    };

    const createActivity = createCreateActivity(actor[0].id, note);

    // Store the activity and object
    await this.db.insert(schema.objects).values({
      id: note.id,
      type: note.type,
      attributedTo: note.attributedTo,
      name: note.name,
      content: note.content,
      url: note.url,
      published: new Date(note.published),
      raw: JSON.stringify(note),
    });

    await this.db.insert(schema.activities).values({
      id: createActivity.id,
      type: createActivity.type,
      actor: createActivity.actor,
      object: JSON.stringify(createActivity.object),
      published: new Date(createActivity.published),
      raw: JSON.stringify(createActivity),
    });

    // Send to all followers
    const followers = await this.db
      .select()
      .from(schema.followers)
      .where(eq(schema.followers.actorId, actor[0].id));

    for (const follower of followers) {
      await this.sendActivity(createActivity, follower.followerActorId);
    }
  }
}

// Singleton instance
let activityPubService: ActivityPubService;

export function getActivityPubService(): ActivityPubService {
  if (!activityPubService) {
    activityPubService = new ActivityPubService();
  }
  return activityPubService;
}
