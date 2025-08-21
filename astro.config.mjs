import {defineConfig} from 'astro/config';

import sitemap from '@astrojs/sitemap';

import mdx from '@astrojs/mdx';

import {remarkWordCount} from './src/plugins/remark/wordcount.js';

import cloudflare from '@astrojs/cloudflare';
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

import partytown from '@astrojs/partytown';
import {remarkModifiedTime} from "./src/plugins/remark/modified-time.mjs";

import node from '@astrojs/node';

import expressiveCode from 'astro-expressive-code';
export default defineConfig({
    site: 'https://lab.gb0.dev',
    base: '/',
    trailingSlash: 'ignore',
    redirects: {
        // for the old routes still can be accessed
        "/post/[...slug]": "/blog/[...slug]",
        "/index.xml": "/rss.xml",
        "/feed.rss": "/rss.xml",
    },

    build: {
        format: 'directory'
    },

    markdown: {
        remarkPlugins: [remarkMath, remarkWordCount, remarkModifiedTime],
        rehypePlugins: [rehypeKatex]
    },

    image: {
        responsiveStyles: true,
        layouts: 'constrained',
    },

    i18n: {
        locales: ["en", "zh_hans"],
        defaultLocale: "en",
    },

    integrations: [sitemap(), expressiveCode(), mdx(), partytown()],

    adapter: node({
      mode: 'standalone'
    })
});