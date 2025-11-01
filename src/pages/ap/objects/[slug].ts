import type {APIRoute} from 'astro';
import { getActivityPubService } from '@/plugins/activitypub/service';
import { getActivityPubConfig } from '@/plugins/activitypub/config';
import { createActivityPubResponse } from '@/plugins/activitypub/utils';

export const GET: APIRoute = async ({ params }) => {
  try {
    const slug = params.slug;
    const apConfig = getActivityPubConfig();
    const postUrl = `${apConfig.baseUrl.replace(/\/$/, '')}/blog/${slug}`;

    const service = getActivityPubService();
    const obj = await service.getObjectByUrl(postUrl);

    if (obj) return createActivityPubResponse(obj, 200);

    // Minimal fallback
    const actor = await service.getActor(apConfig.actor.preferredUsername);
    const article = {
      '@context': ['https://www.w3.org/ns/activitystreams', 'https://w3id.org/security/v1'],
      type: 'Article',
      id: postUrl,
      name: slug,
      content: '',
      attributedTo: actor?.id,
      url: postUrl,
      published: new Date().toISOString(),
    };

    return createActivityPubResponse(article, 200);
  } catch (err) {
    return new Response('Not found', { status: 404 });
  }
};

