"use client";

import { ArrowLeft, Bell, Clock, Moon, Shield, Sun, User } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  const [notifications, setNotifications] = useState(true);
  const [locationAlerts, setLocationAlerts] = useState(true);
  const [sessionDuration, setSessionDuration] = useState("30");
  const [highAccuracy, setHighAccuracy] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-16 pb-8">
        <div className="max-w-5xl mx-auto px-4">
          {/* Header */}
          <div className="py-6">
            <Button variant="ghost" asChild className="mb-4 -ml-2">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground mt-1">
              Manage your TrackIt preferences
            </p>
          </div>

          <div className="space-y-6">
            {/* Notifications */}
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  <CardTitle className="text-foreground">
                    Notifications
                  </CardTitle>
                </div>
                <CardDescription className="text-muted-foreground">
                  Configure how you receive alerts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="notifications"
                    className="flex flex-col gap-1 items-start"
                  >
                    <span className="text-foreground">Push Notifications</span>
                    <span className="text-sm text-muted-foreground font-normal">
                      Receive notifications when someone starts tracking you
                    </span>
                  </Label>
                  <Switch
                    id="notifications"
                    checked={notifications}
                    onCheckedChange={setNotifications}
                  />
                </div>
                <Separator className="bg-border" />
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="location-alerts"
                    className="flex flex-col gap-1 items-start"
                  >
                    <span className="text-foreground">Location Alerts</span>
                    <span className="text-sm text-muted-foreground font-normal">
                      Get notified when tracked person leaves an area
                    </span>
                  </Label>
                  <Switch
                    id="location-alerts"
                    checked={locationAlerts}
                    onCheckedChange={setLocationAlerts}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Session Settings */}
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <CardTitle className="text-foreground">
                    Session Settings
                  </CardTitle>
                </div>
                <CardDescription className="text-muted-foreground">
                  Configure default sharing options
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="session-duration"
                    className="flex flex-col gap-1 items-start"
                  >
                    <span className="text-foreground">
                      Default Session Duration
                    </span>
                    <span className="text-sm text-muted-foreground font-normal">
                      Auto-stop sharing after this time
                    </span>
                  </Label>
                  <Select
                    value={sessionDuration}
                    onValueChange={setSessionDuration}
                  >
                    <SelectTrigger className="w-32 bg-secondary border-border">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                      <SelectItem value="unlimited">Unlimited</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator className="bg-border" />
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="high-accuracy"
                    className="flex flex-col gap-1 items-start"
                  >
                    <span className="text-foreground">High Accuracy Mode</span>
                    <span className="text-sm text-muted-foreground font-normal">
                      Uses more battery but provides better location
                    </span>
                  </Label>
                  <Switch
                    id="high-accuracy"
                    checked={highAccuracy}
                    onCheckedChange={setHighAccuracy}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Appearance */}
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center gap-2">
                  {darkMode ? (
                    <Moon className="h-5 w-5 text-primary" />
                  ) : (
                    <Sun className="h-5 w-5 text-primary" />
                  )}
                  <CardTitle className="text-foreground">Appearance</CardTitle>
                </div>
                <CardDescription className="text-muted-foreground">
                  Customize how TrackIt looks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Label htmlFor="dark-mode" className="flex flex-col gap-1 items-start">
                    <span className="text-foreground">Dark Mode</span>
                    <span className="text-sm text-muted-foreground font-normal">
                      Enable dark theme for better visibility
                    </span>
                  </Label>
                  <Switch
                    id="dark-mode"
                    checked={darkMode}
                    onCheckedChange={(checked) => {
                      setDarkMode(checked);
                      document.documentElement.classList.toggle(
                        "dark",
                        checked,
                      );
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Privacy & Security */}
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <CardTitle className="text-foreground">
                    Privacy & Security
                  </CardTitle>
                </div>
                <CardDescription className="text-muted-foreground">
                  Your data and privacy settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-secondary/50 rounded-lg p-4">
                  <p className="text-sm text-foreground font-medium">
                    Your Privacy Matters
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    TrackIt only shares your location when you explicitly start
                    a sharing session. All sessions are encrypted and
                    automatically expire.
                  </p>
                </div>
                <Button variant="outline" className="w-full">
                  View Privacy Policy
                </Button>
              </CardContent>
            </Card>

            {/* Account */}
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  <CardTitle className="text-foreground">Account</CardTitle>
                </div>
                <CardDescription className="text-muted-foreground">
                  Manage your account settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full">
                  Sign In / Create Account
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Sign in to sync your settings across devices
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
