import * as React from "react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const attachmentVariants = cva(
  "group/attachment relative flex max-w-full min-w-0 shrink-0 flex-wrap rounded-xl border bg-card text-card-foreground transition-colors has-[>a,>button]:hover:bg-muted/50 data-[state=error]:border-destructive/30 data-[state=idle]:border-dashed",
  {
    variants: {
      size: {
        default: "min-h-16 gap-3 p-2.5",
        sm: "min-h-12 gap-2 p-2 text-sm",
        xs: "min-h-9 gap-1.5 p-1.5 text-xs",
      },
      orientation: {
        horizontal: "items-center",
        vertical: "flex-col",
      },
    },
    defaultVariants: { size: "default", orientation: "horizontal" },
  },
);

function Attachment({
  className,
  state = "done",
  size = "default",
  orientation = "horizontal",
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof attachmentVariants> & {
    state?: "idle" | "uploading" | "processing" | "error" | "done";
  }) {
  return (
    <div
      data-slot="attachment"
      data-state={state}
      data-size={size}
      data-orientation={orientation}
      className={cn(attachmentVariants({ size, orientation }), className)}
      {...props}
    />
  );
}

const attachmentMediaVariants = cva(
  "relative flex aspect-square size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-muted-foreground group-data-[state=error]/attachment:bg-destructive/10 group-data-[state=error]/attachment:text-destructive [&_svg]:size-5 [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        icon: "",
        image: "*:[img]:aspect-square *:[img]:w-full *:[img]:object-cover",
      },
    },
    defaultVariants: { variant: "icon" },
  },
);

function AttachmentMedia({
  className,
  variant = "icon",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof attachmentMediaVariants>) {
  return (
    <div
      data-slot="attachment-media"
      data-variant={variant}
      className={cn(attachmentMediaVariants({ variant }), className)}
      {...props}
    />
  );
}

function AttachmentContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="attachment-content" className={cn("min-w-0 flex-1", className)} {...props} />;
}

function AttachmentTitle({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="attachment-title"
      className={cn(
        "block max-w-full min-w-0 truncate group-data-[state=processing]/attachment:animate-pulse group-data-[state=uploading]/attachment:animate-pulse",
        className,
      )}
      {...props}
    />
  );
}

function AttachmentDescription({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="attachment-description"
      className={cn("block max-w-full min-w-0 truncate text-muted-foreground", className)}
      {...props}
    />
  );
}

function AttachmentActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="attachment-actions"
      className={cn("relative z-20 flex shrink-0 items-center gap-0.5", className)}
      {...props}
    />
  );
}

function AttachmentAction({ className, variant, size = "icon-xs", ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="attachment-action"
      variant={variant ?? "ghost"}
      size={size}
      className={cn("relative z-20", className)}
      {...props}
    />
  );
}

function AttachmentTrigger({ className, render, type, ...props }: useRender.ComponentProps<"button">) {
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      {
        type: render ? type : (type ?? "button"),
        className: cn(
          "absolute inset-0 z-10 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
          className,
        ),
      },
      props,
    ),
    render,
    state: { slot: "attachment-trigger" },
  });
}

function AttachmentGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="attachment-group" className={cn("grid min-w-0 gap-2", className)} {...props} />;
}

export {
  Attachment,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  AttachmentDescription,
  AttachmentActions,
  AttachmentAction,
  AttachmentTrigger,
};
