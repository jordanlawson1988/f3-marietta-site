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
    const sharedClass = `w-full rounded-md border border-line-soft bg-bone-2 text-ink px-2 py-1 ${className}`;
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
  // The trigger is a real <button> nested inside the tag rather than
  // role="button" on the tag itself. Putting the role on an <h2> replaces its
  // heading role outright, which quietly drops the beatdown title out of the
  // document outline for anyone navigating by headings.
  return (
    <Tag className={`${className} ${value ? '' : 'text-muted italic'}`}>
      {/* Named by its own content, not by an aria-label: a label here also
          becomes the accessible name of the wrapping <h2>, which would leave
          the beatdown title announced as "Edit beatdown title" instead of the
          title itself. The hint rides on title= for sighted hover. */}
      <button
        type="button"
        title={ariaLabel}
        onClick={() => setEditing(true)}
        style={{
          font: 'inherit',
          color: 'inherit',
          letterSpacing: 'inherit',
          textTransform: 'inherit',
          textAlign: 'inherit',
          lineHeight: 'inherit',
        }}
        className="w-full cursor-text bg-transparent p-0 text-left hover:bg-bone-3/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-steel"
      >
        {display}
      </button>
    </Tag>
  );
}
