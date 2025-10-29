import type { APIRoute } from 'astro';
import { getActivityPubService } from '@/plugins/activitypub/service';
import { isActivityPubRequest, createActivityPubResponse } from '@/plugins/activitypub/utils';
import { verifyIncomingRequest } from '@/plugins/activitypub/crypto';

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
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
    const outbox = await service.getOutbox(username as string);
    
    return createActivityPubResponse(outbox);
  } catch (error) {
    console.error('Error fetching outbox:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
};


export const POST: APIRoute = async ({ params, request }) => {
  const { username } = params;
  
  if (!username) {
    return new Response('Username required', { status: 400 });
  }

  // Only accept ActivityPub requests
  if (!isActivityPubRequest(request)) {
    return new Response('Not Acceptable', { status: 406 });
  }

  try {
    const body = await request.text();
    const activity = JSON.parse(body);

    // Build headers map
    const headersMap: Record<string, string | null> = {};
    for (const [k, v] of request.headers) {
      headersMap[k.toLowerCase()] = v;
    }

    // Verify signature and digest
    const verification = await verifyIncomingRequest('POST', request.url, headersMap, body);
    if (!verification.ok) {
      console.warn('Outbox request verification failed:', verification.reason);
      return new Response('Unauthorized', { status: 401 });
    }

    const service = getActivityPubService();
    return await service.handleInboxActivity(activity, username as string);
  } catch (error) {
    console.error('Error handling inbox activity:', error);
    return new Response('Bad Request', { status: 400 });
  }
};
