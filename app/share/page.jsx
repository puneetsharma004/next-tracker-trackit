"use client";

import {
  Check,
  Copy,
  Link as LinkIcon,
  MapPin,
  QrCode,
  Signal,
  Square,
  Play,
  Share2,
  ChevronUp,
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
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
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

// ── Dynamic import — SSR disabled (Leaflet is browser-only) ──────────────────
const LiveMap = dynamic(() => import("@/components/live-map"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-secondary/50 flex items-center justify-center min-h-[50vh] lg:min-h-full">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

// ── Main Page ────────────────────────────────────────────────────────────────
export default function ShareLocationPage() {
  const [sessionCode, setSessionCode] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [showStopDialog, setShowStopDialog] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [currentAddress, setCurrentAddress] = useState("Fetching location...");
  const [accuracy, setAccuracy] = useState(0);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [coords, setCoords] = useState(null);

  // Refs — mutable values that should NOT trigger re-renders
  const sessionRef = useRef(null);   // session code for cleanup
  const actualCoordsRef = useRef(null);   // latest GPS coords for polling
  const batteryRef = useRef(null);    // cached battery level
  const lastGeocodeRef = useRef(0);      // timestamp of last reverse-geocode

  // ── Battery: fetch once on mount, update via event listener ──────────────
  useEffect(() => {
    navigator.getBattery?.().then((battery) => {
      batteryRef.current = Math.round(battery.level * 100);
      battery.addEventListener("levelchange", () => {
        batteryRef.current = Math.round(battery.level * 100);
      });
    });
    // If getBattery doesn't exist or rejects → batteryRef stays null → that's correct
  }, []);

  // ── Reverse geocoding via axios ───────────────────────────────────────────
  const getAddressFromCoords = useCallback(async (latitude, longitude) => {
    try {
      const { data } = await axios.get(
        "https://nominatim.openstreetmap.org/reverse",
        { params: { format: "json", lat: latitude, lon: longitude } }
      );
      return data?.display_name ?? "Live Location Active";
    } catch {
      return "Live Location Active";
    }
  }, []);

  // ── Create a new sharing session via axios ────────────────────────────────
  const startSharing = useCallback(
    async (lat, lng, acc, speed = 0, addressStr = "Live Location Active") => {
      try {
        const { data } = await axios.post("/api/sessions/create", {
          name: "My Live Location",
          initials: "ME",
          latitude: lat,
          longitude: lng,
          speed: `${speed} km/h`,
          battery: batteryRef.current,   // reads cached ref — no extra API call
          address: addressStr,
        });

        if (data.success) {
          setSessionCode(data.session.code);
          sessionRef.current = data.session.code;
          setIsLive(true);
          setCurrentAddress(addressStr);
          setAccuracy(acc);
        } else {
          toast("Error", { description: "Failed to create session.", position: "top-center" });
        }
      } catch {
        toast("Error", { description: "Network error.", position: "top-center" });
      }
    },
    [] // stable — reads batteryRef directly, no state deps
  );

  // ── Init effect: GPS + session creation ──────────────────────────────────
  useEffect(() => {
    let watchId;

    if (!("geolocation" in navigator)) {
      toast("Error", {
        description: "Geolocation not supported by your browser.",
        position: "top-center",
      });
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const acc = Math.round(position.coords.accuracy);
        const speed = position.coords.speed
          ? Math.round(position.coords.speed * 3.6)
          : 0;

        // Set coords immediately so map renders while requests are in-flight
        setCoords({ lat, lng });
        actualCoordsRef.current = { lat, lng, acc, speed, address: "Live Location Active" };

        // ✅ FIX: run geocoding + session creation in parallel (was sequential before)
        // This cuts initial load time roughly in half
        const [fetchedAddress] = await Promise.all([
          getAddressFromCoords(lat, lng),
          startSharing(lat, lng, acc, speed, "Live Location Active"),
        ]);

        // Update address after both complete
        setCurrentAddress(fetchedAddress);
        actualCoordsRef.current.address = fetchedAddress;
        setLoading(false);

        // ── watchPosition: tracks movement in the background ──────────────
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const newLat = pos.coords.latitude;
            const newLng = pos.coords.longitude;
            const newAcc = Math.round(pos.coords.accuracy);
            const newSpeed = pos.coords.speed
              ? Math.round(pos.coords.speed * 3.6)
              : 0;

            // ✅ FIX: only re-render map if device moved >~5 metres
            // Prevents unnecessary Leaflet redraws on GPS micro-jitter
            const { lat: oldLat, lng: oldLng } = actualCoordsRef.current ?? {};
            const distanceMoved = Math.hypot(newLat - oldLat, newLng - oldLng);
            if (distanceMoved > 0.00005) {
              setCoords({ lat: newLat, lng: newLng });
            }

            setAccuracy(newAcc);
            actualCoordsRef.current = {
              ...actualCoordsRef.current,
              lat: newLat,
              lng: newLng,
              acc: newAcc,
              speed: newSpeed,
            };

            // ✅ FIX: throttled reverse geocoding — at most once every 30s
            // Avoids hammering Nominatim on every GPS tick
            const now = Date.now();
            if (now - lastGeocodeRef.current > 30_000) {
              lastGeocodeRef.current = now;
              getAddressFromCoords(newLat, newLng).then((addr) => {
                setCurrentAddress(addr);
                actualCoordsRef.current.address = addr;
              });
            }
          },
          undefined, // error handler (silent)
          { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
      },
      () => {
        toast("Location Error", {
          description: "Please allow location access to share your live location.",
        });
        setLoading(false);
      },
      { enableHighAccuracy: true }
    );

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (sessionRef.current) {
        // keepalive: true — ensures DELETE fires even during browser tab close / navigation
        fetch(`/api/sessions/${sessionRef.current}`, {
          method: "DELETE",
          keepalive: true,
        }).catch(() => null);
      }
    };
  }, [startSharing, getAddressFromCoords]);

  // ── Polling effect: push location to server every 5s ─────────────────────
  useEffect(() => {
    if (!isLive || !sessionCode) return;

    const interval = setInterval(() => {
      if (!actualCoordsRef.current) return;
      const { lat, lng, speed, address } = actualCoordsRef.current;

      // ✅ FIX: reads batteryRef.current — no getBattery() call per tick
      axios
        .post("/api/location/update", {
          code: sessionCode,
          latitude: lat,
          longitude: lng,
          speed: `${speed} km/h`,
          distance: "Live tracking...",
          battery: batteryRef.current,
          address: address ?? "Live Location Active",
        })
        .catch((err) => console.error("Update Error", err));
    }, 5000);

    return () => clearInterval(interval);
  }, [isLive, sessionCode]);

  // ── Derived values ────────────────────────────────────────────────────────
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/track?code=${sessionCode}`
      : "";

  // ── Handlers ──────────────────────────────────────────────────────────────
  const copyCode = async () => {
    await navigator.clipboard.writeText(sessionCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    toast("Code copied successfully", { description: sessionCode, position: "top-center" });
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast("Link copied successfully", { description: shareUrl, position: "top-center" });
  };

  const stopSharing = async () => {
    if (!sessionCode) return;
    try {
      await axios.delete(`/api/sessions/${sessionCode}`);
      setIsLive(false);
      setShowStopDialog(false);
      setSessionCode("");
      sessionRef.current = null;
      setCurrentAddress("Tracking Stopped");
      toast("Session Ended", {
        description: "Your location is no longer shared.",
        position: "top-center",
      });
    } catch {
      toast("Error", { description: "Failed to stop session.", position: "top-center" });
    }
  };

  const handleStartSharingClick = () => {
    if (!actualCoordsRef.current) return;
    const { lat, lng, acc, speed, address } = actualCoordsRef.current;
    startSharing(lat, lng, acc, speed, address);
  };

  // ── Early returns ─────────────────────────────────────────────────────────
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

  if (!coords) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <MapPin className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
          <h2 className="text-xl font-semibold mb-2">Location Access Required</h2>
          <p className="text-muted-foreground max-w-md">
            We need access to your location to share it with others. Please enable location
            permissions in your browser and refresh the page.
          </p>
        </div>
      </div>
    );
  }

  // Props shared between desktop + mobile status bars
  const statusBarProps = { accuracy, isLive, currentAddress };

  // Props shared between desktop + mobile ControlPanel
  const controlPanelProps = {
    isLive,
    sessionCode,
    shareUrl,
    showQR,
    setShowQR,
    copiedCode,
    copiedLink,
    copyCode,
    copyLink,
    handleStartSharingClick,
    setShowStopDialog,
  };

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-0 lg:pt-24 min-h-screen pb-6">
        <div className="flex flex-col lg:flex-row h-[100dvh] lg:h-full lg:min-h-[calc(100vh-9rem)] px-0 lg:px-8 max-w-7xl mx-auto gap-6">

          {/* ── Map ── */}
          <div className="flex-1 relative z-0 lg:rounded-3xl overflow-hidden border border-border shadow-2xl">
            <LiveMap
              latitude={coords.lat}
              longitude={coords.lng}
              showMarker={isLive}
              className="h-full min-h-[50vh] lg:min-h-full w-full"
            >
              {/* Status bar overlay — desktop (positioned inside map) */}
              <div className="lg:absolute bottom-0 left-0 right-0 p-4 pointer-events-auto hidden lg:block">
                <StatusBar {...statusBarProps} />
              </div>
            </LiveMap>
          </div>

          {/* ── Desktop Control Panel ── */}
          <div className="hidden lg:block">
            <ControlPanel {...controlPanelProps} />
          </div>

        </div>
      </main>

      {/* ── Stop Sharing Dialog ── */}
      <Dialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground text-xl">Stop Sharing Location?</DialogTitle>
            <DialogDescription className="text-muted-foreground pt-2">
              This will end your live session immediately. Anyone currently tracking you will no
              longer see your live location.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-4">
            <Button variant="outline" onClick={() => setShowStopDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={stopSharing}>
              Yes, Stop Sharing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Mobile Bottom Sheet ── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 lg:hidden">

        {/* Status bar — floats above the drawer peek bar */}
        <div className="absolute bottom-20 left-0 right-0 p-4 pointer-events-auto">
          <StatusBar {...statusBarProps} />
        </div>

        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          {/* Peek bar — always visible */}
          <DrawerTrigger asChild>
            <div className="glass border-t border-border/50 rounded-t-3xl p-5 cursor-pointer shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Share2 className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-semibold text-foreground">Share Your Location</p>
                    <p className="text-sm text-muted-foreground">
                      Code: {sessionCode || "—"}
                    </p>
                  </div>
                </div>
                <ChevronUp className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
          </DrawerTrigger>

          {/* Full drawer */}
          <DrawerContent className="bg-card border-border">
            <DrawerHeader className="pb-2">
              <DrawerTitle>Share Details</DrawerTitle>
            </DrawerHeader>
            <div className="p-4 space-y-4">
              <ControlPanel {...controlPanelProps} />
            </div>
          </DrawerContent>
        </Drawer>

      </div>
    </div>
  );
}

// ── StatusBar ────────────────────────────────────────────────────────────────
// Extracted to eliminate triple-duplication in the original code
function StatusBar({ accuracy, isLive, currentAddress }) {
  return (
    <div className="glass rounded-xl p-4 flex flex-wrap items-center gap-4 text-sm shadow-xl backdrop-blur-xl border border-border">
      <div className="flex items-center gap-2">
        <Signal className={`w-4 h-4 ${accuracy > 0 ? "text-primary" : "text-muted-foreground"}`} />
        <span className="text-muted-foreground font-medium">
          Accuracy: {accuracy > 0 ? `±${accuracy}m` : "..."}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${isLive ? "bg-primary animate-pulse" : "bg-destructive"
            }`}
        />
        <span className="text-muted-foreground font-medium">
          GPS {isLive ? "Active" : "Inactive"}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <MapPin className="w-4 h-4 text-primary shrink-0" />
        <span className="text-foreground font-medium truncate">{currentAddress}</span>
      </div>
    </div>
  );
}

