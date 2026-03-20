import { Section } from "@/components/ui/Section";
import { Hero } from "@/components/ui/Hero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Image from "next/image";

export default function CommunityPage() {
    return (
        <div className="flex flex-col min-h-screen">
            <Hero
                title="SERVING MARIETTA"
                subtitle="Building better men for a better community."
                backgroundImage="/images/community-bg.jpg"
            />

            <Section>
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-3xl font-bold font-heading mb-6">OUR IMPACT</h2>
                    <p className="text-lg text-muted-foreground">
                        F3 is more than just a workout. It&apos;s a leadership development organization. We believe that by getting right with ourselves (Fitness) and our brothers (Fellowship), we are better equipped to serve our families and community (Faith/3rd F).
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <Card>
                        <CardHeader>
                            <Image
                                src="/icons/community-leadership.svg"
                                alt="Community Leadership Icon"
                                width={40}
                                height={40}
                                className="mb-2"
                            />
                            <CardTitle>Community Leadership</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">
                                We encourage men to step up and lead—whether it&apos;s Q-ing a workout, organizing an event, or taking initiative in their neighborhoods.
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <Image
                                src="/icons/service-projects.svg"
                                alt="Service Projects Icon"
                                width={40}
                                height={40}
                                className="mb-2"
                            />
                            <CardTitle>Service Projects</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">
                                From cleaning up parks to supporting local charities, F3 Marietta is committed to leaving our city better than we found it.
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <Image
                                src="/icons/male-mental-health.svg"
                                alt="Male Mental Health Icon"
                                width={40}
                                height={40}
                                className="mb-2"
                            />
                            <CardTitle>Male Mental Health</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">
                                By fighting isolation and building genuine friendships, we support men&apos;s mental health and resilience.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </Section>

            <Section className="bg-muted/30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div>
                        <h2 className="text-3xl font-bold font-heading mb-6">A VISION FOR MARIETTA</h2>
                        <p className="text-muted-foreground mb-4">
                            Imagine a Marietta where men are physically fit, mentally sharp, and spiritually grounded. Where fathers are present and engaged. Where neighbors know and support each other.
                        </p>
                        <p className="text-muted-foreground">
                            This is the vision of F3 Marietta. We are building a community of men who are not just consumers, but producers—men who give back and lift others up.
                        </p>
                    </div>
                    <div className="relative h-[300px] rounded-lg overflow-hidden bg-zinc-800 flex items-center justify-center">
                        <Image
                            src="/images/community-group.jpg"
                            alt="F3 Marietta Community"
                            fill
                            className="object-cover"
                        />
                    </div>
                </div>
            </Section>
        </div>
    );
}
