import type {Config} from 'drizzle-kit';

export default {
    schema: './src/lib/db/schema.ts',
    out: './migrations',
    driver: 'pglite',
    dialect: process.env.DB_TYPE === 'postgresql' ? 'postgresql' : 'sqlite',
    dbCredentials: process.env.DB_TYPE === 'postgresql'
        ? {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'activitypub',
        }
        : {
            url: process.env.DB_PATH || './data/activitypub.db',
        },
} satisfies Config;

