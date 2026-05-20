import { test, expect, type Page } from "@playwright/test";
import { config } from "dotenv";
import { Pool } from "@neondatabase/serverless";

config({ path: ".env.local" });

// Throwaway accounts created against the live DB; deleted in afterAll.
const STAMP = Date.now();
const EMAIL_A = `verify-admin-${STAMP}@f3marietta.test`;
const EMAIL_B = `verify-pending-${STAMP}@f3marietta.test`;
const PASSWORD = "TestPassw0rd!";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function statusOf(email: string): Promise<string | null> {
    const r = await pool.query(
        `SELECT mp.status FROM member_profiles mp JOIN "user" u ON u.id = mp.user_id WHERE u.email = $1`,
        [email]
    );
    return r.rows[0]?.status ?? null;
}

async function promoteToAdmin(email: string) {
    await pool.query(
        `UPDATE member_profiles SET status='admin' WHERE user_id = (SELECT id FROM "user" WHERE email=$1)`,
        [email]
    );
}

async function deleteUser(email: string) {
    const u = await pool.query(`SELECT id FROM "user" WHERE email=$1`, [email]);
    const id = u.rows[0]?.id;
    if (!id) return;
    await pool.query(`DELETE FROM session WHERE "userId"=$1`, [id]);
    await pool.query(`DELETE FROM account WHERE "userId"=$1`, [id]);
    await pool.query(`DELETE FROM member_profiles WHERE user_id=$1`, [id]);
    await pool.query(`DELETE FROM "user" WHERE id=$1`, [id]);
}

async function signUp(page: Page, name: string, email: string) {
    await page.goto("/admin/signup");
    await page.locator("#signup-name").fill(name);
    await page.locator("#signup-email").fill(email);
    await page.locator("#signup-password").fill(PASSWORD);
    await page.locator("#signup-confirm").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Account created")).toBeVisible({ timeout: 15000 });
}

test.afterAll(async () => {
    await deleteUser(EMAIL_A);
    await deleteUser(EMAIL_B);
    await pool.end();
});

test.describe.serial("multi-admin system", () => {
    test("unauthenticated visitor sees the login gate on /admin", async ({ page }) => {
        await page.goto("/admin");
        await expect(page.getByText("F3 Marietta Admin")).toBeVisible();
        await expect(page.getByText("Request an account")).toBeVisible();
    });

    test("public signup creates a pending account (create-hook)", async ({ page }) => {
        await signUp(page, "Verify Admin", EMAIL_A);
        expect(await statusOf(EMAIL_A)).toBe("pending");
    });

    test("a pending user is gated out of the console", async ({ browser }) => {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        await signUp(page, "Verify Pending", EMAIL_B);
        // signUp auto-signs-in; the console must show the awaiting-approval screen
        await page.goto("/admin");
        await expect(page.getByText("Awaiting approval")).toBeVisible({ timeout: 15000 });
        // Team/Profile are gated too
        await page.goto("/admin/team");
        await expect(page.getByText("Awaiting approval")).toBeVisible();
        await ctx.close();
    });

    test("an approved admin can use the console and approve/revoke others", async ({ browser }) => {
        // Promote A (simulates the bootstrap approval an existing admin performs)
        await promoteToAdmin(EMAIL_A);

        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        // sign in as A
        await page.goto("/admin");
        await page.locator("#admin-email").fill(EMAIL_A);
        await page.locator("#admin-password").fill(PASSWORD);
        await page.getByRole("button", { name: "Sign In" }).click();

        // Console renders: Team nav visible
        await expect(page.getByRole("link", { name: "Team" })).toBeVisible({ timeout: 15000 });

        // Team page: approve B
        await page.goto("/admin/team");
        await expect(page.getByText("Team Members")).toBeVisible();
        const rowB = page.getByRole("row").filter({ hasText: EMAIL_B });
        await rowB.getByRole("button", { name: "Approve" }).click();
        await expect.poll(() => statusOf(EMAIL_B), { timeout: 15000 }).toBe("admin");

        // Revoke B
        const rowBAdmin = page.getByRole("row").filter({ hasText: EMAIL_B });
        await rowBAdmin.getByRole("button", { name: "Revoke" }).click();
        await expect.poll(() => statusOf(EMAIL_B), { timeout: 15000 }).toBe("revoked");

        await ctx.close();
    });

    test("a member can edit their own profile", async ({ browser }) => {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        await page.goto("/admin");
        await page.locator("#admin-email").fill(EMAIL_A);
        await page.locator("#admin-password").fill(PASSWORD);
        await page.getByRole("button", { name: "Sign In" }).click();

        // Wait for the console to render (session established) before navigating.
        await expect(page.getByRole("link", { name: "Profile" })).toBeVisible({ timeout: 15000 });
        await page.getByRole("link", { name: "Profile" }).click();
        await expect(page.getByText("My Profile")).toBeVisible({ timeout: 15000 });
        await page.locator("#profile-f3name").fill("Clydesdale");
        await page.getByRole("button", { name: "Save Profile" }).click();
        await expect(page.getByText("Profile saved")).toBeVisible({ timeout: 15000 });

        const r = await pool.query(
            `SELECT f3_name FROM member_profiles mp JOIN "user" u ON u.id=mp.user_id WHERE u.email=$1`,
            [EMAIL_A]
        );
        expect(r.rows[0]?.f3_name).toBe("Clydesdale");
        await ctx.close();
    });
});
