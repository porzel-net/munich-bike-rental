import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn("flex w-full flex-col items-center justify-center gap-6 text-center", className)}
      {...props}
    />
  );
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn("flex max-w-sm flex-col items-center gap-2 text-center", className)}
      {...props}
    />
  );
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 data-slot="empty-title" className={cn("text-lg font-medium tracking-tight", className)} {...props} />;
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="empty-description"
      className={cn("text-sm leading-normal text-muted-foreground", className)}
      {...props}
    />
  );
}

const emptyMediaVariants = cva("flex items-center justify-center", {
  variants: {
    variant: {
      default: "",
      icon: "size-10 shrink-0 rounded-2xl bg-muted text-foreground [&_svg:not([class*='size-'])]:size-5",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function EmptyMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-media"
      data-variant={variant}
      className={cn(emptyMediaVariants({ variant, className }))}
      {...props}
    />
  );
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn("flex w-full max-w-sm min-w-0 flex-col items-center justify-center gap-3 text-sm", className)}
      {...props}
    />
  );
}

export { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle };
