import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

// Server-side only Neon database client
// NEVER import this file in client components

type SqlFunction = NeonQueryFunction<false, false>;

let sqlInstance: SqlFunction | null = null;

/**
 * Returns a lazily-initialized Neon SQL tagged-template function.
 * Returns rows as Record<string, unknown>[] (not full results).
 *
 * Usage:
 *   const sql = getSql();
 *   const rows = await sql`SELECT * FROM f3_events WHERE id = ${id}`;
 */
export function getSql(): SqlFunction {
    if (sqlInstance) {
        return sqlInstance;
    }

    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        throw new Error(
            'Missing DATABASE_URL environment variable. Please set it in .env.local'
        );
    }

    sqlInstance = neon(databaseUrl);
    return sqlInstance;
}
