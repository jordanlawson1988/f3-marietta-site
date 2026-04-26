import { betterAuth } from "better-auth";
import { Pool } from "@neondatabase/serverless";

export const auth = betterAuth({
    database: new Pool({ connectionString: process.env.DATABASE_URL }),
    emailAndPassword: {
        enabled: true,
    },
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // refresh daily
    },
    trustedOrigins: [
        process.env.BETTER_AUTH_URL || "http://localhost:3000",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        // Vercel preview deploys for this project (branch aliases + per-commit URLs)
        "https://f3-marietta-site-*.vercel.app",
    ],
});
