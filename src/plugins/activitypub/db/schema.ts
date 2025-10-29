import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { pgTable, text as pgText, integer as pgInteger, boolean as pgBoolean, timestamp, uuid, primaryKey as pgPrimaryKey } from 'drizzle-orm/pg-core';

// Common schema interface
export interface ActivityPubActor {
  id: string;
  type: 'Person' | 'Organization' | 'Service' | 'Application';
  preferredUsername: string;
  name?: string;
  summary?: string;
  inbox: string;
  outbox: string;
  followers?: string;
  following?: string;
  publicKey: string;
  privateKey?: string;
  icon?: string;
  image?: string;
  endpoints?: string; // JSON string
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityPubActivity {
  id: string;
  type: string;
  actor: string;
  object?: string;
  target?: string;
  published: Date;
  content?: string;
  raw: string; // JSON string of the full activity
}

export interface ActivityPubObject {
  id: string;
  type: string;
  attributedTo?: string;
  name?: string;
  content?: string;
  url?: string;
  published?: Date;
  updated?: Date;
  inReplyTo?: string;
  raw: string; // JSON string of the full object
}

export interface Follower {
  id: string;
  actorId: string;
  followerActorId: string;
  accepted: boolean;
  createdAt: Date;
}

// SQLite Tables
export const actorsTableSqlite = sqliteTable('actors', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  preferredUsername: text('preferred_username').notNull(),
  name: text('name'),
  summary: text('summary'),
  inbox: text('inbox').notNull(),
  outbox: text('outbox').notNull(),
  followers: text('followers'),
  following: text('following'),
  publicKey: text('public_key').notNull(),
  privateKey: text('private_key'),
  icon: text('icon'),
  image: text('image'),
  endpoints: text('endpoints'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const activitiesTableSqlite = sqliteTable('activities', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  actor: text('actor').notNull(),
  object: text('object'),
  target: text('target'),
  published: integer('published', { mode: 'timestamp' }).notNull(),
  content: text('content'),
  raw: text('raw').notNull(),
});

export const objectsTableSqlite = sqliteTable('objects', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  attributedTo: text('attributed_to'),
  name: text('name'),
  content: text('content'),
  url: text('url'),
  published: integer('published', { mode: 'timestamp' }),
  updated: integer('updated', { mode: 'timestamp' }),
  inReplyTo: text('in_reply_to'),
  raw: text('raw').notNull(),
});

export const followersTableSqlite = sqliteTable('followers', {
  id: text('id').primaryKey(),
  actorId: text('actor_id').notNull(),
  followerActorId: text('follower_actor_id').notNull(),
  accepted: integer('accepted', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// PostgreSQL Tables
export const actorsTablePg = pgTable('actors', {
  id: pgText('id').primaryKey(),
  type: pgText('type').notNull(),
  preferredUsername: pgText('preferred_username').notNull(),
  name: pgText('name'),
  summary: pgText('summary'),
  inbox: pgText('inbox').notNull(),
  outbox: pgText('outbox').notNull(),
  followers: pgText('followers'),
  following: pgText('following'),
  publicKey: pgText('public_key').notNull(),
  privateKey: pgText('private_key'),
  icon: pgText('icon'),
  image: pgText('image'),
  endpoints: pgText('endpoints'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const activitiesTablePg = pgTable('activities', {
  id: pgText('id').primaryKey(),
  type: pgText('type').notNull(),
  actor: pgText('actor').notNull(),
  object: pgText('object'),
  target: pgText('target'),
  published: timestamp('published').notNull(),
  content: pgText('content'),
  raw: pgText('raw').notNull(),
});

export const objectsTablePg = pgTable('objects', {
  id: pgText('id').primaryKey(),
  type: pgText('type').notNull(),
  attributedTo: pgText('attributed_to'),
  name: pgText('name'),
  content: pgText('content'),
  url: pgText('url'),
  published: timestamp('published'),
  updated: timestamp('updated'),
  inReplyTo: pgText('in_reply_to'),
  raw: pgText('raw').notNull(),
});

export const followersTablePg = pgTable('followers', {
  id: pgText('id').primaryKey(),
  actorId: pgText('actor_id').notNull(),
  followerActorId: pgText('follower_actor_id').notNull(),
  accepted: pgBoolean('accepted').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Export appropriate tables based on environment
const dbType = process.env.DB_TYPE || 'sqlite';

export const actors = dbType === 'postgresql' ? actorsTablePg : actorsTableSqlite;
export const activities = dbType === 'postgresql' ? activitiesTablePg : activitiesTableSqlite;
export const objects = dbType === 'postgresql' ? objectsTablePg : objectsTableSqlite;
export const followers = dbType === 'postgresql' ? followersTablePg : followersTableSqlite;
