import { Mail, Share2 } from "lucide-react";
import { Section } from "@/components/ui/Section";
import { Hero } from "@/components/ui/Hero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ContactForm } from "./ContactForm";

export default function ContactPage() {
    return (
        <div className="flex flex-col min-h-screen">
            <Hero
                title="CONTACT US"
                subtitle="Have questions? Want to start an AO? Reach out."
                backgroundImage="/images/contact-bg.jpg"
            />

            <Section>
                <div className="max-w-2xl mx-auto">
                    <h2 className="text-3xl font-bold font-heading mb-6 text-center">GET IN TOUCH</h2>
                    <p className="text-muted-foreground mb-8 text-center">
                        The best way to reach us is to show up at a workout. But if you have specific questions or media inquiries, feel free to drop us a line.
                    </p>

                    <ContactForm />
                </div>
            </Section>

            <Section className="bg-muted/30">
                <div className="max-w-2xl mx-auto space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Mail className="h-5 w-5" /> Email
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <a
                                href="mailto:f3marietta@gmail.com"
                                className="text-primary hover:underline"
                            >
                                f3marietta@gmail.com
                            </a>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Share2 className="h-5 w-5" /> Social Media
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex gap-6">
                            <a
                                href="https://www.facebook.com/people/F3-Marietta/61585217978212/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary transition-colors"
                            >
                                Facebook
                            </a>
                            <a
                                href="https://www.instagram.com/f3marietta/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary transition-colors"
                            >
                                Instagram
                            </a>
                        </CardContent>
                    </Card>
                </div>
            </Section>
        </div>
    );
}
