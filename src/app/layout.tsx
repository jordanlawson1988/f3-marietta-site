import type { Metadata } from "next";
import { Inter, Oswald, JetBrains_Mono, DM_Serif_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic"],
  display: "swap",
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
import { TopBar } from "@/components/layout/TopBar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${oswald.variable} ${jetbrainsMono.variable} ${dmSerif.variable} antialiased bg-bone text-ink font-sans flex flex-col min-h-screen`}
      >
        <TopBar />
        <Navbar />
        <main className="flex-grow">{children}</main>
        <Footer />
        <FloatingAssistant />
      </body>
    </html>
  );
}
