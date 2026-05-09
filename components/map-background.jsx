"use client";

import { cn } from "@/lib/utils";

export function MapBackground({ className, children, showMarker = false }) {
  return (
    <div className={cn("relative overflow-hidden bg-background", className)}>
      {/* Map gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-muted/30 to-background" />

      {/* Grid lines overlay */}
      <div className="absolute inset-0 map-grid-bg" />

      {/* Subtle radial gradient for depth */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent dark:from-emerald-900/20" />

      {/* Animated route lines */}
      <svg
        className="absolute inset-0 w-full h-full opacity-20"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Animated route lines"
      >
        <title>Animated route lines</title>
        <defs>
          <linearGradient
            id="routeGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0" />
            <stop offset="50%" stopColor="rgb(16, 185, 129)" stopOpacity="1" />
            <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,400 Q200,350 400,400 T800,350 T1200,400 T1600,350"
          stroke="url(#routeGradient)"
          strokeWidth="2"
          fill="none"
          className="animate-pulse"
        />
        <path
          d="M0,500 Q300,450 600,500 T1200,450 T1800,500"
          stroke="url(#routeGradient)"
          strokeWidth="1.5"
          fill="none"
          className="animate-pulse"
          style={{ animationDelay: "0.5s" }}
        />
      </svg>

      

      {/* Content overlay */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
