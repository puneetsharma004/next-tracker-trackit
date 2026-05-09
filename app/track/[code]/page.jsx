"use client";

import {
  Battery,
  Check,
  ChevronUp,
  Clock,
  Copy,
  ExternalLink,
  Gauge,
  MapPin,
  Navigation,
} from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { LiveBadge } from "@/components/live-badge";
import { MapBackground } from "@/components/map-background";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { getPusherClient } from "@/lib/pusher";
import { useToast } from "@/hooks/use-toast";

export default function TrackerViewPage({ params }) {
  const { code } = use(params);
  const [trackerData, setTrackerData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copiedLocation, setCopiedLocation] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Fetch initial tracker data
    const fetchSession = async () => {
      try {
        const res = await fetch(`/api/sessions/${code}`);
        const data = await res.json();
        
        if (data.success) {
          setTrackerData(data.session);
        } else {
          setTrackerData(null);
        }
      } catch (err) {
        console.error(err);
        setTrackerData(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSession();

    // Setup Pusher
    const pusher = getPusherClient();
    const channelName = `session-${code.toUpperCase()}`;
    const channel = pusher.subscribe(channelName);

    channel.bind("location-update", (data) => {
      setTrackerData((prev) => ({
        ...prev,
        ...data,
      }));
    });

    channel.bind("session-ended", (data) => {
      toast({ title: "Session Ended", description: data.message });
      setTrackerData(null); // Clear data to show ended screen
    });

    return () => {
      pusher.unsubscribe(channelName);
      pusher.unbind_all();
    };
  }, [code, toast]);

  const copyLocation = async () => {
    if (!trackerData) return;
    await navigator.clipboard.writeText(
      `${trackerData.latitude}, ${trackerData.longitude}`,
    );
    setCopiedLocation(true);
    setTimeout(() => setCopiedLocation(false), 2000);
  };

  const openDirections = () => {
    if (!trackerData) return;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${trackerData.latitude},${trackerData.longitude}`,
      "_blank",
    );
  };

  if (isLoading) {
    return (
      <MapBackground className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">
            Connecting to session {code}...
          </p>
        </div>
      </MapBackground>
    );
  }

  if (!trackerData) {
    return (
      <MapBackground className="min-h-screen flex items-center justify-center">
        <Card className="p-6 bg-card/80 backdrop-blur-xl border-border text-center space-y-4">
          <p className="text-foreground">Session not found or has expired.</p>
          <Button asChild>
            <Link href="/track">Try Another Code</Link>
          </Button>
        </Card>
      </MapBackground>
    );
  }

  return (
    <MapBackground className="min-h-screen" showMarker>
      {/* Top-left: Logo + Live badge */}
      <div className="fixed top-4 left-4 z-20">
        <Link href="/" className="flex items-center gap-3">
          <div className="glass rounded-xl px-4 py-2 flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <MapPin className="w-4 h-4 text-primary-foreground" />
              </div>
            </div>
            <span className="text-lg font-semibold text-foreground">
              TrackIt
            </span>
            <LiveBadge size="sm" />
          </div>
        </Link>
      </div>

      {/* Top-right: Session info card */}
      <div className="fixed top-4 right-4 z-20">
        <Card className="glass border-glass-border p-4 w-64">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary">
                {trackerData.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">
                {trackerData.name}
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                Code: {code}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Navigation className="w-3 h-3 text-primary" />
              <span>{trackerData.distance} away</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{trackerData.lastUpdated}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Mobile Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-20 lg:hidden">
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerTrigger asChild>
            <div className="glass border-t border-glass-border rounded-t-2xl p-4 cursor-pointer">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border-2 border-primary/20">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {trackerData.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground">
                      {trackerData.name}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate max-w-[180px]">
                        {trackerData.address}
                      </span>
                    </p>
                  </div>
                </div>
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </DrawerTrigger>

          <DrawerContent className="bg-card border-border">
            <DrawerHeader>
              <DrawerTitle className="text-foreground">
                Tracking Details
              </DrawerTitle>
            </DrawerHeader>
            <div className="p-4 space-y-4">
              <TrackerDetails
                trackerData={trackerData}
                onCopyLocation={copyLocation}
                onGetDirections={openDirections}
                copiedLocation={copiedLocation}
              />
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {/* Desktop Bottom Panel */}
      <div className="fixed bottom-4 left-4 right-4 z-20 hidden lg:block">
        <Card className="glass border-glass-border p-6 max-w-2xl mx-auto">
          <TrackerDetails
            trackerData={trackerData}
            onCopyLocation={copyLocation}
            onGetDirections={openDirections}
            copiedLocation={copiedLocation}
          />
        </Card>
      </div>
    </MapBackground>
  );
}

function TrackerDetails({
  trackerData,
  onCopyLocation,
  onGetDirections,
  copiedLocation,
}) {
  return (
    <div className="space-y-4">
      {/* User info */}
      <div className="flex items-center gap-4">
        <Avatar className="h-14 w-14 border-2 border-primary/20">
          <AvatarFallback className="bg-primary/10 text-primary text-lg">
            {trackerData.initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="text-lg font-semibold text-foreground">
            {trackerData.name}
          </p>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            {trackerData.address}
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-secondary/50 rounded-xl p-3 text-center">
          <Gauge className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-sm font-medium text-foreground">
            {trackerData.speed}
          </p>
          <p className="text-xs text-muted-foreground">Speed</p>
        </div>
        <div className="bg-secondary/50 rounded-xl p-3 text-center">
          <Navigation className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-sm font-medium text-foreground">
            {trackerData.distance}
          </p>
          <p className="text-xs text-muted-foreground">Distance</p>
        </div>
        <div className="bg-secondary/50 rounded-xl p-3 text-center">
          <Battery className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-sm font-medium text-foreground">
            {trackerData.battery}%
          </p>
          <p className="text-xs text-muted-foreground">Battery</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          onClick={onGetDirections}
          className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Get Directions
        </Button>
        <Button variant="outline" onClick={onCopyLocation} className="flex-1">
          {copiedLocation ? (
            <>
              <Check className="mr-2 h-4 w-4 text-primary" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Copy Location
            </>
          )}
        </Button>
      </div>

      {/* Last updated */}
      <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
        <Clock className="w-3 h-3" />
        Last updated: {trackerData.lastUpdated}
      </p>
    </div>
  );
}
