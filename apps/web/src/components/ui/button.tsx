import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[transform,box-shadow,background-color] select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Action principale : dégradé prisme, relief « bouton d'arcade » qui s'enfonce au clic.
        primary:
          "rounded-full bg-gradient-to-r from-accent-strong to-coral-strong text-fg font-display tracking-wide shadow-[0_5px_0_0_#3B2490] hover:-translate-y-0.5 hover:shadow-[0_7px_0_0_#3B2490] active:translate-y-1 active:shadow-[0_1px_0_0_#3B2490]",
        secondary:
          "rounded-full bg-elev text-fg border border-line hover:border-accent hover:bg-[#2B1F52]",
        ghost: "rounded-full text-muted hover:text-fg hover:bg-elev",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-14 px-7 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
