"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSound } from "@/lib/use-sound";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const playClick = useSound("/sounds/click.mp3", 0.3);

  async function handleCopy() {
    playClick();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <motion.button
      onClick={handleCopy}
      className="aqua-btn relative flex items-center justify-center w-[30px] h-[30px] !px-0"
      whileHover={{ scale: 1.04, filter: "brightness(1.06)" }}
      whileTap={{ scale: 0.92, filter: "brightness(0.94)" }}
      transition={{ type: "spring", duration: 0.2, bounce: 0 }}
      aria-label="Copy to clipboard"
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.svg
            key="check"
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white"
            initial={{ opacity: 0, scale: 0.8, filter: "blur(2px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.8, filter: "blur(2px)" }}
            transition={{ type: "spring", duration: 0.25, bounce: 0 }}
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </motion.svg>
        ) : (
          <motion.svg
            key="copy"
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white"
            initial={{ opacity: 0, scale: 0.8, filter: "blur(2px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.8, filter: "blur(2px)" }}
            transition={{ type: "spring", duration: 0.25, bounce: 0 }}
            aria-hidden="true"
          >
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </motion.svg>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
