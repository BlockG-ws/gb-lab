import type { APIRoute } from 'astro';
import { getActivityPubService } from '@/plugins/activitypub/service';
import { isActivityPubRequest } from '@/plugins/activitypub/utils';
import { verifyIncomingRequest } from '@/plugins/activitypub/crypto';
import { getActivityPubConfig } from '@/plugins/activitypub/config';

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  const config = getActivityPubConfig();
  if (!config.enabled) {
    return new Response('ActivityPub disabled (missing keypair)', { status: 503 });
  }

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

    // Build headers map
    const headersMap: Record<string, string | null> = {};
    for (const [k, v] of request.headers) {
      headersMap[k.toLowerCase()] = v;
    }

    // Verify signature and digest
    const verification = await verifyIncomingRequest('POST', request.url, headersMap, body);
    if (!verification.ok) {
      console.warn('ActivityPub request verification failed:', verification.reason);
      return new Response('Unauthorized', { status: 401 });
    }

    const activity = JSON.parse(body);

    const service = getActivityPubService();
    await service.initializeActor(); // ensure our actor exists

    return await service.handleInboxActivity(activity, username as string);
  } catch (error) {
    console.error('Error handling user inbox activity:', error);
    return new Response('Bad Request', { status: 400 });
  }
};

export const GET: APIRoute = async () => {
  return new Response('Method Not Allowed', { status: 405 });
};
