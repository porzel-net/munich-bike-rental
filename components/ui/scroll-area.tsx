"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

const ScrollArea = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} data-slot="scroll-area" className={cn("relative", className)} {...props}>
      <div data-slot="scroll-area-viewport" className="size-full overflow-x-hidden overflow-y-auto overscroll-contain">
        {children}
      </div>
    </div>
  ),
);
ScrollArea.displayName = "ScrollArea";

export { ScrollArea };
