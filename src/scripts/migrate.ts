import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { migrate as migratePg } from 'drizzle-orm/postgres-js/migrator';
import { getDatabase } from '@/plugins/activitypub/db/config';
import fs from 'fs';
import path from 'path';

// Create data directory for SQLite if it doesn't exist
function ensureDataDir() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Run migrations
async function runMigrations() {
  ensureDataDir();

  const db = getDatabase();
  const dbType = process.env.DB_TYPE || 'sqlite';

  try {
    if (dbType === 'postgresql') {
      await migratePg(db, { migrationsFolder: './migrations/postgresql' });
    } else {
      await migrate(db, { migrationsFolder: './migrations/sqlite' });
    }
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Create tables manually for initial setup
async function createTables() {
  ensureDataDir();

  const db = getDatabase();
  const dbType = process.env.DB_TYPE || 'sqlite';

  try {
    if (dbType === 'sqlite') {
      // Use db.run instead of db.execute for better-sqlite3
      const sqlite = db.$client;

      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS actors (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          preferred_username TEXT NOT NULL,
          name TEXT,
          summary TEXT,
          inbox TEXT NOT NULL,
          outbox TEXT NOT NULL,
          followers TEXT,
          following TEXT,
          public_key TEXT NOT NULL,
          private_key TEXT,
          icon TEXT,
          image TEXT,
          endpoints TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS activities (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          actor TEXT NOT NULL,
          object TEXT,
          target TEXT,
          published INTEGER NOT NULL,
          content TEXT,
          raw TEXT NOT NULL
        )
      `);

      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS objects (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          attributed_to TEXT,
          name TEXT,
          content TEXT,
          url TEXT,
          published INTEGER,
          updated INTEGER,
          in_reply_to TEXT,
          raw TEXT NOT NULL
        )
      `);

      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS followers (
          id TEXT PRIMARY KEY,
          actor_id TEXT NOT NULL,
          follower_actor_id TEXT NOT NULL,
          accepted INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        )
      `);
    } else {
      // PostgreSQL table creation
      await db.execute(`
        CREATE TABLE IF NOT EXISTS actors (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          preferred_username TEXT NOT NULL,
          name TEXT,
          summary TEXT,
          inbox TEXT NOT NULL,
          outbox TEXT NOT NULL,
          followers TEXT,
          following TEXT,
          public_key TEXT NOT NULL,
          private_key TEXT,
          icon TEXT,
          image TEXT,
          endpoints TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS activities (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          actor TEXT NOT NULL,
          object TEXT,
          target TEXT,
          published TIMESTAMP NOT NULL,
          content TEXT,
          raw TEXT NOT NULL
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS objects (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          attributed_to TEXT,
          name TEXT,
          content TEXT,
          url TEXT,
          published TIMESTAMP,
          updated TIMESTAMP,
          in_reply_to TEXT,
          raw TEXT NOT NULL
        )
      `);

      await db.execute(`
        CREATE TABLE IF NOT EXISTS followers (
          id TEXT PRIMARY KEY,
          actor_id TEXT NOT NULL,
          follower_actor_id TEXT NOT NULL,
          accepted BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    console.log('Tables created successfully');
  } catch (error) {
    console.error('Table creation failed:', error);
    process.exit(1);
  }
}

// Run the migration
if (import.meta.url === `file://${process.argv[1]}`) {
  createTables();
}
