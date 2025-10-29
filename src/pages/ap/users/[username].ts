import type { APIRoute } from 'astro';
import { getActivityPubService } from '@/plugins/activitypub/service.ts';
import { isActivityPubRequest, createActivityPubResponse } from '@/plugins/activitypub/utils.ts';
import { getActivityPubConfig } from '@/plugins/activitypub/config';

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  const config = getActivityPubConfig();
  if (!config.enabled) {
    return new Response('ActivityPub disabled (missing keypair)', { status: 503 });
  }

  const { username } = params;
  
  if (!username) {
    return new Response('Username required', { status: 400 });
  }

  // Only respond to ActivityPub requests
  if (!isActivityPubRequest(request)) {
    return new Response('Not Acceptable', { status: 406 });
  }

  try {
    const service = getActivityPubService();
    await service.initializeActor(); // Ensure actor exists
    
    const actor = await service.getActor(username as string);
    
    if (!actor) {
      return new Response('User not found', { status: 404 });
    }

    return createActivityPubResponse(actor);
  } catch (error) {
    console.error('Error fetching actor:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};
