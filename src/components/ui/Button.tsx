import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    asChild?: boolean;
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
    size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
        // Simplified: ignore asChild for now, or just render children if it's a Slot.
        // But since we are removing Radix, we can't use Slot.
        // If asChild is true, we expect the child to be the element.
        // For now, we'll just render a button. If the user passed a Link as child, it might break nesting.
        // But in our code we used <Button asChild><Link ...></Button>.
        // So we need to handle that.

        // If asChild is true, we clone the child and add classes?
        // Or just return the child?

        if (asChild && React.isValidElement(props.children)) {
            const child = React.Children.only(props.children) as React.ReactElement<{ className?: string }>;
            // Only pass className to the child - do NOT spread all props
            // Spreading props.children onto the Link causes nested <a> tags
            return React.cloneElement(child, {
                className: cn(baseStyles, variants[variant], sizes[size], className, child.props.className),
            });
        }

        return (
            <button
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                ref={ref}
                {...props}
            />
        );
    }
);
Button.displayName = "Button";

const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    outline: "border border-primary bg-transparent text-primary hover:bg-accent hover:text-accent-foreground",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    link: "text-primary underline-offset-4 hover:underline",
};

const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10",
};

export { Button };
