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
import dynamic from "next/dynamic";
import axios from "axios";
import { LiveBadge } from "@/components/live-badge";
import { Navbar } from "@/components/navbar";
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
import { toast } from "sonner";

// ── Dynamic import — SSR disabled (Leaflet is browser-only) ──────────────────
const LiveMap = dynamic(() => import("@/components/live-map"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-secondary/50 flex items-center justify-center min-h-[50vh] lg:min-h-full">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

// ── Haversine formula — outside component so it's not recreated on every render
function getDistanceFromLatLon(lat1, lon1, lat2, lon2) {
  const R    = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(2)} km`;
}

// ── GPS accuracy threshold — below this we consider the lock "good"
const ACCURACY_GOOD_METRES = 50;

// ── Main Page ────────────────────────────────────────────────────────────────
export default function TrackerViewPage({ params }) {
  const { code } = use(params);

  const [trackerData, setTrackerData]           = useState(null);
  const [isLoading, setIsLoading]               = useState(true);
  const [drawerOpen, setDrawerOpen]             = useState(false);
  const [copiedLocation, setCopiedLocation]     = useState(false);
  const [viewerLocation, setViewerLocation]     = useState(null);
  const [calculatedDistance, setCalculatedDistance] = useState(null);
  const [gpsAccuracy, setGpsAccuracy]           = useState(null); // viewer's GPS accuracy

  // ── Fetch initial session + subscribe to Pusher ───────────────────────────
  useEffect(() => {
    let channel;

    const fetchSession = async () => {
      try {
        // ✅ axios instead of fetch
        const { data } = await axios.get(`/api/sessions/${code}`);
        setTrackerData(data.success ? data.session : null);
      } catch {
        setTrackerData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();

    // ── Pusher realtime updates ───────────────────────────────────────────
    const pusher      = getPusherClient();
    const channelName = `session-${code.toUpperCase()}`;
    channel           = pusher.subscribe(channelName);

    channel.bind("location-update", (data) => {
      setTrackerData((prev) => ({ ...prev, ...data }));
    });

    // ✅ FIX: correct Sonner API (was `toast({ title })` — wrong shape)
    channel.bind("session-ended", (data) => {
      toast("Session Ended", {
        description: data?.message ?? "The sharer has stopped sharing their location.",
        position: "top-center",
      });
      setTrackerData(null);
    });

    return () => {
      // ✅ FIX: unbind only THIS channel's events, not the entire pusher client
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [code]); // ✅ FIX: removed `toast` from deps (it's a stable import)

  // ── Track viewer's own location ───────────────────────────────────────────
  useEffect(() => {
    if (!("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setViewerLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        // Track accuracy so we can warn user when GPS lock is poor
        setGpsAccuracy(Math.round(pos.coords.accuracy));
      },
      (err) => console.error("Viewer geolocation error:", err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // ── Recalculate distance when either location changes ────────────────────
  useEffect(() => {
    if (!trackerData?.latitude || !trackerData?.longitude || !viewerLocation) return;

    const dist = getDistanceFromLatLon(
      viewerLocation.lat,
      viewerLocation.lng,
      trackerData.latitude,
      trackerData.longitude
    );
    setCalculatedDistance(formatDistance(dist));
  }, [trackerData?.latitude, trackerData?.longitude, viewerLocation]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const copyLocation = async () => {
    if (!trackerData) return;
    const coords = `${trackerData.latitude}, ${trackerData.longitude}`;
    await navigator.clipboard.writeText(coords);
    setCopiedLocation(true);
    setTimeout(() => setCopiedLocation(false), 2000);
    toast("Location copied", { description: coords, position: "top-center" });
  };

  const openDirections = () => {
    if (!trackerData) return;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${trackerData.latitude},${trackerData.longitude}`,
      "_blank"
    );
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center relative">
        <LiveMap showMarker={false} className="absolute inset-0 opacity-30" />
        <div className="relative z-10 text-center space-y-4">
          <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground font-medium">
            Connecting to session <span className="font-mono">{code}</span>…
          </p>
        </div>
      </div>
    );
  }

  // ── Session ended / invalid code state ────────────────────────────────────
  if (!trackerData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative">
        <LiveMap showMarker={false} className="absolute inset-0 opacity-30" />
        <Card className="relative z-10 p-8 bg-card/80 backdrop-blur-xl border-border shadow-2xl text-center space-y-6 max-w-sm w-full mx-4">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
            <Navigation className="w-8 h-8 text-muted-foreground opacity-50" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Session Ended</h2>
            <p className="text-sm text-muted-foreground">
              This live tracking session has ended or the code is invalid.
            </p>
          </div>
          <Button asChild className="w-full">
            <Link href="/track">Try Another Code</Link>
          </Button>
        </Card>
      </div>
    );
  }

  // ── Shared props for TrackerDetails (desktop + mobile) ────────────────────
  const detailsProps = {
    trackerData,
    calculatedDistance,   // ✅ FIX: was missing in mobile drawer
    gpsAccuracy,
    copiedLocation,
    onCopyLocation:  copyLocation,
    onGetDirections: openDirections,
  };

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="h-[100dvh] relative overflow-hidden">
      {/* Map fills full viewport */}
      <LiveMap
        latitude={trackerData.latitude}
        longitude={trackerData.longitude}
        viewerLatitude={viewerLocation?.lat}
        viewerLongitude={viewerLocation?.lng}
        showViewer={true}
        showPath={true}
        showMarker={true}
        className="absolute inset-0"
      />

      <Navbar>
        <LiveBadge size="sm" />
      </Navbar>

      {/* GPS accuracy warning — shown when viewer's lock is poor */}
      {gpsAccuracy !== null && gpsAccuracy > ACCURACY_GOOD_METRES && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="bg-amber-500/90 text-amber-950 text-xs font-medium px-3 py-1.5 rounded-full backdrop-blur-sm shadow">
            Poor GPS signal (±{gpsAccuracy}m) — distance may be inaccurate
          </div>
        </div>
      )}

      {/* Desktop: session info card (top-right) */}
      <div className="fixed top-24 right-4 z-20 hidden md:block">
        <Card className="glass border-border/50 p-4 w-64 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-primary/20 shadow-sm">
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {trackerData.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{trackerData.name}</p>
              <p className="text-xs text-muted-foreground font-mono">Code: {code}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground font-medium">
            <div className="flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-primary" />
              <span>{calculatedDistance ?? "Calculating…"} away</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>{trackerData.lastUpdated}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Mobile: bottom sheet ── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 lg:hidden pointer-events-auto">
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerTrigger asChild>
            <div className="glass border-t border-border/50 rounded-t-3xl p-5 cursor-pointer shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12 border-2 border-primary/20 shadow-sm">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {trackerData.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-foreground text-lg">
                      {trackerData.name === "My Live Location" ? "Target Device" : trackerData.name}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-primary" />
                      <span className="truncate max-w-[200px]">
                        {trackerData.address ?? "Live Location Active"}
                      </span>
                    </p>
                  </div>
                </div>
                <ChevronUp className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
          </DrawerTrigger>

          <DrawerContent className="bg-card border-border">
            <DrawerHeader className="pb-2">
              <DrawerTitle className="text-foreground">Tracking Details</DrawerTitle>
            </DrawerHeader>
            <div className="p-4 space-y-4">
              {/* ✅ FIX: calculatedDistance now passed here too */}
              <TrackerDetails {...detailsProps} />
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {/* Desktop: bottom-right details panel */}
      <div className="fixed bottom-6 right-6 z-20 hidden lg:block pointer-events-none">
        <Card className="glass border-border/50 p-6 max-w-2xl shadow-2xl backdrop-blur-xl pointer-events-auto rounded-2xl">
          <TrackerDetails {...detailsProps} />
        </Card>
      </div>
    </div>
  );
}

