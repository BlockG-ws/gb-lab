import {getCollection} from "astro:content";

const friends = await getCollection('links')

const links = friends.map(friend => friend.data.link)

export const prerender = false

export const GET = async () => {
    const link = links[Math.floor(Math.random()*links.length)]
    return new Response(link,{ status: 302, headers: { 'Location': link } })
}