// ── ControlPanel ─────────────────────────────────────────────────────────────
// Single source of truth — rendered in both desktop sidebar and mobile drawer
function ControlPanel({
  isLive,
  sessionCode,
  shareUrl,
  showQR,
  setShowQR,
  copiedCode,
  copiedLink,
  copyCode,
  copyLink,
  handleStartSharingClick,
  setShowStopDialog,
}) {
  return (
    <div className="w-full lg:w-[400px] flex flex-col space-y-4 z-10">
      <Card className="bg-card border-border shadow-xl rounded-3xl flex-1">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-foreground">Your Live Session</CardTitle>
            {isLive && <LiveBadge size="sm" />}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Session code display */}
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground font-medium">Session Code</label>
            <div className="flex-1 bg-secondary/50 border border-border rounded-lg p-4 text-center">
              <span className="font-mono text-3xl font-bold tracking-[0.3em] text-foreground">
                {sessionCode || "ENDED"}
              </span>
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
                <><Check className="mr-2 h-4 w-4 text-primary" />Copied!</>
              ) : (
                <><Copy className="mr-2 h-4 w-4" />Copy Code</>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={copyLink}
              className="w-full h-12"
              disabled={!isLive}
            >
              {copiedLink ? (
                <><Check className="mr-2 h-4 w-4 text-primary" />Copied!</>
              ) : (
                <><LinkIcon className="mr-2 h-4 w-4" />Copy Link</>
              )}
            </Button>
          </div>

          {/* QR Code */}
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
              className={`overflow-hidden transition-all duration-500 ease-in-out ${showQR && isLive
                  ? "max-h-96 opacity-100 scale-100 translate-y-0"
                  : "max-h-0 opacity-0 scale-95 -translate-y-2"
                }`}
            >
              <div className="flex justify-center p-6 bg-white rounded-2xl shadow-inner">
                <QRCode value={shareUrl} size={160} bgColor="#ffffff" fgColor="#0a0a0f" />
              </div>
            </div>
          </div>

          {/* Start / Stop */}
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
  );
}