// ── TrackerDetails ────────────────────────────────────────────────────────────
// Single source of truth for both mobile + desktop panels
function TrackerDetails({
  trackerData,
  calculatedDistance,
  gpsAccuracy,
  copiedLocation,
  onCopyLocation,
  onGetDirections,
}) {
  const displayName =
    trackerData.name === "My Live Location" ? "Target Device" : trackerData.name;

  return (
    <div className="space-y-6">
      {/* User info — desktop only (mobile shows it in drawer trigger) */}
      <div className="hidden lg:flex items-center gap-4">
        <Avatar className="h-14 w-14 border-2 border-primary/20 shadow-sm">
          <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
            {trackerData.initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="text-xl font-semibold text-foreground">{displayName}</p>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
            <MapPin className="w-4 h-4 text-primary" />
            {trackerData.address ?? "Live Location Active"}
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Gauge} label="Speed" value={trackerData.speed ?? "0 km/h"} />
        <StatCard
          icon={Navigation}
          label="Distance"
          value={calculatedDistance ?? "—"}
          // Dim if GPS accuracy is poor (distance will be unreliable)
          muted={gpsAccuracy !== null && gpsAccuracy > 50}
        />
        <StatCard
          icon={Battery}
          label="Battery"
          value={`${trackerData.battery ?? 100}%`}
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          onClick={onGetDirections}
          className="flex-1 h-12 text-base font-medium shadow-lg shadow-primary/25"
        >
          <ExternalLink className="mr-2 h-5 w-5" />
          Get Directions
        </Button>
        <Button
          variant="outline"
          onClick={onCopyLocation}
          className="flex-1 h-12 text-base font-medium border-border/50"
        >
          {copiedLocation ? (
            <><Check className="mr-2 h-5 w-5 text-primary" />Copied!</>
          ) : (
            <><Copy className="mr-2 h-5 w-5" />Copy Location</>
          )}
        </Button>
      </div>

      {/* Last updated */}
      <p className="text-xs text-center text-muted-foreground font-medium flex items-center justify-center gap-1.5">
        <Clock className="w-3.5 h-3.5" />
        Last updated: {trackerData.lastUpdated}
      </p>
    </div>
  );
}

// ── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, muted = false }) {
  return (
    <div className="bg-card border border-border shadow-sm rounded-xl p-4 text-center">
      <Icon className="w-6 h-6 text-primary mx-auto mb-2" />
      <p className={`text-base font-semibold ${muted ? "text-muted-foreground" : "text-foreground"}`}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground font-medium mt-1">{label}</p>
    </div>
  );
}