'use client';

const MAX_CHARS = 2200;
const WARN_THRESHOLD = 2000;

export default function CaptionEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const count = value.length;
  const isWarning = count > WARN_THRESHOLD && count <= MAX_CHARS;
  const isDanger = count > MAX_CHARS;

  return (
    <div className="space-y-1">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground text-sm placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary resize-y"
        placeholder="Instagram caption..."
      />
      <div className="flex justify-end">
        <span
          className={`text-xs font-medium ${
            isDanger
              ? 'text-danger'
              : isWarning
                ? 'text-warning'
                : 'text-foreground/40'
          }`}
        >
          {count.toLocaleString()} / {MAX_CHARS.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
