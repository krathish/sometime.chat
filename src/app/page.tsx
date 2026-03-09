"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useSound } from "@/lib/use-sound";

const springTransition = { type: "spring" as const, duration: 0.5, bounce: 0 };

export default function Home() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const playClick = useSound("/sounds/click.mp3", 0.4);

  async function handleCreate() {
    if (creating) return;
    playClick();
    setCreating(true);

    try {
      const res = await fetch("/api/sessions", { method: "POST" });
      const data = await res.json();
      router.push(`/s/${data.id}`);
    } catch {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <motion.div
        className="max-w-md w-full"
        initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ ...springTransition, duration: 0.7 }}
      >
        <motion.div
          className="aqua-panel px-8 py-10 text-center"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...springTransition, delay: 0.02 }}
        >
          <motion.div
            className="flex justify-center mb-5"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...springTransition, delay: 0.03 }}
          >
            <Image
              src="/logo.svg"
              alt="FreeTime"
              width={56}
              height={56}
              className="rounded-xl"
              style={{
                boxShadow:
                  "0 3px 10px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(0,0,0,0.08)",
              }}
              priority
            />
          </motion.div>

          <motion.h1
            className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground"
            style={{ textWrap: "balance" }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springTransition, delay: 0.05 }}
          >
            Find Time Together, Fast
          </motion.h1>

          <motion.p
            className="mt-3 text-[15px] text-muted leading-relaxed"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springTransition, delay: 0.12 }}
          >
            Paste your scheduling links. See when everyone&apos;s free.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springTransition, delay: 0.2 }}
            className="mt-8"
          >
            <motion.button
              onClick={handleCreate}
              disabled={creating}
              className="aqua-btn relative inline-flex items-center justify-center h-[42px] sm:h-[34px] px-8 sm:px-6 text-[15px] sm:text-[14px]"
              whileHover={{ scale: 1.02, filter: "brightness(1.06)" }}
              whileTap={{ scale: 0.97, filter: "brightness(0.94)" }}
              transition={{ type: "spring", duration: 0.2, bounce: 0 }}
            >
              <motion.span
                animate={{ opacity: creating ? 0 : 1 }}
                transition={{ duration: 0.15 }}
              >
                Find Free Time
              </motion.span>

              {creating && (
                <motion.span
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                >
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                </motion.span>
              )}
            </motion.button>
          </motion.div>

          <motion.p
            className="mt-5 text-xs text-muted/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...springTransition, delay: 0.35 }}
          >
            Supports Calendly, Cal.com, Google &amp; Notion Calendar
          </motion.p>
        </motion.div>
      </motion.div>
    </main>
  );
}
