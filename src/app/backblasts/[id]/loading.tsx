import { Section } from '@/components/ui/Section';

export default function BackblastDetailLoading() {
    return (
        <div className="flex flex-col min-h-screen animate-pulse">
            {/* Back link skeleton */}
            <Section className="pb-0">
                <div className="max-w-4xl mx-auto">
                    <div className="h-4 w-32 bg-muted rounded mb-6" />
                </div>
            </Section>

            <Section>
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* Title */}
                    <div className="h-8 w-2/3 bg-muted rounded" />

                    {/* Meta row */}
                    <div className="flex flex-wrap gap-4">
                        <div className="h-4 w-28 bg-muted rounded" />
                        <div className="h-4 w-20 bg-muted rounded" />
                        <div className="h-4 w-24 bg-muted rounded" />
                    </div>

                    {/* Content body */}
                    <div className="space-y-3 pt-4 border-t border-border">
                        <div className="h-4 w-full bg-muted rounded" />
                        <div className="h-4 w-full bg-muted rounded" />
                        <div className="h-4 w-5/6 bg-muted rounded" />
                        <div className="h-4 w-full bg-muted rounded" />
                        <div className="h-4 w-3/4 bg-muted rounded" />
                        <div className="h-4 w-full bg-muted rounded" />
                        <div className="h-4 w-2/3 bg-muted rounded" />
                    </div>
                </div>
            </Section>
        </div>
    );
}
