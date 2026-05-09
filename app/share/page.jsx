"use client";

import {
  Check,
  Copy,
  Link as LinkIcon,
  MapPin,
  QrCode,
  Signal,
  Square,
  Play, Share2, ChevronUp, Link,
} from "lucide-react";
import { toast } from "sonner"
import { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { LiveBadge } from "@/components/live-badge";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import QRCode from "react-qr-code";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";

// Dynamically import LiveMap with SSR disabled
const LiveMap = dynamic(() => import("@/components/live-map"), { 
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-secondary/50 flex items-center justify-center min-h-[50vh] lg:min-h-full">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
});

export default function ShareLocationPage() {
  const [sessionCode, setSessionCode] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showStopDialog, setShowStopDialog] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [currentAddress, setCurrentAddress] = useState("Fetching location...");
  const [accuracy, setAccuracy] = useState(0);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Coordinate State for Map
  const [coords, setCoords] = useState(null);

  const sessionRef = useRef(null);
  const actualCoordsRef = useRef(null);

  const getAddressFromCoords = async (latitude, longitude) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
      const data = await response.json();
      if (data && data.display_name) {
        return data.display_name;
      }
    } catch (err) {
      console.error("Reverse geocoding error:", err);
    }
    return "Live Location Active";
  };

  const startSharing = useCallback(async (lat, lng, acc, speed = 0, batteryLevel = 100, addressStr = "Live Location Active") => {
    try {
      const res = await fetch("/api/sessions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "My Live Location",
          initials: "ME",
          latitude: lat,
          longitude: lng,
          speed: `${speed} km/h`,
          battery: batteryLevel,
          address: addressStr,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setSessionCode(data.session.code);
        sessionRef.current = data.session.code;
        setIsLive(true);
        setCurrentAddress(addressStr);
        setAccuracy(acc);
      } else {
        toast({ title: "Error", description: "Failed to create session." });
      }
    } catch (err) {
      console.error("Init Error", err);
      toast({ title: "Error", description: "Network error." });
    }
  }, [toast]);

  // Initialize session and geolocation
  useEffect(() => {
    let watchId;

    if ("geolocation" in navigator) {
      // Get initial position to start session
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const acc = Math.round(position.coords.accuracy);
          const speed = position.coords.speed ? Math.round(position.coords.speed * 3.6) : 0;
          
          let batteryLevel = 100;
          try {
            if ('getBattery' in navigator) {
              const battery = await navigator.getBattery();
              batteryLevel = Math.round(battery.level * 100);
            }
          } catch (e) {}

          const fetchedAddress = await getAddressFromCoords(lat, lng);
          setCurrentAddress(fetchedAddress);

          setCoords({ lat, lng });
          actualCoordsRef.current = { lat, lng, acc, speed, address: fetchedAddress };
          
          await startSharing(lat, lng, acc, speed, batteryLevel, fetchedAddress);
          setLoading(false);
          
          // Watch for changes
          watchId = navigator.geolocation.watchPosition(
            (pos) => {
              const newLat = pos.coords.latitude;
              const newLng = pos.coords.longitude;
              const newAcc = Math.round(pos.coords.accuracy);
              const speed = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0; // m/s to km/h
              setCoords({ lat: newLat, lng: newLng });
              setAccuracy(newAcc);
              actualCoordsRef.current = { 
                ...actualCoordsRef.current,
                lat: newLat, 
                lng: newLng, 
                acc: newAcc, 
                speed 
              };
            },
            // (err) => console.error(err),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
          );
        },
        (error) => {
          // console.error(error);
          // toast({ title: "Location Error", description: "Please allow location access to share your live location." });
          setLoading(false);
        },
        { enableHighAccuracy: true }
      );
    } else {
      toast({ title: "Error", description: "Geolocation not supported by your browser." });
      setLoading(false);
    }
    
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (sessionRef.current) {
        // Cleanup on unmount
        fetch(`/api/sessions/${sessionRef.current}`, { method: "DELETE" }).catch(()=>null);
      }
    };
  }, [startSharing, toast]);

  // Poll location updates to server
  useEffect(() => {
    if (!isLive || !sessionCode) return;
    
    const interval = setInterval(async () => {
      if (!actualCoordsRef.current) return;
      const { lat, lng, speed } = actualCoordsRef.current;
      
      let currentBattery = 100;
      try {
        if ('getBattery' in navigator) {
          const battery = await navigator.getBattery();
          currentBattery = Math.round(battery.level * 100);
        }
      } catch (e) {}

      // Push update to server
      fetch("/api/location/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: sessionCode,
          latitude: lat,
          longitude: lng,
          speed: `${speed} km/h`,
          distance: "Live tracking...",
          battery: currentBattery,
          address: actualCoordsRef.current?.address || "Live Location Active",
        }),
      }).catch(err => console.error("Update Error", err));
    }, 5000); // Every 5 seconds
    
    return () => clearInterval(interval);
  }, [isLive, sessionCode]);

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/track?code=${sessionCode}`
      : "";

  const copyCode = async () => {
    await navigator.clipboard.writeText(sessionCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    toast("Code copied successfully", {
          description: sessionCode,
          variant: "default",
    })
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast("Link copied successfully", {
          description: shareUrl,
          variant: "default",
    })
  };

  const stopSharing = async () => {
    if (!sessionCode) return;
    
    try {
      await fetch(`/api/sessions/${sessionCode}`, { method: "DELETE" });
      setIsLive(false);
      setShowStopDialog(false);
      setSessionCode("");
      sessionRef.current = null;
      setCurrentAddress("Tracking Stopped");
      toast({ title: "Session Ended", description: "Your location is no longer shared." });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to stop session." });
    }
  };

  const handleStartSharingClick = () => {
    if (actualCoordsRef.current) {
      const { lat, lng, acc } = actualCoordsRef.current;
      startSharing(lat, lng, acc);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  // If location access was denied, coords will be null
  if (!coords) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <MapPin className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
          <h2 className="text-xl font-semibold mb-2">Location Access Required</h2>
          <p className="text-muted-foreground max-w-md">
            We need access to your location to share it with others. Please enable location permissions in your browser and refresh the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 min-h-screen pb-6">
        <div className="flex flex-col lg:flex-row h-full lg:min-h-[calc(100vh-9rem)] px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto gap-6">
          {/* Map Section */}
          <div className="flex-1 relative z-0 rounded-3xl overflow-hidden border border-border shadow-2xl">
            <LiveMap
              latitude={coords.lat}
              longitude={coords.lng}
              showMarker={isLive}
              className="h-full min-h-[50vh] lg:min-h-full w-full"
            >
              {/* Bottom bar overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-auto">
                <div className="glass rounded-xl p-4 flex flex-wrap items-center gap-4 text-sm shadow-xl backdrop-blur-xl border border-border">
                  <div className="flex items-center gap-2">
                    <Signal
                      className={`w-4 h-4 ${accuracy > 0 ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <span className="text-muted-foreground font-medium">
                      Accuracy: {accuracy > 0 ? `±${accuracy}m` : "..."}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${isLive ? "bg-primary animate-pulse" : "bg-destructive"}`}
                    />
                    <span className="text-muted-foreground font-medium">
                      GPS {isLive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-foreground font-medium truncate">
                      {currentAddress}
                    </span>
                  </div>
                </div>
              </div>
            </LiveMap>
          </div>

          {/* Control Panel */}
          <div className="w-full lg:w-[400px] flex flex-col space-y-4 z-10 hidden lg:block">
            <Card className="bg-card border-border shadow-xl rounded-3xl flex-1">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-foreground">
                    Your Live Session
                  </CardTitle>
                  {isLive && <LiveBadge size="sm" />}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Session Code */}
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground font-medium">
                    Session Code
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-secondary/50 border border-border rounded-lg p-4 text-center">
                      <span className="font-mono text-3xl font-bold tracking-[0.3em] text-foreground">
                        {sessionCode || "ENDED"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Copy buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={copyCode}
                    className="w-full h-12"
                    disabled={!isLive}
                  >
                    {copiedCode ? (
                      <>
                        <Check className="mr-2 h-4 w-4 text-primary" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Code
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={copyLink}
                    className="w-full h-12"
                    disabled={!isLive}
                  >
                    {copiedLink ? (
                      <>
                        <Check className="mr-2 h-4 w-4 text-primary" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Copy Link
                      </>
                    )}
                  </Button>
                </div>

                {/* QR Code Section */}
                  <div className="space-y-3">
                    <Button
                      variant="secondary"
                      onClick={() => setShowQR(!showQR)}
                      className="w-full h-12 transition-all duration-300"
                      disabled={!isLive}
                    >
                      <QrCode className="mr-2 h-4 w-4" />
                      {showQR ? "Hide QR Code" : "Show QR Code"}
                    </Button>

                    <div
                      className={`
                        overflow-hidden transition-all duration-500 ease-in-out
                        ${showQR && isLive
                          ? "max-h-96 opacity-100 scale-100 translate-y-0"
                          : "max-h-0 opacity-0 scale-95 -translate-y-2"
                        }
                      `}
                    >
                      <div className="flex justify-center p-6 bg-white rounded-2xl shadow-inner">
                        <QRCode
                          value={shareUrl}
                          size={160}
                          bgColor="#ffffff"
                          fgColor="#0a0a0f"
                        />
                      </div>
                    </div>
                  </div>

                {/* Stop/Start Sharing Button */}
                {isLive ? (
                  <Button
                    variant="destructive"
                    onClick={() => setShowStopDialog(true)}
                    className="w-full h-12 font-medium shadow-lg shadow-destructive/20"
                  >
                    <Square className="mr-2 h-4 w-4 fill-current" />
                    Stop Sharing
                  </Button>
                ) : (
                  <Button
                    onClick={handleStartSharingClick}
                    className="w-full h-12 font-medium bg-[#10b981] hover:bg-[#059669] text-white shadow-lg shadow-emerald-500/20"
                  >
                    <Play className="mr-2 h-4 w-4 fill-current" />
                    Start Sharing
                  </Button>
                )}

                {!isLive && (
                  <p className="text-center text-sm text-muted-foreground font-medium bg-secondary/50 p-3 rounded-lg">
                    Session ended. Click start to generate a new live session code.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Stop Sharing Dialog */}
      <Dialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground text-xl">
              Stop Sharing Location?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground pt-2">
              This will end your live session immediately. Anyone currently tracking you will no
              longer see your live location.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setShowStopDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={stopSharing}>
              Yes, Stop Sharing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-0 left-0 right-0 z-20 lg:hidden">
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          
          {/* Peek bar — always visible at bottom */}
          <DrawerTrigger asChild>
            <div className="glass border-t border-border/50 rounded-t-3xl p-5 cursor-pointer shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Share2 className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-semibold text-foreground">Share Your Location</p>
                    <p className="text-sm text-muted-foreground">Code: {sessionCode}</p>
                  </div>
                </div>
                <ChevronUp className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
          </DrawerTrigger>

          {/* Full drawer content */}
          <DrawerContent className="bg-card border-border">
            <DrawerHeader className="pb-2">
              <DrawerTitle>Share Details</DrawerTitle>
            </DrawerHeader>
            <div className="p-4 space-y-4">
              {/* Control Panel */}
          <div className="w-full lg:w-[400px] flex flex-col space-y-4 z-10 lg:hidden block">
            <Card className="bg-card border-border shadow-xl rounded-3xl flex-1">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-foreground">
                    Your Live Session
                  </CardTitle>
                  {isLive && <LiveBadge size="sm" />}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Session Code */}
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground font-medium">
                    Session Code
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-secondary/50 border border-border rounded-lg p-4 text-center">
                      <span className="font-mono text-3xl font-bold tracking-[0.3em] text-foreground">
                        {sessionCode || "ENDED"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Copy buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={copyCode}
                    className="w-full h-12"
                    disabled={!isLive}
                  >
                    {copiedCode ? (
                      <>
                        <Check className="mr-2 h-4 w-4 text-primary" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Code
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={copyLink}
                    className="w-full h-12"
                    disabled={!isLive}
                  >
                    {copiedLink ? (
                      <>
                        <Check className="mr-2 h-4 w-4 text-primary" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Copy Link
                      </>
                    )}
                  </Button>
                </div>

                {/* QR Code Section */}
                  <div className="space-y-3">
                    <Button
                      variant="secondary"
                      onClick={() => setShowQR(!showQR)}
                      className="w-full h-12 transition-all duration-300"
                      disabled={!isLive}
                    >
                      <QrCode className="mr-2 h-4 w-4" />
                      {showQR ? "Hide QR Code" : "Show QR Code"}
                    </Button>

                    <div
                      className={`
                        overflow-hidden transition-all duration-500 ease-in-out
                        ${showQR && isLive
                          ? "max-h-96 opacity-100 scale-100 translate-y-0"
                          : "max-h-0 opacity-0 scale-95 -translate-y-2"
                        }
                      `}
                    >
                      <div className="flex justify-center p-6 bg-white rounded-2xl shadow-inner">
                        <QRCode
                          value={shareUrl}
                          size={160}
                          bgColor="#ffffff"
                          fgColor="#0a0a0f"
                        />
                      </div>
                    </div>
                  </div>

                {/* Stop/Start Sharing Button */}
                {isLive ? (
                  <Button
                    variant="destructive"
                    onClick={() => setShowStopDialog(true)}
                    className="w-full h-12 font-medium shadow-lg shadow-destructive/20"
                  >
                    <Square className="mr-2 h-4 w-4 fill-current" />
                    Stop Sharing
                  </Button>
                ) : (
                  <Button
                    onClick={handleStartSharingClick}
                    className="w-full h-12 font-medium bg-[#10b981] hover:bg-[#059669] text-white shadow-lg shadow-emerald-500/20"
                  >
                    <Play className="mr-2 h-4 w-4 fill-current" />
                    Start Sharing
                  </Button>
                )}

                {!isLive && (
                  <p className="text-center text-sm text-muted-foreground font-medium bg-secondary/50 p-3 rounded-lg">
                    Session ended. Click start to generate a new live session code.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
            </div>
          </DrawerContent>

        </Drawer>
      </div>
    </div>
  );
}
