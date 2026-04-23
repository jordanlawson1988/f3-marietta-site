import Link from "next/link";
import Image from "next/image";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { FitnessIcon, FellowshipIcon, FaithIcon } from "@/components/ui/F3Icons";


export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* TODO(redesign): replaced by HomeHero in Wave 3 */}

      {/* 1. What is F3? (Moved to top) */}
      <Section className="bg-background pt-12 md:pt-20">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-2xl md:text-3xl font-bold font-heading mb-4">WHAT IS F3?</h2>
          <p className="text-lg text-muted-foreground">
            F3 is a national network of free, peer-led workouts for men. Our mission is to plant, grow, and serve small workout groups for men for the invigoration of male community leadership.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="text-center border-none shadow-none bg-transparent">
            <CardHeader>
              <div className="mx-auto bg-primary/10 p-4 rounded-full mb-4">
                <FitnessIcon className="h-16 w-16 text-primary" />
              </div>
              <CardTitle>Fitness</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Open to all men of all fitness levels. We start together and end together. No man left behind.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center border-none shadow-none bg-transparent">
            <CardHeader>
              <div className="mx-auto bg-primary/10 p-4 rounded-full mb-4">
                <FellowshipIcon className="h-16 w-16 text-primary" />
              </div>
              <CardTitle>Fellowship</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                We don&apos;t just work out. We build bonds of brotherhood that last beyond the gloom.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center border-none shadow-none bg-transparent">
            <CardHeader>
              <div className="mx-auto bg-primary/10 p-4 rounded-full mb-4">
                <FaithIcon className="h-16 w-16 text-primary" />
              </div>
              <CardTitle>Faith</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Not a specific religion, but a belief in something bigger than yourself. We end with a Circle of Trust.
              </p>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* 2. Who is F3 Marietta? (Moved to second) */}
      <Section className="text-center bg-muted/30">
        <div className="flex justify-center mb-8">
          <div className="relative h-44 w-44 md:h-56 md:w-56 rounded-full overflow-hidden">
            <Image
              src="/icons/f3mariettalogo-main.png"
              alt="F3 Marietta logo"
              fill
              className="object-cover"
              priority
            />
          </div>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold font-heading mb-6">WHO IS F3 MARIETTA?</h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          F3 Marietta started with the launch of The Battlefield at Marietta Highschool in June 2024. Since then, F3 Marietta has continued to grow, with the official launch of the region in December 2025. We are a growing community of men in Marietta dedicated to becoming better leaders in our families, workplaces, and community.
        </p>
        <Button asChild variant="outline" size="lg">
          <Link href="/about">Read Our Story</Link>
        </Button>
      </Section>


      {/* 4. Highlights / 5 Core Principles */}
      <Section className="bg-muted/30">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <blockquote className="text-lg md:text-xl italic text-muted-foreground border-l-4 border-primary pl-4 mb-6">
              &quot;Leave no man behind, but leave no man where you found him.&quot;
            </blockquote>
            <h2 className="text-2xl md:text-3xl font-bold font-heading mb-6">THE 5 CORE PRINCIPLES</h2>
            <ul className="space-y-4">
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">1</span>
                <span className="font-medium">Free of charge</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">2</span>
                <span className="font-medium">Open to all men</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">3</span>
                <span className="font-medium">Held outdoors, rain or shine, heat or cold</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">4</span>
                <span className="font-medium">Peer-led in a rotating fashion</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">5</span>
                <span className="font-medium">Ends with a Circle of Trust (COT)</span>
              </li>
            </ul>
          </div>
          <div className="relative h-[400px] rounded-lg overflow-hidden bg-zinc-800 flex items-center justify-center">
            <Image
              src="/images/HomePage2.jpeg"
              alt="F3 Marietta Workout"
              fill
              className="object-cover"
            />
          </div>
        </div>
      </Section>

      {/* 5. CTA */}
      <Section className="bg-secondary text-secondary-foreground text-center py-20">
        <h2 className="text-2xl md:text-4xl font-bold font-heading mb-6">READY TO JOIN US?</h2>
        <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
          No sign-up fees. No catch. Just show up.
        </p>
        <Button asChild size="lg" className="bg-primary text-primary-foreground hover:bg-[#3A5E88] text-lg px-8 py-6 font-bold border-none">
          <Link href="/workouts">Find a Location</Link>
        </Button>
      </Section>
    </div >
  );
}
