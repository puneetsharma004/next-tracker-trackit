"use client";

import {
  Check,
  Copy,
  Link as LinkIcon,
  MapPin,
  QrCode,
  Signal,
  Square,
} from "lucide-react";

import { useEffect, useState, useRef } from "react";
import { LiveBadge } from "@/components/live-badge";
import { MapBackground } from "@/components/map-background";
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
import { useToast } from "@/hooks/use-toast";

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
  
  const { toast } = useToast();
  const sessionRef = useRef(null);

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      try {
        const res = await fetch("/api/sessions/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "My Live Location",
            initials: "ME",
            latitude: 12.9716, // Default or mock coords initially
            longitude: 77.5946,
            battery: 100,
          }),
        });
        
        const data = await res.json();
        
        if (data.success) {
          setSessionCode(data.session.code);
          sessionRef.current = data.session.code;
          setIsLive(true);
          setCurrentAddress("Location Shared Active");
          setAccuracy(10);
        } else {
          toast({ title: "Error", description: "Failed to create session." });
        }
      } catch (err) {
        console.error("Init Error", err);
        toast({ title: "Error", description: "Network error." });
      } finally {
        setLoading(false);
      }
    };
    initSession();
    
    return () => {
      if (sessionRef.current) {
        // Cleanup on unmount (optional: let it expire)
        fetch(`/api/sessions/${sessionRef.current}`, { method: "DELETE" }).catch(()=>null);
      }
    };
  }, []);

  // Poll location updates (Mocking geolocation for this demo)
  useEffect(() => {
    if (!isLive || !sessionCode) return;
    
    let lat = 12.9716;
    let lng = 77.5946;
    
    const interval = setInterval(async () => {
      // Simulate movement
      lat += (Math.random() - 0.5) * 0.001;
      lng += (Math.random() - 0.5) * 0.001;
      
      try {
        await fetch("/api/location/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: sessionCode,
            latitude: lat,
            longitude: lng,
            speed: `${Math.floor(Math.random() * 30)} km/h`,
            distance: "Updating...",
            battery: 95,
          }),
        });
      } catch (err) {
        console.error("Update Error", err);
      }
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
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const stopSharing = async () => {
    if (!sessionCode) return;
    
    try {
      await fetch(`/api/sessions/${sessionCode}`, { method: "DELETE" });
      setIsLive(false);
      setShowStopDialog(false);
      setSessionCode("");
      sessionRef.current = null;
      toast({ title: "Session Ended", description: "Your location is no longer shared." });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to stop session." });
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-16 min-h-screen">
        <div className="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)]">
          {/* Map Section */}
          <div className="flex-1 relative">
            <MapBackground
              className="h-full min-h-[50vh] lg:min-h-full"
              showMarker={isLive}
            >
              {/* Bottom bar overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="glass rounded-xl p-4 flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Signal
                      className={`w-4 h-4 ${accuracy > 0 ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <span className="text-muted-foreground">
                      Accuracy: {accuracy > 0 ? `±${accuracy}m` : "..."}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${isLive ? "bg-primary" : "bg-destructive"}`}
                    />
                    <span className="text-muted-foreground">
                      GPS {isLive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground truncate">
                      {currentAddress}
                    </span>
                  </div>
                </div>
              </div>
            </MapBackground>
          </div>

          {/* Control Panel */}
          <div className="w-full lg:w-96 p-4 lg:p-6 space-y-4 lg:border-l border-border bg-background">
            <Card className="bg-card border-border">
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
                  <label className="text-sm text-muted-foreground">
                    Session Code
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-secondary rounded-lg p-4 text-center">
                      <span className="font-mono text-2xl font-bold tracking-[0.3em] text-foreground">
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
                    className="w-full"
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
                    className="w-full"
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
                    className="w-full"
                    disabled={!isLive}
                  >
                    <QrCode className="mr-2 h-4 w-4" />
                    {showQR ? "Hide QR Code" : "Show QR Code"}
                  </Button>

                  {showQR && isLive && (
                    <div className="flex justify-center p-4 bg-white rounded-xl">
                      <QRCode
                        value={shareUrl}
                        size={160}
                        bgColor="#ffffff"
                        fgColor="#0a0a0f"
                      />
                    </div>
                  )}
                </div>

                {/* Stop Sharing Button */}
                <Button
                  variant="destructive"
                  onClick={() => setShowStopDialog(true)}
                  className="w-full"
                  disabled={!isLive}
                >
                  <Square className="mr-2 h-4 w-4" />
                  Stop Sharing
                </Button>

                {!isLive && (
                  <p className="text-center text-sm text-muted-foreground">
                    Session ended. Your location is no longer being shared.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Stop Sharing Dialog */}
      <Dialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Stop Sharing Location?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This will end your live session. Anyone tracking you will no
              longer see your location.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowStopDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={stopSharing}>
              Stop Sharing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
