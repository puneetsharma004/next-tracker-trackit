"use client";

import { ArrowRight, Keyboard } from "lucide-react";
import Link from "next/link";
import { MapBackground } from "@/components/map-background";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <MapBackground className="min-h-screen" showMarker>
      <Navbar />

      <main className="relative flex flex-col items-center justify-center min-h-screen px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Hero content */}
          <div className="space-y-6">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground text-balance">
              Share Your Location.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">Instantly.</span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-pretty">
              Generate a code or shareable link — let others track you in real
              time. Simple, secure, and lightning fast.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-8 h-12 text-base"
            >
              <Link href="/share">
                Start Sharing
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              size="lg"
              className="w-full sm:w-auto border-border hover:bg-accent hover:text-accent-foreground font-semibold px-8 h-12 text-base"
            >
              <Link href="/track">
                <Keyboard className="mr-2 h-4 w-4" />
                Enter a Code
              </Link>
            </Button>
          </div>
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </main>
    </MapBackground>
  );
}
