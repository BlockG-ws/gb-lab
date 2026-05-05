import {defineCollection} from 'astro:content';
import {posts} from './content/posts/_schemas';
import {pages} from "./content/pages/_schemas";
import {file,glob} from 'astro/loaders';
import { z } from 'astro/zod';
import {authors} from './data/authors._schema.ts';
import remoteYAML from "../plugins/fetch-remote-yaml";

const blogCollection = defineCollection({
    loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: "./src/content/posts" }),
    schema: posts,
});
const pageCollection = defineCollection({
    schema: pages,
    loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: "./src/content/pages" }),
});
const blogRollData = defineCollection({
    loader: remoteYAML('https://raw.githubusercontent.com/GrassBlock1/Friend-of-mine/refs/heads/master/data/links.yaml'),
    schema: z.object({
        link: z.string(),
        avatar: z.string().optional(),
        description: z.string().optional(),
    })
});

const authorsData = defineCollection({
    loader: file("src/data/authors.yaml"),
    schema: authors,
});

export const collections = {
    'posts': blogCollection,
    'pages': pageCollection,
    'links': blogRollData,
    'authors': authorsData,
};