import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://f3marietta.com"),
  title: {
    default: "F3 Marietta | Fitness, Fellowship, Faith",
    template: "%s | F3 Marietta",
  },
  description:
    "F3 Marietta is a region of F3 Nation in Marietta, GA. Free, peer-led workouts for men.",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "F3 Marietta",
    title: "F3 Marietta | Fitness, Fellowship, Faith",
    description:
      "Free, peer-led outdoor workouts for men in Marietta, GA. No sign-up required — just show up.",
    images: [
      {
        url: "/images/MariettaHomePage.jpeg",
        width: 1200,
        height: 630,
        alt: "F3 Marietta — Fitness, Fellowship, Faith",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "F3 Marietta | Fitness, Fellowship, Faith",
    description:
      "Free, peer-led outdoor workouts for men in Marietta, GA. No sign-up required — just show up.",
    images: ["/images/MariettaHomePage.jpeg"],
  },
};

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FloatingAssistant } from "@/components/ui/FloatingAssistant";
import { ReleaseNotes } from "@/components/ui/ReleaseNotes";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${oswald.variable} antialiased bg-background text-foreground font-sans flex flex-col min-h-screen`}
      >
        <Navbar />
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
        <FloatingAssistant />
        <ReleaseNotes />
      </body>
    </html>
  );
}
