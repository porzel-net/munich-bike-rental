import * as React from "react";

import { cn } from "@/lib/utils";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-border bg-muted px-1.5 font-mono text-[0.7rem] font-medium text-muted-foreground shadow-[0_1px_0_1px] shadow-black/10 select-none",
        className,
      )}
      {...props}
    />
  );
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="kbd-group" className={cn("flex items-center gap-1", className)} {...props} />;
}

export { Kbd, KbdGroup };
