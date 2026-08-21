import { Section } from '@/components/ui/Section';

export default function BackblastDetailLoading() {
    return (
        <div className="flex flex-col min-h-screen animate-pulse">
            {/* Back link skeleton */}
            <Section className="pb-0">
                <div className="max-w-4xl mx-auto">
                    <div className="h-4 w-32 bg-bone-3 rounded mb-6" />
                </div>
            </Section>

            <Section>
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* Title */}
                    <div className="h-8 w-2/3 bg-bone-3 rounded" />

                    {/* Meta row */}
                    <div className="flex flex-wrap gap-4">
                        <div className="h-4 w-28 bg-bone-3 rounded" />
                        <div className="h-4 w-20 bg-bone-3 rounded" />
                        <div className="h-4 w-24 bg-bone-3 rounded" />
                    </div>

                    {/* Content body */}
                    <div className="space-y-3 pt-4 border-t border-line-soft">
                        <div className="h-4 w-full bg-bone-3 rounded" />
                        <div className="h-4 w-full bg-bone-3 rounded" />
                        <div className="h-4 w-5/6 bg-bone-3 rounded" />
                        <div className="h-4 w-full bg-bone-3 rounded" />
                        <div className="h-4 w-3/4 bg-bone-3 rounded" />
                        <div className="h-4 w-full bg-bone-3 rounded" />
                        <div className="h-4 w-2/3 bg-bone-3 rounded" />
                    </div>
                </div>
            </Section>
        </div>
    );
}
