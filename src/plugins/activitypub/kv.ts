import type {
    KvStore,
    KvKey,
    KvStoreSetOptions,
    KvStoreListEntry
} from "@fedify/fedify";
import {db, activityPubKV, eq, like} from "astro:db";

export class AstroDbKvStore implements KvStore {
    private serializeKey(key: KvKey): string {
        return key.join(':');
    }

    async get<T = unknown>(key: KvKey): Promise<T | undefined> {
        const keyStr = JSON.stringify(key);
        const result = await db.select().from(activityPubKV).where(eq(activityPubKV.key,keyStr));

        if (result.length === 0) return undefined;
        return JSON.parse(result[0].value) as T;
    }

    async set(key: KvKey, value: unknown, options: KvStoreSetOptions): Promise<void> {
        const keyStr = JSON.stringify(key);
        const valueStr = JSON.stringify(value);
        //const expiresAt = options?.ttl ? new Date(Date.now() + options.ttl * 1000) : null;

        await db
            .insert(activityPubKV)
            .values({
                key: keyStr,
                value: valueStr,
            })
            .onConflictDoUpdate({
                target: activityPubKV.key,
                set: {value: valueStr},
            });
    }

    async delete(key: KvKey): Promise<void> {
        const keyStr = JSON.stringify(key);
        await db.delete(activityPubKV).where(eq(activityPubKV.key, keyStr));
    }

    async *list(prefix?: KvKey): AsyncIterable<KvStoreListEntry> {
        const serializedPrefix = prefix ? JSON.stringify(prefix) : "";
        const rows = await db.select().from(activityPubKV).where(like(activityPubKV.key,`%${serializedPrefix}%`));
        for (const row of rows) {
            yield {
                key: JSON.parse(row.key) as KvKey,
                value: JSON.parse(row.value),
            };
        }
    }
}
