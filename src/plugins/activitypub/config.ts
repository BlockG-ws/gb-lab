import { siteConfig } from '../../config.ts';

export interface ActivityPubConfig {
  enabled: boolean;
  domain: string;
  baseUrl: string;
  actor: {
    preferredUsername: string;
    name: string;
    summary: string;
    icon?: string;
    image?: string;
  };
  keypair?: {
    publicKey: string;
    privateKey: string;
  };
  federation: {
    enabled: boolean;
    allowList?: string[]; // domains to allow
    blockList?: string[]; // domains to block
  };
}

// Get ActivityPub configuration
export function getActivityPubConfig(): ActivityPubConfig {
  // Prefer configuration from siteConfig.activitypub, fallback to envs
  const site = (siteConfig as any).activitypub || {};

  const domain = process.env.ACTIVITYPUB_DOMAIN || site.domain || 'change.me';
  const baseUrl = process.env.ACTIVITYPUB_BASE_URL || site.baseUrl || `https://${domain}`;

  const preferredUsername = site.username || siteConfig.defaultAuthor.id || 'ap';
  const name = site.name || siteConfig.title || domain;
  const summary = site.summary || siteConfig.description || 'A blog built with Astro';
  const icon = site.icon || '/favicon.ico';
  const image = process.env.ACTIVITYPUB_IMAGE || site.image || siteConfig.homepageOgImage || '';

  const publicKey = process.env.ACTIVITYPUB_PUBLIC_KEY || site.publicKey || '';
  const privateKey = process.env.ACTIVITYPUB_PRIVATE_KEY || '';

  // Determine whether ActivityPub should be enabled: site-enabled and both keys present
  const siteEnabled = typeof site.enabled === 'boolean' ? site.enabled : true;
  let enabled = siteEnabled && Boolean(publicKey) && Boolean(privateKey);

  // Federation rules
  const federationEnabled = process.env.ACTIVITYPUB_FEDERATION_ENABLED !== 'false' && (site.federation?.enabled ?? true);
  const allowList = process.env.ACTIVITYPUB_ALLOW_LIST?.split(',') || site.federation?.allowList;
  const blockList = process.env.ACTIVITYPUB_BLOCK_LIST?.split(',') || site.federation?.blockList;

  // If site requested ActivityPub but keys are missing, warn and disable
  if (siteEnabled && (!publicKey || !privateKey)) {
    console.warn('ActivityPub configuration: public/private key not found. Disabling ActivityPub features until keys are provided.');
    enabled = false;
  }

  // If federation is disabled by env/site, ensure it's off
  const federation = {
    enabled: Boolean(enabled && federationEnabled),
    allowList: allowList?.filter(Boolean),
    blockList: blockList?.filter(Boolean),
  };

  return {
    enabled,
    domain,
    baseUrl,
    actor: {
      preferredUsername,
      name,
      summary,
      icon,
      image,
    },
    keypair: {
      publicKey,
      privateKey,
    },
    federation,
  };
}

// ActivityPub content types
export const ACTIVITYPUB_CONTENT_TYPE = 'application/activity+json';
export const ACTIVITYSTREAMS_CONTENT_TYPE = 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"';

// Common ActivityPub contexts
export const ACTIVITYPUB_CONTEXT = [
  'https://www.w3.org/ns/activitystreams',
  'https://w3id.org/security/v1',
];

// Activity types
export const ACTIVITY_TYPES = {
  CREATE: 'Create',
  UPDATE: 'Update',
  DELETE: 'Delete',
  FOLLOW: 'Follow',
  ACCEPT: 'Accept',
  REJECT: 'Reject',
  LIKE: 'Like',
  ANNOUNCE: 'Announce',
  UNDO: 'Undo',
} as const;

// Object types
export const OBJECT_TYPES = {
  NOTE: 'Note',
  ARTICLE: 'Article',
  PERSON: 'Person',
  ORGANIZATION: 'Organization',
  SERVICE: 'Service',
  APPLICATION: 'Application',
} as const;
