import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { Section } from "@/components/ui/Section";
import { Hero } from "@/components/ui/Hero";
import { FAQItem } from "@/components/ui/FAQItem";
import Link from "next/link";

// ── Video data ──────────────────────────────────────────────────────────────
const videos = [
    { title: "Mission of F3", videoId: "mQ1uxuR65So" },
    { title: "What is F3?", videoId: "rGo03Y1ZZ3I" },
    { title: "What F3 Typically Looks Like", videoId: "WIYUXUwq2gM" },
    { title: "Basic F3 Exercises", videoId: "NvBUQ3x2Z-E" },
];

function VideoCard({ title, videoId }: { title: string; videoId: string }) {
    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border">
                <h3 className="font-bold font-heading text-foreground">{title}</h3>
            </div>
            <div className="relative w-full pt-[56.25%]">
                <iframe
                    className="absolute top-0 left-0 w-full h-full"
                    src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`}
                    title={title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            </div>
        </div>
    );
}

// ── FAQ data ────────────────────────────────────────────────────────────────
interface FAQ {
    question: string;
    answer: string;
    tags: string[];
    category: string;
}

function getFAQs(): FAQ[] {
    try {
        const faqDir = path.join(process.cwd(), "data", "content", "faq");
        const files = fs.readdirSync(faqDir).filter(f => f.endsWith('.md') && f !== 'README.md');

        const faqs = files.map(file => {
            const content = fs.readFileSync(path.join(faqDir, file), 'utf-8');
            const { data, content: body } = matter(content);

            const answerMatch = body.match(/### Answer\s+([\s\S]*?)(?=###|$)/);
            const answer = answerMatch ? answerMatch[1].trim() : '';

            return {
                question: data.title || '',
                answer: answer,
                tags: data.tags || [],
                category: data.category || ''
            };
        });

        return faqs
            .filter(faq => faq.tags.includes('FNG') && faq.question && faq.answer)
            .sort((a, b) => a.question.localeCompare(b.question));
    } catch (error) {
        console.error("Error reading FAQ files:", error);
        return [];
    }
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function NewHerePage() {
    const faqs = getFAQs();

    return (
        <div className="flex flex-col min-h-screen">
            <Hero
                title="NEW TO F3?"
                subtitle="Everything you need to know before your first workout. No sign-up, no fees — just show up."
                ctaText="Find a Workout"
                ctaLink="/workouts"
                backgroundImage="/images/workouts-bg.jpg"
            />

            {/* What to Expect — Videos */}
            <Section>
                <div className="text-center mb-10">
                    <h2 className="text-2xl md:text-3xl font-bold font-heading mb-3">WHAT TO EXPECT</h2>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                        Watch these short videos to learn what a typical workout looks like and some basic exercises you might encounter.
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
                    {videos.map((video) => (
                        <VideoCard key={video.videoId} title={video.title} videoId={video.videoId} />
                    ))}
                </div>
            </Section>

            {/* FAQ */}
            <Section className="bg-muted/30">
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-10">
                        <h2 className="text-2xl md:text-3xl font-bold font-heading mb-3">FREQUENTLY ASKED QUESTIONS</h2>
                        <p className="text-muted-foreground text-lg">
                            Got questions? We've got answers.
                        </p>
                    </div>
                    <div className="space-y-2">
                        {faqs.map((faq, index) => (
                            <FAQItem key={index} question={faq.question} answer={faq.answer} />
                        ))}
                    </div>
                </div>
            </Section>

            {/* CTA */}
            <Section className="text-center">
                <div className="bg-muted/50 border border-border rounded-xl px-6 py-8 max-w-2xl mx-auto">
                    <h3 className="text-xl font-bold font-heading mb-2">Ready to Post?</h3>
                    <p className="text-muted-foreground mb-4">
                        Find a workout location and time that works for you. All you need is yourself —
                        no sign-up required, just show up.
                    </p>
                    <Link
                        href="/workouts"
                        className="inline-flex items-center justify-center px-6 py-3 rounded-md bg-primary text-primary-foreground font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors"
                    >
                        Find a Workout
                    </Link>
                </div>
            </Section>
        </div>
    );
}
