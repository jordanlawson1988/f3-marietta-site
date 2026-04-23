import { Section } from "@/components/ui/Section";

export default function AboutPage() {
    return (
        <div className="flex flex-col min-h-screen">
            {/* TODO(redesign): replaced by PageHeader in Wave 4 */}

            <Section>
                <div className="max-w-3xl mx-auto space-y-8">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-bold font-heading mb-4">OUR MISSION</h2>
                        <p className="text-xl font-medium italic border-l-4 border-primary pl-4 py-2 bg-muted/30">
                            &quot;To plant, grow, and serve small workout groups for men for the invigoration of male community leadership.&quot;
                        </p>
                    </div>

                    <div>
                        <h2 className="text-2xl md:text-3xl font-bold font-heading mb-4">OUR STORY</h2>
                        <p className="text-muted-foreground mb-4">
                            F3 Marietta began in June 2024 with the launch of our first workout location (AO), &quot;The Battlefield,&quot; at Marietta High School. What started as a small group of men gathering in the gloom has grown into a thriving community.
                        </p>
                        <p className="text-muted-foreground mb-4">
                            As our numbers grew, we expanded to include a second AO, &quot;The Last Stand,&quot; adopted from the Alpha region. This growth signaled the readiness for Marietta to stand on its own as an official F3 Region.
                        </p>
                        <p className="text-muted-foreground">
                            Today, F3 Marietta serves men across the city, providing a place to get fit, find fellowship, and explore faith—all while developing the leadership skills needed to be better husbands, fathers, and community members.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-2xl md:text-3xl font-bold font-heading mb-4">WHY WE DO IT</h2>
                        <p className="text-muted-foreground mb-4">
                            We believe that men are suffering from a lack of connection and purpose. F3 provides a solution to the isolation many men face. By suffering together in a workout, we build bonds that allow us to support each other in all areas of life.
                        </p>
                        <p className="text-muted-foreground">
                            Our goal is to invigorate male community leadership. We want to see men stepping up to lead in their homes, their workplaces, their churches, and their neighborhoods.
                        </p>
                    </div>
                </div>
            </Section>
        </div>
    );
}
