import {column, defineDb, defineTable} from 'astro:db';

const activityPubKV = defineTable({
  columns: {
    key: column.text({ primaryKey: true }),
    value: column.text(),
  }
})

// https://astro.build/db/config
export default defineDb({
  tables: { activityPubKV }
});

