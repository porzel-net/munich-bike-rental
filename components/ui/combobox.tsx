"use client";

import * as React from "react";
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { CheckIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const Combobox = ComboboxPrimitive.Root;

function ComboboxChips({ className, ...props }: React.ComponentProps<typeof ComboboxPrimitive.Chips>) {
  return (
    <ComboboxPrimitive.Chips
      className={cn(
        "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-4xl border border-input bg-background px-2 py-1 text-sm shadow-xs outline-none focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxChip({ className, children, ...props }: React.ComponentProps<typeof ComboboxPrimitive.Chip>) {
  return (
    <ComboboxPrimitive.Chip
      className={cn("inline-flex h-6 items-center gap-1 rounded-full bg-muted px-2 text-xs", className)}
      {...props}
    >
      <span className="max-w-32 truncate">{children}</span>
      <ComboboxPrimitive.ChipRemove
        aria-label="Status entfernen"
        className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
      >
        <XIcon className="size-3" />
      </ComboboxPrimitive.ChipRemove>
    </ComboboxPrimitive.Chip>
  );
}

function ComboboxChipsInput({ className, ...props }: React.ComponentProps<typeof ComboboxPrimitive.Input>) {
  return (
    <ComboboxPrimitive.Input
      className={cn("min-w-20 flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none", className)}
      {...props}
    />
  );
}

function ComboboxInput({ className, ...props }: React.ComponentProps<typeof ComboboxPrimitive.Input>) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-input"
      className={cn(
        "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxContent({ className, children, ...props }: React.ComponentProps<typeof ComboboxPrimitive.Popup>) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner side="bottom" align="start" sideOffset={4} className="z-50">
        <ComboboxPrimitive.Popup
          className={cn(
            "w-(--anchor-width) min-w-56 overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-xl outline-none",
            className,
          )}
          {...props}
        >
          {children}
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

function ComboboxList({ className, ...props }: React.ComponentProps<typeof ComboboxPrimitive.List>) {
  return <ComboboxPrimitive.List className={cn("max-h-72 overflow-y-auto", className)} {...props} />;
}

function ComboboxItem({ className, children, ...props }: React.ComponentProps<typeof ComboboxPrimitive.Item>) {
  return (
    <ComboboxPrimitive.Item
      className={cn(
        "flex cursor-default items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-selected:font-medium",
        className,
      )}
      {...props}
    >
      <ComboboxPrimitive.ItemIndicator className="flex size-4 items-center justify-center">
        <CheckIcon className="size-4" />
      </ComboboxPrimitive.ItemIndicator>
      <span className="min-w-0 flex-1">{children}</span>
    </ComboboxPrimitive.Item>
  );
}

function ComboboxEmpty({ className, ...props }: React.ComponentProps<typeof ComboboxPrimitive.Empty>) {
  return <ComboboxPrimitive.Empty className={cn("px-2 py-3 text-sm text-muted-foreground", className)} {...props} />;
}

export {
  Combobox,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
};
