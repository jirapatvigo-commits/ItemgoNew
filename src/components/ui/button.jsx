// @ts-nocheck
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

const variants = {
  default: "bg-primary text-primary-foreground hover:bg-[#18182f]",
  destructive: "bg-red-600 text-white hover:bg-red-700",
  outline: "border border-slate-200 bg-white hover:bg-blue-50 text-slate-900",
  secondary: "bg-blue-50 text-slate-900 hover:bg-blue-100",
  ghost: "hover:bg-blue-50 text-slate-700",
  link: "text-primary underline-offset-4 hover:underline",
};

const sizes = {
  default: "h-10 px-4 py-2",
  sm: "h-8 px-3 text-xs",
  lg: "h-11 px-8",
  icon: "h-10 w-10",
};

export const Button = React.forwardRef(
  ({ className, variant = "default", size = "default", type = "button", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
    <Comp
      ref={ref}
      type={asChild ? undefined : type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        variants[variant] || variants.default,
        sizes[size] || sizes.default,
        className
      )}
      {...props}
    />
  );
  }
);
Button.displayName = "Button";
