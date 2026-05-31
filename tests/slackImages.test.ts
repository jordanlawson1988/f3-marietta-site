import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  extractSlackImageFiles,
  imageBlocksFromUrls,
  rehostSlackImageFiles,
  appendImageBlocks,
} from "../src/lib/slack/slackImages";
import { extractFirstImageUrl } from "../src/lib/backblast/getBackblastsPaginated";

// --- extractSlackImageFiles (pure) ---

test("extractSlackImageFiles returns only image-mimetype files", () => {
  const msg = {
    files: [
      { id: "F1", mimetype: "image/jpeg", url_private: "u1", name: "a.jpg" },
      { id: "F2", mimetype: "application/pdf", url_private: "u2", name: "b.pdf" },
      { id: "F3", mimetype: "image/png", url_private: "u3", name: "c.png" },
    ],
  };
  assert.deepEqual(extractSlackImageFiles(msg).map((f) => f.id), ["F1", "F3"]);
});

test("extractSlackImageFiles tolerates missing/empty files", () => {
  assert.deepEqual(extractSlackImageFiles({}), []);
  assert.deepEqual(extractSlackImageFiles({ files: [] }), []);
  assert.deepEqual(extractSlackImageFiles({ files: undefined }), []);
});

// --- imageBlocksFromUrls (pure) — must be readable by the display extractor ---

test("imageBlocksFromUrls builds blocks extractFirstImageUrl can read", () => {
  const blocks = imageBlocksFromUrls(["https://blob.example/x.jpg"]);
  assert.equal(extractFirstImageUrl({ blocks }), "https://blob.example/x.jpg");
});

test("appendImageBlocks preserves existing blocks and is idempotent", () => {
  const cj1 = appendImageBlocks({ blocks: [{ type: "rich_text" }] }, ["https://b/x.jpg"]);
  assert.equal((cj1.blocks as unknown[]).length, 2);
  assert.equal(extractFirstImageUrl(cj1), "https://b/x.jpg");
  // Re-applying the same URL must not duplicate it.
  const cj2 = appendImageBlocks(cj1, ["https://b/x.jpg"]);
  const imgCount = (cj2.blocks as Array<{ type?: string; image_url?: string }>).filter(
    (b) => b.type === "image" && b.image_url === "https://b/x.jpg",
  ).length;
  assert.equal(imgCount, 1);
});

// --- rehostSlackImageFiles (I/O via injected deps) ---

function okImageResponse(bytes = [0xff, 0xd8, 0xff, 0xe0], contentType = "image/jpeg") {
  return {
    ok: true,
    status: 200,
    headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? contentType : null) },
    arrayBuffer: async () => new Uint8Array(bytes).buffer,
  };
}

test("rehostSlackImageFiles downloads with the bot token and uploads public to blob", async () => {
  const fetched: Array<{ url: string; auth: string }> = [];
  const puts: Array<{ path: string; opts: Record<string, unknown> }> = [];
  const urls = await rehostSlackImageFiles(
    [{ id: "F1", mimetype: "image/jpeg", url_private: "https://files.slack.com/x.jpg", name: "x.jpg" }],
    {
      fetchFn: (async (url: string, opts: { headers: Record<string, string> }) => {
        fetched.push({ url, auth: opts.headers.Authorization });
        return okImageResponse();
      }) as unknown as typeof fetch,
      putFn: async (path, _body, opts) => {
        puts.push({ path, opts });
        return { url: `https://blob.example/${path}` };
      },
      token: "xoxb-test",
    },
  );
  assert.deepEqual(urls, ["https://blob.example/backblasts/F1.jpg"]);
  assert.match(fetched[0].auth, /^Bearer xoxb-test$/);
  assert.equal(puts[0].opts.access, "public");
  assert.equal(puts[0].opts.addRandomSuffix, false);
});

test("rehostSlackImageFiles skips a file whose download fails (graceful, no throw)", async () => {
  const urls = await rehostSlackImageFiles(
    [{ id: "F1", mimetype: "image/jpeg", url_private: "u", name: "x.jpg" }],
    {
      fetchFn: (async () => ({ ok: false, status: 403, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) })) as unknown as typeof fetch,
      putFn: async () => { throw new Error("put should not be called on failed download"); },
      token: "t",
    },
  );
  assert.deepEqual(urls, []);
});

test("rehostSlackImageFiles skips a non-image (HTML) response — the missing-files:read failure mode", async () => {
  // When files:read is absent, Slack returns a 200 text/html sign-in page.
  const urls = await rehostSlackImageFiles(
    [{ id: "F1", mimetype: "image/jpeg", url_private: "u", name: "x.jpg" }],
    {
      fetchFn: (async () => okImageResponse([0x3c, 0x68, 0x74, 0x6d, 0x6c], "text/html; charset=utf-8")) as unknown as typeof fetch,
      putFn: async () => { throw new Error("put should not be called for non-image content"); },
      token: "t",
    },
  );
  assert.deepEqual(urls, []);
});
