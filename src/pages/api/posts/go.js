import {getCollection} from "astro:content";

const posts = await getCollection('posts')

const slugs = posts.map(post => post.slug)

export const prerender = false

export const GET = async () => {
    const slug = slugs[Math.floor(Math.random()*slugs.length)]
    const link = `/blog/${slug}`
    return new Response(link,{ status: 302, headers: { 'Location': link } })
}