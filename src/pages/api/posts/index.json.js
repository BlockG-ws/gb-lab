import { getCollection } from 'astro:content';

export async function GET() {
    const posts = (await getCollection('posts', ({ data }) => {
        return import.meta.env.PROD ? data.draft !== true : true;
    })).sort((a, b) => {
        const ta = new Date(a.data.date).getTime();
        const tb = new Date(b.data.date).getTime();
        return tb - ta;
    });
    const searchIndex = posts.map(post => ({
        title: post.data.title,
        description: post.data.description || '',
        date: post.data.date,
        slug: post.slug
    }));

    return new Response(JSON.stringify(searchIndex), {
        headers: {
            'Content-Type': 'application/json'
        }
    });
}