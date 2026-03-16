'use client';

/**
 * Side-by-side Slack mrkdwn editor + preview.
 * Left panel: editable textarea with raw mrkdwn.
 * Right panel: basic HTML preview of Slack mrkdwn formatting.
 */
function renderSlackMrkdwn(raw: string): string {
  const lines = raw.split('\n');
  const htmlParts: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trimStart();
    const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('\u2022 ');

    if (isBullet) {
      if (!inList) {
        htmlParts.push('<ul class="list-disc pl-5 space-y-1">');
        inList = true;
      }
      const content = trimmed.replace(/^[-\u2022]\s/, '');
      htmlParts.push(`<li>${inlineFormat(content)}</li>`);
    } else {
      if (inList) {
        htmlParts.push('</ul>');
        inList = false;
      }

      if (trimmed === '') {
        htmlParts.push('<br />');
      } else {
        htmlParts.push(`<p>${inlineFormat(line)}</p>`);
      }
    }
  }

  if (inList) {
    htmlParts.push('</ul>');
  }

  return htmlParts.join('\n');
}

/** Convert inline Slack mrkdwn tokens to HTML. */
function inlineFormat(text: string): string {
  // Escape HTML entities first
  let out = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // *bold*
  out = out.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
  // _italic_
  out = out.replace(/\b_([^_]+)_\b/g, '<em>$1</em>');
  // Catch remaining _italic_ that didn't match word boundaries
  out = out.replace(/_([^_]+)_/g, '<em>$1</em>');

  return out;
}

export default function NewsletterPreview({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Editor panel */}
      <div>
        <label className="block text-xs font-medium text-foreground/60 mb-1">
          Slack Mrkdwn
        </label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={18}
          className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground text-sm font-mono placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary resize-y"
          placeholder="Write Slack mrkdwn here..."
        />
      </div>

      {/* Preview panel */}
      <div>
        <label className="block text-xs font-medium text-foreground/60 mb-1">
          Preview
        </label>
        <div
          className="w-full min-h-[18rem] px-4 py-3 bg-background border border-border rounded-md text-foreground text-sm leading-relaxed overflow-auto prose-invert [&_strong]:font-bold [&_em]:italic [&_ul]:my-2 [&_li]:text-foreground [&_p]:my-1"
          dangerouslySetInnerHTML={{ __html: renderSlackMrkdwn(value) }}
        />
      </div>
    </div>
  );
}
