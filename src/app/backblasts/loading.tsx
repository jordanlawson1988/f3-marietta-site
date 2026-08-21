import { Section } from '@/components/ui/Section';

function SkeletonCard() {
    return (
        <div className="bg-bone-2 border border-line-soft rounded-lg p-5 space-y-3 animate-pulse">
            <div className="flex items-center gap-3">
                <div className="h-4 w-24 bg-bone-3 rounded" />
                <div className="h-4 w-16 bg-bone-3 rounded" />
            </div>
            <div className="h-5 w-3/4 bg-bone-3 rounded" />
            <div className="space-y-2">
                <div className="h-3 w-full bg-bone-3 rounded" />
                <div className="h-3 w-5/6 bg-bone-3 rounded" />
            </div>
        </div>
    );
}

export default function BackblastsLoading() {
    return (
        <div className="flex flex-col min-h-screen">
            {/* Hero skeleton */}
            <div className="h-48 bg-bone-3 animate-pulse" />

            <Section>
                <div className="max-w-6xl mx-auto">
                    {/* Controls skeleton */}
                    <div className="mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div className="flex gap-3 flex-wrap items-center">
                            <div className="h-10 w-36 bg-bone-3 rounded-lg animate-pulse" />
                            <div className="h-10 w-48 bg-bone-3 rounded-lg animate-pulse" />
                            <div className="h-10 w-20 bg-bone-3 rounded-lg animate-pulse" />
                        </div>
                    </div>

                    {/* Card grid skeleton */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <SkeletonCard key={i} />
                        ))}
                    </div>
                </div>
            </Section>
        </div>
    );
}
