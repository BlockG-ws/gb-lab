import { column, defineDb, defineTable } from 'astro:db';

const activityPubKV = defineTable({
  columns: {
    key: column.text({ primaryKey: true }),
    value: column.text(),
  }
});

const actors = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    type: column.text(),
    preferred_username: column.text(),
    name: column.text({ optional: true }),
    summary: column.text({ optional: true }),
    inbox: column.text(),
    outbox: column.text(),
    followers: column.text({ optional: true }),
    following: column.text({ optional: true }),
    public_key: column.text(),
    private_key: column.text({ optional: true }),
    icon: column.text({ optional: true }),
    image: column.text({ optional: true }),
    endpoints: column.text({ optional: true }),
    created_at: column.date(),
    updated_at: column.date(),
  }
});

const activities = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    type: column.text(),
    actor: column.text(),
    object: column.text({ optional: true }),
    target: column.text({ optional: true }),
    published: column.date(),
    content: column.text({ optional: true }),
    raw: column.text(),
  }
});

const objects = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    type: column.text(),
    attributed_to: column.text({ optional: true }),
    name: column.text({ optional: true }),
    content: column.text({ optional: true }),
    url: column.text({ optional: true }),
    published: column.date({ optional: true }),
    updated: column.date({ optional: true }),
    in_reply_to: column.text({ optional: true }),
    raw: column.text(),
  }
});

const followers = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    actor_id: column.text(),
    follower_actor_id: column.text(),
    accepted: column.boolean({ default: false }),
    created_at: column.date(),
  }
});

// https://astro.build/db/config
export default defineDb({
  tables: { 
    activityPubKV,
    actors,
    activities,
    objects,
    followers
  }
});
