import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-sm font-medium transition-[background-color,color,opacity] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-fg/50 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-ink hover:bg-accent/85",
        ghost: "bg-transparent text-muted hover:bg-surface-2 hover:text-fg",
        surface: "border border-border bg-transparent text-fg hover:bg-surface-2",
        quiet: "bg-surface-2 text-fg hover:bg-border",
      },
      size: {
        sm: "min-h-9 px-3 text-xs",
        md: "min-h-11 px-4 text-sm",
        lg: "min-h-12 px-5 text-sm",
      },
    },
    defaultVariants: { variant: "surface", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} type={asChild ? undefined : type} {...props} />;
}
