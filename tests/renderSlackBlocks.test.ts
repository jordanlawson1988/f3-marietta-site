import { test } from "node:test";
import { strict as assert } from "node:assert";
import { renderSlackBlocksToHtml } from "../src/lib/slack/renderSlackBlocksToHtml";

// A hand-typed backblast arrives as a rich_text block. The TEXT channel
// (content_text) must keep the raw Slack id so stats can match the Q against
// f3_event_qs — exactly like the mrkdwn path already does (line: <@U..> -> @U..).
// The HTML channel (content_html) still resolves to the display name.
test("rich_text user mention keeps the Slack id in text, resolves the name in html", async () => {
  const blocks = [
    {
      type: "rich_text",
      elements: [
        {
          type: "rich_text_section",
          elements: [
            { type: "text", text: "Q: " },
            { type: "user", user_id: "U0A9RDSRUGG" },
          ],
        },
      ],
    },
  ];

  const { html, text } = await renderSlackBlocksToHtml(blocks, async () => "Ray gun");

  assert.match(text, /@U0A9RDSRUGG/, "content_text must preserve the raw Slack id");
  assert.match(html, /Ray gun/, "content_html must show the resolved display name");
});
