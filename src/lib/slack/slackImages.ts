/**
 * Slack file-upload photo handling.
 *
 * Slackblast-app backblasts carry photos as public image blocks in
 * content_json.blocks. A human who types a backblast and attaches a photo
 * produces a Slack *file upload* (message.files[]) whose url_private is NOT
 * publicly viewable. To show those on the public site we download the file
 * with the bot token (requires the `files:read` scope) and re-host it to
 * Vercel Blob, then inject a public image block so the display layer
 * (extractFirstImageUrl) surfaces it. (Germantown incident, 2026-05-31.)
 */
import { put } from "@vercel/blob";

export type SlackImageFile = {
  id: string;
  mimetype: string;
  url_private?: string;
  url_private_download?: string;
  name?: string;
};

/** Pull image-mimetype file uploads out of a Slack message. Pure. */
export function extractSlackImageFiles(message: { files?: unknown }): SlackImageFile[] {
  const files = (message?.files as unknown[]) ?? [];
  if (!Array.isArray(files)) return [];
  const out: SlackImageFile[] = [];
  for (const f of files) {
    const file = f as Record<string, unknown>;
    const mimetype = typeof file.mimetype === "string" ? file.mimetype : "";
    const id = typeof file.id === "string" ? file.id : "";
    if (!id || !mimetype.startsWith("image/")) continue;
    out.push({
      id,
      mimetype,
      url_private: typeof file.url_private === "string" ? file.url_private : undefined,
      url_private_download:
        typeof file.url_private_download === "string" ? file.url_private_download : undefined,
      name: typeof file.name === "string" ? file.name : undefined,
    });
  }
  return out;
}

/** Build content_json image blocks the display extractor understands. Pure. */
export function imageBlocksFromUrls(
  urls: string[],
): Array<{ type: "image"; image_url: string }> {
  return urls
    .filter((u) => typeof u === "string" && u.length > 0)
    .map((image_url) => ({ type: "image" as const, image_url }));
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
};

/** Guard against Slack returning a 200 text/html "can't access" page when the
 *  bot lacks files:read — never re-host a non-image. */
function looksLikeImage(buf: Buffer, contentType: string): boolean {
  if (contentType.startsWith("image/")) return true;
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true; // jpeg
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true; // png
  if (buf.length >= 4 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true; // gif
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return true; // webp
  return false;
}

type FetchLike = typeof fetch;
type PutLike = (
  path: string,
  body: Buffer,
  opts: { access: "public"; addRandomSuffix?: boolean; contentType?: string },
) => Promise<{ url: string }>;

export interface RehostDeps {
  fetchFn?: FetchLike;
  putFn?: PutLike;
  token?: string;
}

/**
 * Download each Slack image file with the bot token and re-host it to Vercel
 * Blob (public), returning the public URLs. Deterministic Blob path keyed by
 * Slack file id, so re-running is idempotent. Never throws — a failed file is
 * logged and skipped so ingestion always proceeds.
 */
export async function rehostSlackImageFiles(
  files: SlackImageFile[],
  deps: RehostDeps = {},
): Promise<string[]> {
  const fetchFn = deps.fetchFn ?? fetch;
  const putFn = deps.putFn ?? (put as unknown as PutLike);
  const token = deps.token ?? process.env.SLACK_BOT_TOKEN;

  const urls: string[] = [];
  for (const file of files) {
    const src = file.url_private || file.url_private_download;
    if (!src) continue;
    try {
      const res = await fetchFn(src, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        console.warn(`[slackImages] download failed ${file.id}: HTTP ${res.status}`);
        continue;
      }
      const contentType = (res.headers.get("content-type") || "").toLowerCase();
      const buf = Buffer.from(await res.arrayBuffer());
      if (!looksLikeImage(buf, contentType)) {
        console.warn(
          `[slackImages] skip ${file.id}: not an image (content-type=${contentType}, ${buf.length}b) — bot may lack files:read`,
        );
        continue;
      }
      const ext = EXT_BY_MIME[file.mimetype] || "jpg";
      const blob = await putFn(`backblasts/${file.id}.${ext}`, buf, {
        access: "public",
        addRandomSuffix: false,
        contentType: file.mimetype,
      });
      urls.push(blob.url);
    } catch (err) {
      console.error(`[slackImages] rehost error ${file.id}:`, err instanceof Error ? err.message : err);
    }
  }
  return urls;
}

/**
 * Append image URLs as image blocks onto a content_json object so the display
 * layer surfaces the photo. Returns a new object (does not mutate input).
 */
export function appendImageBlocks(contentJson: unknown, urls: string[]): Record<string, unknown> {
  const cj =
    contentJson && typeof contentJson === "object"
      ? { ...(contentJson as Record<string, unknown>) }
      : {};
  const existing = Array.isArray(cj.blocks) ? cj.blocks : [];
  // Idempotent: don't re-append a photo that's already an image block (Blob
  // paths are deterministic, so re-ingest/edit yields the same URL).
  const existingImageUrls = new Set(
    existing
      .filter((b): b is { type: string; image_url: string } =>
        !!b && typeof b === "object" && (b as { type?: unknown }).type === "image",
      )
      .map((b) => b.image_url),
  );
  const fresh = imageBlocksFromUrls(urls).filter((b) => !existingImageUrls.has(b.image_url));
  cj.blocks = [...existing, ...fresh];
  return cj;
}
