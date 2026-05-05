import type { APIRoute } from 'astro';
import { federationService } from '@/plugins/activitypub/service';

export const prerender = false;

export const ALL: APIRoute = async ({ request }) => {
  // Let Fedify handle all ActivityPub related requests:
  // - Actor JSON representation
  // - Inbox (shared and personal)
  // - Outbox
  // - Followers collection
  // - Objects
  return await federationService.fetch(request, { contextData: undefined });
};
