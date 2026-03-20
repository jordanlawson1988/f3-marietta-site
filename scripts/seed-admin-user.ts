#!/usr/bin/env npx tsx
/**
 * Seed the initial admin user for Better Auth.
 * Usage: npx tsx scripts/seed-admin-user.ts
 *
 * This creates a user account that can log in to the /admin panel.
 * Run once after migration; subsequent runs are idempotent.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const BASE_URL = process.env.BETTER_AUTH_URL || 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@f3marietta.com';
const ADMIN_PASSWORD = process.env.ADMIN_DASHBOARD_PASSWORD || 'changeme';

async function main() {
    console.log('Seeding admin user...');
    console.log(`  Email: ${ADMIN_EMAIL}`);
    console.log(`  URL: ${BASE_URL}`);

    try {
        const res = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': BASE_URL,
            },
            body: JSON.stringify({
                email: ADMIN_EMAIL,
                password: ADMIN_PASSWORD,
                name: 'F3 Admin',
            }),
        });

        const data = await res.json();

        if (res.ok) {
            console.log('Admin user created successfully!');
            console.log(`  User ID: ${data.user?.id || data.id}`);
        } else if (data.message?.includes('already exists') || data.code === 'USER_ALREADY_EXISTS') {
            console.log('Admin user already exists — skipping.');
        } else {
            console.error('Failed to create admin user:', data);
            process.exit(1);
        }
    } catch (error) {
        console.error('Error:', error);
        console.error('\nMake sure the dev server is running (npm run dev) before running this script.');
        process.exit(1);
    }
}

main();
