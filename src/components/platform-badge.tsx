"use client";

import { motion } from "framer-motion";

const platformColors: Record<string, string> = {
  calendly:
    "bg-blue-100/80 text-blue-800 border-blue-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]",
  calcom:
    "bg-orange-100/80 text-orange-800 border-orange-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]",
  google:
    "bg-emerald-100/80 text-emerald-800 border-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]",
  gcal:
    "bg-emerald-100/80 text-emerald-800 border-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]",
  notion:
    "bg-stone-100/80 text-stone-700 border-stone-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]",
  manual:
    "bg-violet-100/80 text-violet-800 border-violet-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]",
  unknown:
    "bg-neutral-100/80 text-neutral-600 border-neutral-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]",
};

const platformLabels: Record<string, string> = {
  calendly: "Calendly",
  calcom: "Cal.com",
  google: "Google ICS",
  gcal: "Google Calendar",
  notion: "Notion Calendar",
  manual: "Manual",
  unknown: "Unknown",
};

export function PlatformBadge({ platform }: { platform: string }) {
  return (
    <motion.span
      className={`inline-flex items-center px-1.5 py-px rounded text-[10px] font-semibold border ${platformColors[platform] || platformColors.unknown}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", duration: 0.25, bounce: 0 }}
    >
      {platformLabels[platform] || platform}
    </motion.span>
  );
}
