"use client";

import { Clock, MapPin, Navigation } from "lucide-react";
import { LiveBadge } from "@/components/live-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";

export function TrackerPreviewCard() {
  return (
    <Card className="glass border-glass-border w-72 overflow-hidden">
      {/* Mini map header */}
      <div className="h-24 bg-gradient-to-br from-slate-800 to-slate-900 relative map-grid-bg">
        {/* Animated marker */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative">
            <div className="absolute -inset-4 rounded-full bg-primary/20 animate-pulse" />
            <div className="w-3 h-3 rounded-full bg-primary animate-glow" />
          </div>
        </div>

        {/* Live badge */}
        <div className="absolute top-2 left-2">
          <LiveBadge size="sm" />
        </div>
      </div>

      {/* Info section */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-primary/20">
            <AvatarFallback className="bg-primary/10 text-primary">
              JD
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">John Doe</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span className="truncate">MG Road, Bangalore</span>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Navigation className="w-3 h-3 text-primary" />
            <span>2.5 km away</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Updated 5s ago</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
