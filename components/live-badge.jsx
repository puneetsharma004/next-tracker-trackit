"use client";

import { cn } from "@/lib/utils";

export function LiveBadge({ className, size = "md" }) {
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  const dotSizes = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-2.5 h-2.5",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 font-medium text-primary",
        sizeClasses[size],
        className,
      )}
    >
      <span className="relative flex">
        <span
          className={cn(
            "absolute inline-flex rounded-full bg-primary opacity-75 animate-ping",
            dotSizes[size],
          )}
        />
        <span
          className={cn(
            "relative inline-flex rounded-full bg-primary",
            dotSizes[size],
          )}
        />
      </span>
      Live
    </div>
  );
}
