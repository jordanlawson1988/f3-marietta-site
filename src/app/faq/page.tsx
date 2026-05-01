import type { Metadata } from "next";
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { PageHeader } from "@/components/ui/brand/PageHeader";
import { CTABand } from "@/components/ui/brand/CTABand";
import { FAQList, type FAQEntry } from "@/components/ui/FAQList";

function loadFAQEntries(): FAQEntry[] {
  const faqDir = path.join(process.cwd(), "data", "content", "faq");
  const files = fs.readdirSync(faqDir).filter((f) => f.endsWith(".md") && f !== "README.md");

  const entries: FAQEntry[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(faqDir, file), "utf-8");
    const { data, content } = matter(raw);

    const questionMatch = content.match(/### Question\s+([\s\S]*?)(?=###|$)/);
    const answerMatch = content.match(/### Answer\s+([\s\S]*?)(?=###|$)/);

    if (questionMatch && answerMatch) {
      entries.push({
        slug: file.replace(/\.md$/, ""),
        question: questionMatch[1].trim(),
        answer: answerMatch[1].trim(),
        category: typeof data.category === "string" ? data.category : "General",
      });
    }
  }

  entries.sort((a, b) => a.question.localeCompare(b.question));
  return entries;
}

export const metadata: Metadata = {
  title: "FAQ — F3 Marietta",
  description:
    "Frequently asked questions about F3 Marietta workouts, culture, and how to get started.",
};

export default function FAQPage() {
  const entries = loadFAQEntries();

  return (
    <>
      <PageHeader
        eyebrow="§ Questions"
        title={<>Frequently<br />Asked.</>}
        kicker={
          <>
            {entries.length} answers to the questions every FNG (and their 2.0) asks.
          </>
        }
        meter={{ left: "Source · F3 Marietta PAX", right: `Questions · ${entries.length}` }}
      />

      <section className="bg-bone py-14">
        <div className="max-w-[1320px] mx-auto px-7">
          <FAQList entries={entries} />
        </div>
      </section>

      <CTABand
        variant="bone"
        title={<>Still have questions?</>}
        kicker={<>Best way to find out is to show up. We&apos;ll explain the rest.</>}
        primary={{ label: "Find a Workout", href: "/workouts" }}
        secondary={{ label: "Contact Us", href: "/contact" }}
      />
    </>
  );
}
