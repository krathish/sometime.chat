"use client";

import { MotionConfig } from "framer-motion";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider>
        {children}
      </TooltipProvider>
    </MotionConfig>
  );
}
