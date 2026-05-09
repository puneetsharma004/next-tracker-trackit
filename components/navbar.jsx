"use client";

import { MapPin, Moon, Settings, Sun } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function Navbar({ children }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    // Always start in dark mode
    document.documentElement.classList.add("dark");
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
  };

  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex justify-center pointer-events-none px-4 sm:px-6">
      <nav className="glass w-full max-w-5xl rounded-2xl px-4 h-14 pointer-events-auto flex items-center justify-between shadow-xl transition-all duration-300">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="relative">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center transition-transform group-hover:scale-105">
              <MapPin className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="absolute inset-0 rounded-xl bg-primary/30 animate-pulse-ring" />
          </div>
          <span className="text-lg font-bold text-foreground tracking-tight">
            TrackIt
          </span>
          {children}
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="text-muted-foreground hover:text-foreground rounded-full"
          >
            <Link href="/settings">
              <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="sr-only">Settings</span>
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-muted-foreground hover:text-foreground rounded-full"
          >
            {isDark ? (
              <Sun className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : (
              <Moon className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </nav>
    </div>
  );
}
