import type { APIRoute } from 'astro';
import { db, objects } from 'astro:db';
import { getCollection } from 'astro:content';
import { publishToActivityPub } from '@/plugins/activitypub/integration';
import { getActivityPubConfig } from '@/plugins/activitypub/config';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {

    const config = getActivityPubConfig();
    if (!config.federation.enabled || !process.env.ACTIVITYPUB_PUB_TOKEN) {
        return new Response(JSON.stringify({ message: "Auto-publish disabled or federation off." }), { status: 200 });
    }
    if (!import.meta.env.PROD) {
        return new Response(JSON.stringify({ message: "This endpoint is not available for dev environment"}),{status: 404})
    }
    // auth
    const authHeader = request.headers.get('Authorization');
    const expectedToken = import.meta.env.ACTIVITYPUB_PUB_TOKEN

    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
        return new Response(JSON.stringify({message: "Unauthorized"}),{status:401})
    }

    try {
        // get all posts
        const posts = await getCollection('posts');

        // get all objects
        const existingObjects = await db.select().from(objects);

        // check existing posts in db
        const existingSlugs = existingObjects.map(obj => {
            const url = new URL(obj.url);
            const parts = url.pathname.split('/').filter(Boolean);
            return parts[parts.length - 1]; // 获取 slug
        });

        const newlyPublished = [];

        // publish non-existing
        for (const post of posts) {
            if (!existingSlugs.includes(post.id)) {
                console.log(`[ActivityPub Sync] Detect new post: ${post.id}`);
                await publishToActivityPub({
                    title: post.data.title,
                    // TODO: we'll use rendered body in future
                    content: post.body || '',
                    id: post.id,
                    excerpt: post.data.description || post.data.summary || '',
                    published: post.data.date
                });
                newlyPublished.push(post.id);
            }
        }

        return new Response(JSON.stringify({ success: true, newlyPublished }), { status: 200 });
    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
    }
};