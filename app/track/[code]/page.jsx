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
import { LiveBadge } from "@/components/live-badge";
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

import { toast } from "sonner"

// Dynamically import LiveMap with SSR disabled
const LiveMap = dynamic(() => import("@/components/live-map"), { 
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-secondary/50 flex items-center justify-center min-h-[50vh] lg:min-h-full">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
});

export default function TrackerViewPage({ params }) {
  const { code } = use(params);
  const [trackerData, setTrackerData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copiedLocation, setCopiedLocation] = useState(false);
  const [viewerLocation, setViewerLocation] = useState(null);
  const [calculatedDistance, setCalculatedDistance] = useState(null);

  // Haversine formula
  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

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

  // Track viewer's own location
  useEffect(() => {
    let watchId;
    if ("geolocation" in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setViewerLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => console.error("Error getting viewer location:", err),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Calculate distance when either location changes
  useEffect(() => {
    if (trackerData?.latitude && trackerData?.longitude && viewerLocation) {
      const dist = getDistanceFromLatLonInKm(
        viewerLocation.lat,
        viewerLocation.lng,
        trackerData.latitude,
        trackerData.longitude
      );
      // Format to 2 decimal places if > 1km, or meters if < 1km
      if (dist < 1) {
        setCalculatedDistance(`${Math.round(dist * 1000)} m`);
      } else {
        setCalculatedDistance(`${dist.toFixed(2)} km`);
      }
    }
  }, [trackerData?.latitude, trackerData?.longitude, viewerLocation]);

  const copyLocation = async () => {
    if (!trackerData) return;
    await navigator.clipboard.writeText(
      `${trackerData.latitude}, ${trackerData.longitude}`,
    );
    setCopiedLocation(true);
    setTimeout(() => setCopiedLocation(false), 2000);
    toast("Location copied successfully", {
      description: `${trackerData.latitude}, ${trackerData.longitude}`,
      variant: "default",
    })
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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center relative">
        <LiveMap showMarker={false} className="w-full h-full opacity-30" />
        <div className="relative z-10 text-center space-y-4">
          <div className="w-12 h-12 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground font-medium">
            Connecting to session {code}...
          </p>
        </div>
      </div>
    );
  }

  if (!trackerData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative">
        <LiveMap showMarker={false} className="w-full h-full opacity-30" />
        <Card className="relative z-10 p-8 bg-card/80 backdrop-blur-xl border-border shadow-2xl text-center space-y-6 max-w-sm w-full mx-4">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-2">
            <Navigation className="w-8 h-8 text-muted-foreground opacity-50" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Session Ended</h2>
            <p className="text-sm text-muted-foreground">This live tracking session has ended or the code is invalid.</p>
          </div>
          <Button asChild className="w-full">
            <Link href="/track">Try Another Code</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
     <div className="h-[100dvh] relative overflow-hidden">
    {/* Map fills parent absolutely */}
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
      
      {/* Top-left: Logo + Live badge */}
      <div className="fixed top-4 left-4 z-20 pointer-events-auto">
        <Link href="/" className="flex items-center gap-3">
          <div className="glass rounded-xl px-4 py-2 flex items-center gap-3 shadow-lg border border-border/50">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-inner">
                <MapPin className="w-4 h-4 text-primary-foreground" />
              </div>
            </div>
            <span className="text-lg font-semibold text-foreground tracking-tight">
              TrackIt
            </span>
            <LiveBadge size="sm" />
          </div>
        </Link>
      </div>

      {/* Top-right: Session info card */}
      <div className="fixed top-4 right-4 z-20 pointer-events-auto hidden sm:block">
        <Card className="glass border-border/50 p-4 w-64 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-primary/20 shadow-sm">
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
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
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground font-medium">
            <div className="flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-primary" />
              <span>{calculatedDistance || "Calculating..."} away</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>{trackerData.lastUpdated}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Mobile Bottom Sheet */}
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
                        {trackerData.address || "Live Location Active"}
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
      <div className="fixed bottom-6 left-6 right-6 z-20 hidden lg:block pointer-events-none">
        <Card className="glass border-border/50 p-6 max-w-2xl mx-auto shadow-2xl backdrop-blur-xl pointer-events-auto rounded-2xl">
          <TrackerDetails
            trackerData={trackerData}
            calculatedDistance={calculatedDistance}
            onCopyLocation={copyLocation}
            onGetDirections={openDirections}
            copiedLocation={copiedLocation}
          />
        </Card>
      </div>
    </div>
  );
}

function TrackerDetails({
  trackerData,
  calculatedDistance,
  onCopyLocation,
  onGetDirections,
  copiedLocation,
}) {
  return (
    <div className="space-y-6">
      {/* User info (Desktop only, mobile shows it in the trigger) */}
      <div className="hidden lg:flex items-center gap-4">
        <Avatar className="h-14 w-14 border-2 border-primary/20 shadow-sm">
          <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
            {trackerData.initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="text-xl font-semibold text-foreground">
            {trackerData.name === "My Live Location" ? "Target Device" : trackerData.name}
          </p>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
            <MapPin className="w-4 h-4 text-primary" />
            {trackerData.address || "Live Location Active"}
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border shadow-sm rounded-xl p-4 text-center">
          <Gauge className="w-6 h-6 text-primary mx-auto mb-2" />
          <p className="text-base font-semibold text-foreground">
            {trackerData.speed || "0 km/h"}
          </p>
          <p className="text-xs text-muted-foreground font-medium mt-1">Speed</p>
        </div>
        <div className="bg-card border border-border shadow-sm rounded-xl p-4 text-center">
          <Navigation className="w-6 h-6 text-primary mx-auto mb-2" />
          <p className="text-base font-semibold text-foreground">
            {calculatedDistance || "0 km"}
          </p>
          <p className="text-xs text-muted-foreground font-medium mt-1">Distance</p>
        </div>
        <div className="bg-card border border-border shadow-sm rounded-xl p-4 text-center">
          <Battery className="w-6 h-6 text-primary mx-auto mb-2" />
          <p className="text-base font-semibold text-foreground">
            {trackerData.battery ?? 100}%
          </p>
          <p className="text-xs text-muted-foreground font-medium mt-1">Battery</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          onClick={onGetDirections}
          className="flex-1 h-12 text-base font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25"
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
            <>
              <Check className="mr-2 h-5 w-5 text-primary" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="mr-2 h-5 w-5" />
              Copy Location
            </>
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
