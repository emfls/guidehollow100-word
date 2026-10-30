import {defineConfig} from 'astro/config';
import sitemap from '@astrojs/sitemap';
export default defineConfig({site:'https://word.guidehollow.com',output:'static',trailingSlash:'always',integrations:[sitemap()]});
