import { cva } from "class-variance-authority";
import { cn } from "./utils";

// Export only style configurations and utilities
export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

// Common sizes
export const sizes = {
  xs: "h-7 px-2 text-xs",
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-base",
  lg: "h-11 px-6 text-lg",
  icon: "h-9 w-9",
};

// Common animations
export const animations = {
  button: "active:scale-95 transition-all",
  hover: "transition-colors hover:bg-accent hover:text-accent-foreground",
  press: "active:translate-y-0.5",
};

// Shared focus styles
export const focusStyles = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

// Card styles
export const cardStyles = {
  base: "rounded-lg border bg-card text-card-foreground shadow-sm",
  header: "flex flex-col space-y-1.5 p-6",
  title: "text-2xl font-semibold leading-none tracking-tight",
  description: "text-sm text-muted-foreground",
  content: "p-6 pt-0",
  footer: "flex items-center p-6 pt-0",
};

// Input styles
export const inputStyles = {
  base: cn(
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
    "ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium",
    "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
  ),
};

// Form styles
export const formStyles = {
  label: "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
  item: "space-y-2",
  message: "text-sm font-medium text-destructive",
  description: "text-sm text-muted-foreground",
};

export const getStylesWithVariants = (baseStyles: string, variants?: Record<string, string>) => {
  if (!variants) return baseStyles;
  return cn(baseStyles, variants);
};