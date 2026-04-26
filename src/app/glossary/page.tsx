import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/brand/PageHeader";
import { CTABand } from "@/components/ui/brand/CTABand";
import { GlossaryList } from "@/components/ui/GlossaryList";
import { lexiconEntries, exiconEntries } from "@/../data/f3Glossary";

const totalTerms = lexiconEntries.length + exiconEntries.length;

export const metadata: Metadata = {
  title: "Glossary",
  description: "F3 Lexicon — terms, abbreviations, and inside jokes used across F3 Nation and F3 Marietta.",
};

export default function GlossaryPage() {
  return (
    <>
      <PageHeader
        eyebrow="§ Lexicon"
        variant="ink"
        title={<>The<br />Lexicon.</>}
        kicker={<>{totalTerms} terms · F3 Nation + Regional.</>}
        meter={{ left: "Source · F3 Nation Lexicon", right: `Terms · ${totalTerms}` }}
      />

      <section className="bg-bone py-14">
        <div className="max-w-[1320px] mx-auto px-7">
          <GlossaryList />
        </div>
      </section>

      <CTABand
        variant="bone"
        title={<>Still curious?</>}
        kicker={<>The whole point is to show up. The words will come.</>}
        primary={{ label: "Find a Workout", href: "/workouts" }}
      />
    </>
  );
}
