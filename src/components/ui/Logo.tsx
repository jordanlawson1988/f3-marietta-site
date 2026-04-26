import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoProps = {
    className?: string;
    size?: "sm" | "md" | "lg";
};

export function Logo({ className, size = "md" }: LogoProps) {
    const sizeClasses = {
        sm: "h-8 w-8",
        md: "h-24 w-24 md:h-28 md:w-28",
        lg: "h-28 w-28 md:h-32 md:w-32",
    };

    return (
        <Link href="/" className={cn("block relative shrink-0", className)}>
            <div
                className={cn(
                    "relative overflow-hidden rounded-full",
                    sizeClasses[size]
                )}
            >
                <Image
                    src="/images/new-f3-marietta-logo.png"
                    alt="F3 Marietta logo – Fitness, Fellowship, Faith"
                    fill
                    className="object-cover"
                    priority
                />
            </div>
        </Link>
    );
}
