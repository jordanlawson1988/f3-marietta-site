'use client';

import { useState } from 'react';
import { FAQItem } from '@/components/ui/FAQItem';

interface FAQ {
  question: string;
  answer: string;
}

interface FAQSectionProps {
  faqs: FAQ[];
}

export default function FAQSection({ faqs }: FAQSectionProps) {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? faqs.filter(
        (faq) =>
          faq.question.toLowerCase().includes(search.toLowerCase()) ||
          faq.answer.toLowerCase().includes(search.toLowerCase())
      )
    : faqs;

  return (
    <div>
      <div className="mb-8">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search FAQs..."
          className="w-full max-w-md px-4 py-2 rounded-lg border border-line-soft bg-bone text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-steel"
          aria-label="Search frequently asked questions"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-muted">No FAQs match your search.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((faq) => (
            <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
          ))}
        </div>
      )}
    </div>
  );
}
