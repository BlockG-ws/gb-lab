import type { APIRoute } from 'astro';
import { parseWebFingerResource, createWebFingerResponse } from '@/plugins/activitypub/utils';
import { getActivityPubConfig } from '@/plugins/activitypub/config';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const resource = url.searchParams.get('resource');

  if (!resource) {
    return new Response('Missing resource parameter', { status: 400 });
  }

  const parsed = parseWebFingerResource(resource);
  if (!parsed) {
    return new Response('Invalid resource format', { status: 400 });
  }

  const config = getActivityPubConfig();
  const { username, domain } = parsed;

  // Check if this is our domain and our main actor
  if (domain !== config.domain || username !== config.actor.preferredUsername) {
    return new Response('User not found', { status: 404 });
  }

  const response = createWebFingerResponse(username, domain);

  return new Response(JSON.stringify(response, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/jrd+json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
};

