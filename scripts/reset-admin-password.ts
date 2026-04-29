#!/usr/bin/env npx tsx
/**
 * Reset the admin user's password using Better Auth's scrypt hasher.
 * Usage: npx tsx scripts/reset-admin-password.ts
 *
 * Reads ADMIN_DASHBOARD_PASSWORD from .env.local and updates the
 * existing credential account row for admin@f3marietta.com.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';
import { hashPassword } from 'better-auth/crypto';

const ADMIN_EMAIL = 'admin@f3marietta.com';

async function main() {
    const password = process.env.ADMIN_DASHBOARD_PASSWORD;
    if (!password) {
        console.error('ADMIN_DASHBOARD_PASSWORD is not set in .env.local');
        process.exit(1);
    }
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL is not set');
        process.exit(1);
    }

    const sql = neon(process.env.DATABASE_URL);

    const users = await sql`SELECT id FROM "user" WHERE email = ${ADMIN_EMAIL}`;
    if (users.length === 0) {
        console.error(`No user found with email ${ADMIN_EMAIL}`);
        process.exit(1);
    }
    const userId = users[0].id as string;

    const hashed = await hashPassword(password);

    const result = await sql`
        UPDATE account
        SET password = ${hashed}, "updatedAt" = now()
        WHERE "userId" = ${userId} AND "providerId" = 'credential'
        RETURNING "userId", "providerId"
    `;

    if (result.length === 0) {
        console.error('No credential account row updated. Does one exist?');
        process.exit(1);
    }

    console.log(`Password reset for ${ADMIN_EMAIL} (userId=${userId}).`);
    console.log('You can now sign in at /admin/login.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
