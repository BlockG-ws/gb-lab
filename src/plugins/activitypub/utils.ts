import { v4 as uuidv4 } from 'uuid';
import { getActivityPubConfig, ACTIVITYPUB_CONTEXT, ACTIVITY_TYPES, OBJECT_TYPES } from './config.ts';
import { normalizePem } from './crypto.ts';

// Generate ActivityPub IDs
export function generateActivityId(type: string, id?: string): string {
  const config = getActivityPubConfig();
  const uuid = id || uuidv4();
  return `${config.baseUrl}/ap/${type}/${uuid}`;
}

// Generate actor URLs
export function generateActorUrl(username: string): string {
  const config = getActivityPubConfig();
  return `${config.baseUrl}/ap/users/${username}`;
}

// Generate collection URLs
export function generateCollectionUrl(username: string, collection: string): string {
  const config = getActivityPubConfig();
  return `${config.baseUrl}/ap/users/${username}/${collection}`;
}

// Create ActivityPub Actor object
export function createActor(username: string, name: string, summary: string, publicKey: string, icon?: string, image?: string) {
  const config = getActivityPubConfig();
  const actorUrl = generateActorUrl(username);
  
  return {
    '@context': ACTIVITYPUB_CONTEXT,
    type: OBJECT_TYPES.PERSON,
    id: actorUrl,
    preferredUsername: username,
    name,
    summary,
    inbox: `${actorUrl}/inbox`,
    outbox: `${actorUrl}/outbox`,
    followers: `${actorUrl}/followers`,
    following: `${actorUrl}/following`,
    publicKey: {
      id: `${actorUrl}#main-key`,
      owner: actorUrl,
      publicKeyPem: normalizePem(publicKey) || publicKey,
    },
    icon: icon ? {
      type: 'Image',
      mediaType: 'image/png',
      url: icon.startsWith('http') ? icon : `${config.baseUrl}${icon}`,
    } : undefined,
    image: image ? {
      type: 'Image',
      mediaType: 'image/png',
      url: image.startsWith('http') ? image : `${config.baseUrl}${image}`,
    } : undefined,
    endpoints: {
      sharedInbox: `${config.baseUrl}/ap/inbox`,
    },
  };
}

// Create ActivityPub Note object (for blog posts)
export function createNote(content: string, attributedTo: string, url?: string, inReplyTo?: string) {
  const noteId = generateActivityId('objects');
  
  return {
    '@context': ACTIVITYPUB_CONTEXT,
    type: OBJECT_TYPES.NOTE,
    id: noteId,
    attributedTo,
    content,
    url: url || noteId,
    published: new Date().toISOString(),
    inReplyTo,
  };
}

// Create ActivityPub Article object (for blog posts)
export function createArticle(name: string, content: string, attributedTo: string, url?: string) {
  const articleId = generateActivityId('objects');
  
  return {
    '@context': ACTIVITYPUB_CONTEXT,
    type: OBJECT_TYPES.ARTICLE,
    id: articleId,
    name,
    content,
    attributedTo,
    url: url || articleId,
    published: new Date().toISOString(),
  };
}

// Create ActivityPub Activity
export function createActivity(type: string, actor: string, object: any, target?: string) {
  const activityId = generateActivityId('activities');
  
  return {
    '@context': ACTIVITYPUB_CONTEXT,
    type,
    id: activityId,
    actor,
    object,
    target,
    published: new Date().toISOString(),
  };
}

// Create Follow activity
export function createFollowActivity(actor: string, target: string) {
  return createActivity(ACTIVITY_TYPES.FOLLOW, actor, target);
}

// Create Accept activity
export function createAcceptActivity(actor: string, object: any) {
  return createActivity(ACTIVITY_TYPES.ACCEPT, actor, object);
}

// Create Create activity
export function createCreateActivity(actor: string, object: any) {
  return createActivity(ACTIVITY_TYPES.CREATE, actor, object);
}

// Parse WebFinger resource
export function parseWebFingerResource(resource: string): { username: string; domain: string } | null {
  const match = resource.match(/^acct:(@?[^@]+)@(.+)$/);
  if (!match) return null;

  const rawUsername = match[1];
  const username = rawUsername.startsWith('@') ? rawUsername.slice(1) : rawUsername;

  return {
    username,
    domain: match[2],
  };
}

// Generate WebFinger response
export function createWebFingerResponse(username: string, domain: string) {
  const actorUrl = generateActorUrl(username);
  
  return {
    subject: `acct:${username}@${domain}`,
    aliases: [actorUrl],
    links: [
      {
        rel: 'self',
        type: 'application/activity+json',
        href: actorUrl,
      },
    ],
  };
}

// Validate ActivityPub content type
export function isActivityPubRequest(request: Request): boolean {
  const accept = request.headers.get('accept') || '';
  return accept.includes('application/activity+json') || 
         accept.includes('application/ld+json');
}

// Create proper ActivityPub response
export function createActivityPubResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/activity+json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    },
  });
}
