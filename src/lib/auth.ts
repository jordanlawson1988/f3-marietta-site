import { betterAuth } from "better-auth";
import { Pool } from "@neondatabase/serverless";
import { getSql } from "@/lib/db";

export const auth = betterAuth({
    database: new Pool({ connectionString: process.env.DATABASE_URL }),
    emailAndPassword: {
        enabled: true,
    },
    databaseHooks: {
        user: {
            create: {
                // Every new account lands as a pending member; an existing
                // admin grants access in /admin/team.
                after: async (user) => {
                    const sql = getSql();
                    await sql`
                        INSERT INTO member_profiles (user_id, status)
                        VALUES (${user.id}, 'pending')
                        ON CONFLICT (user_id) DO NOTHING
                    `;
                },
            },
        },
    },
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // refresh daily
    },
    trustedOrigins: [
        // Production domains — listed first; Better Auth iterates this array per request
        "https://f3marietta.com",
        "https://www.f3marietta.com",
        // Vercel preview deploys for this project (branch aliases + per-commit URLs)
        "https://f3-marietta-site-*.vercel.app",
        process.env.BETTER_AUTH_URL || "http://localhost:3000",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
    ],
});
