"use client";

import React from "react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Navbar() {
  return (
    <header className="w-full border-b border-border/50 bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto flex h-14 max-w-7xl items-center justify-end px-4 sm:px-6">
        <ThemeToggle />
      </div>
    </header>
  );
}
