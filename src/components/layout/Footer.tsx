import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export function Footer() {
    return (
        <footer className="w-full border-t border-border bg-muted py-12">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="col-span-1 md:col-span-2">
                        <div className="mb-4">
                            <Logo />
                        </div>
                        <p className="text-muted-foreground max-w-sm">
                            Free, peer-led workouts for men in Marietta, GA.
                            Our mission is to plant, grow, and serve small workout groups for men for the invigoration of male community leadership.
                        </p>
                    </div>

                    <div>
                        <h3 className="font-bold mb-4">Quick Links</h3>
                        <ul className="space-y-2">
                            <li><Link href="/about" className="text-muted-foreground hover:text-primary transition-colors">About Us</Link></li>
                            <li><Link href="/workouts" className="text-muted-foreground hover:text-primary transition-colors">Workouts</Link></li>
                            <li><Link href="/backblasts" className="text-muted-foreground hover:text-primary transition-colors">Backblasts</Link></li>
                            <li><Link href="/community" className="text-muted-foreground hover:text-primary transition-colors">Community</Link></li>
                            <li><Link href="/glossary" className="text-muted-foreground hover:text-primary transition-colors">F3 Terms</Link></li>
                            <li><a href="https://f3gear.com/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">F3 Gear</a></li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="font-bold mb-4">Connect</h3>
                        <ul className="space-y-2">
                            <li><Link href="/contact" className="text-muted-foreground hover:text-primary transition-colors">Contact Us</Link></li>
                            <li><a href="https://www.facebook.com/people/F3-Marietta/61585217978212/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">Facebook</a></li>
                            <li><a href="https://www.instagram.com/f3marietta/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">Instagram</a></li>
                            <li><a href="https://f3nation.com/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">F3 Nation</a></li>
                            <li><a href="https://f3nation.com/q-source" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">Q-Source</a></li>
                        </ul>
                    </div>
                </div>

                <div className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
                    <p>&copy; {new Date().getFullYear()} F3 Marietta. All rights reserved.</p>
                    <p className="mt-2">
                        F3 is always free, open to all men, held outdoors, peer-led, and ends with a Circle of Trust.
                    </p>
                </div>
            </div>
        </footer>
    );
}
