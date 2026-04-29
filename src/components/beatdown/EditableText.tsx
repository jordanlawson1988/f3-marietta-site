'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  onChange: (next: string) => void;
  as?: 'h2' | 'h3' | 'p' | 'span' | 'div';
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
  multiline?: boolean;
}

export default function EditableText({
  value,
  onChange,
  as = 'span',
  className = '',
  placeholder,
  ariaLabel,
  multiline = false,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select?.();
    }
  }, [editing]);

  function commit() {
    const next = draft.trim();
    if (next !== value) onChange(next);
    setEditing(false);
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (editing) {
    const sharedClass = `w-full rounded-md border border-border bg-card text-foreground px-2 py-1 ${className}`;
    if (multiline) {
      return (
        <textarea
          ref={(el) => { inputRef.current = el; }}
          value={draft}
          rows={2}
          aria-label={ariaLabel}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); cancel(); }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
          }}
          className={sharedClass}
        />
      );
    }
    return (
      <input
        ref={(el) => { inputRef.current = el; }}
        value={draft}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); cancel(); }
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
        }}
        className={sharedClass}
      />
    );
  }

  const Tag = as;
  const display = value || placeholder || '';
  return (
    <Tag
      className={`${className} cursor-text rounded hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--steel)] ${value ? '' : 'text-muted-foreground italic'}`}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditing(true); }
      }}
    >
      {display}
    </Tag>
  );
}
