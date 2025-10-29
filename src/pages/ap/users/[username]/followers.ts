import type { APIRoute } from 'astro';
import { getActivityPubService } from '@/plugins/activitypub/service';
import { isActivityPubRequest, createActivityPubResponse } from '@/plugins/activitypub/utils';
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
    const followers = await service.getFollowers(username as string);
    
    return createActivityPubResponse(followers);
  } catch (error) {
    console.error('Error fetching followers:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};
