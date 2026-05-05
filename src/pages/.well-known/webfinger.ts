import type { APIRoute } from 'astro';
import { federationService } from '@/plugins/activitypub/service';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  // Let Fedify handle the WebFinger request completely.
  // It will use the Actor dispatcher to resolve the actor and return the proper JRD response.
  return await federationService.fetch(request, { contextData: undefined });
};
