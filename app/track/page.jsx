"use client";

import { ArrowRight, Link as LinkIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { MapBackground } from "@/components/map-background";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Separator } from "@/components/ui/separator";

function TrackPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [link, setLink] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if code is provided in URL
    const urlCode = searchParams.get("code");
    if (urlCode && urlCode.length === 6) {
      setCode(urlCode.toUpperCase());
      // Auto-submit if code is complete
      setTimeout(() => {
        handleSubmit(urlCode.toUpperCase());
      }, 500);
    }
  }, [searchParams]);

  const handleSubmit = (submitCode) => {
    const codeToUse = submitCode || code;
    if (codeToUse.length === 6) {
      setIsLoading(true);
      // Navigate to tracker view
      setTimeout(() => {
        router.push(`/track/${codeToUse}`);
      }, 800);
    }
  };

  const handleLinkSubmit = () => {
    // Extract code from link
    try {
      const url = new URL(link);
      const urlCode = url.searchParams.get("code");
      if (urlCode && urlCode.length === 6) {
        setCode(urlCode.toUpperCase());
        handleSubmit(urlCode.toUpperCase());
      }
    } catch {
      // Try to extract code directly if it's just a code
      if (link.length === 6) {
        setCode(link.toUpperCase());
        handleSubmit(link.toUpperCase());
      }
    }
  };

  const handleCodeChange = (value) => {
    setCode(value.toUpperCase());
    if (value.length === 6) {
      setTimeout(() => handleSubmit(value.toUpperCase()), 300);
    }
  };

  return (
    <MapBackground className="min-h-screen">
      <Navbar />

      <main className="relative flex items-center justify-center min-h-screen px-4 pt-16 pb-8">
        <Card className="w-full max-w-md bg-card/80 backdrop-blur-xl border-border">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-2xl font-bold text-foreground">
              Track Someone
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter the 6-digit session code to start tracking
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* OTP-style Code Input */}
            <div className="space-y-4">
              <div className="text-sm font-medium text-foreground block text-center">
                Enter Code
              </div>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={handleCodeChange}
                  disabled={isLoading}
                  inputMode="text"
                  pattern="^[a-zA-Z0-9]+$"
                >
                  <InputOTPGroup className="gap-2">
                    <InputOTPSlot
                      index={0}
                      className="w-12 h-14 text-xl font-mono font-bold bg-secondary border-border rounded-lg first:rounded-lg last:rounded-lg"
                    />
                    <InputOTPSlot
                      index={1}
                      className="w-12 h-14 text-xl font-mono font-bold bg-secondary border-border rounded-lg first:rounded-lg last:rounded-lg"
                    />
                    <InputOTPSlot
                      index={2}
                      className="w-12 h-14 text-xl font-mono font-bold bg-secondary border-border rounded-lg first:rounded-lg last:rounded-lg"
                    />
                    <InputOTPSlot
                      index={3}
                      className="w-12 h-14 text-xl font-mono font-bold bg-secondary border-border rounded-lg first:rounded-lg last:rounded-lg"
                    />
                    <InputOTPSlot
                      index={4}
                      className="w-12 h-14 text-xl font-mono font-bold bg-secondary border-border rounded-lg first:rounded-lg last:rounded-lg"
                    />
                    <InputOTPSlot
                      index={5}
                      className="w-12 h-14 text-xl font-mono font-bold bg-secondary border-border rounded-lg first:rounded-lg last:rounded-lg"
                    />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>

            <Button
              onClick={() => handleSubmit()}
              disabled={code.length !== 6 || isLoading}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 font-semibold"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Connecting...
                </span>
              ) : (
                <>
                  Start Tracking
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <div className="relative">
              <Separator className="bg-border" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                OR
              </span>
            </div>

            {/* Paste Link */}
            <div className="space-y-3">
              <label
                htmlFor="linkInput"
                className="text-sm font-medium text-foreground"
              >
                Paste a Link
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="linkInput"
                    type="url"
                    placeholder="https://trackit.app/track?code=..."
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    className="pl-10 bg-secondary border-border h-11"
                    disabled={isLoading}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={handleLinkSubmit}
                  disabled={!link || isLoading}
                  className="h-11"
                >
                  Go
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </MapBackground>
  );
}

export default function TrackPage() {
  return (
    <Suspense
      fallback={
        <MapBackground className="min-h-screen">
          <Navbar />
          <main className="flex items-center justify-center min-h-screen">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </main>
        </MapBackground>
      }
    >
      <TrackPageContent />
    </Suspense>
  );
}
