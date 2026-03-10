"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useSound } from "@/lib/use-sound";

const springTransition = { type: "spring" as const, duration: 0.5, bounce: 0 };

function useIsReturnVisitor(): boolean {
  const [isReturn, setIsReturn] = useState(true);
  useEffect(() => {
    const visited = sessionStorage.getItem("st_visited");
    setIsReturn(!!visited);
    if (!visited) sessionStorage.setItem("st_visited", "1");
  }, []);
  return isReturn;
}

export default function Home() {
  const router = useRouter();
  const isReturn = useIsReturnVisitor();
  const d = useMemo(() => (isReturn ? 0.4 : 1), [isReturn]);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showJoinCode, setShowJoinCode] = useState(false);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const playClick = useSound("/sounds/click.mp3", 0.4);
  const playError = useSound("/sounds/error.mp3", 0.45);
  const playTab = useSound("/sounds/tab.mp3", 0.4);

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

  const submitCode = useCallback(async (code: string) => {
    if (joining) return;
    playClick();
    setJoining(true);

    try {
      const res = await fetch(`/api/sessions/join?code=${encodeURIComponent(code)}`);
      const data = await res.json();

      if (!res.ok) {
        playError();
        toast.error(data.error || "Session not found");
        setDigits(Array(6).fill(""));
        setTimeout(() => inputRefs.current[0]?.focus(), 50);
        return;
      }

      router.push(`/s/${data.id}`);
    } catch {
      playError();
      toast.error("Something went wrong");
      setDigits(Array(6).fill(""));
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally {
      setJoining(false);
    }
  }, [joining, playClick, playError, router]);

  function handleDigitChange(index: number, value: string) {
    const char = value.replace(/[^0-9]/g, "").slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);

    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (char && index === 5) {
      const code = next.join("");
      if (code.length === 6) {
        submitCode(code);
      }
    }
  }

  function handleDigitKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = "";
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter") {
      const code = digits.join("");
      if (code.length === 6) {
        submitCode(code);
      }
    }
  }

  function handleDigitPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...digits];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
    if (pasted.length === 6) {
      submitCode(pasted);
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
          className="aqua-panel overflow-hidden text-center"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...springTransition, delay: 0.02 * d }}
        >
          <div className="aqua-title-bar">
            <span className="aqua-traffic-disabled" />
            <span className="aqua-traffic-disabled" />
            <span className="aqua-traffic-disabled" />
            <span className="flex-1 text-center text-[11px] font-semibold text-muted select-none">
              Sometime.Chat
            </span>
            <span className="w-[48px]" />
          </div>

          <div className="px-8 py-10">
          <motion.div
            className="flex justify-center mb-5"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...springTransition, delay: 0.03 * d }}
          >
            <Image
              src="/logo.png"
              alt="Sometime.Chat"
              width={56}
              height={56}
              className="rounded-xl"
              style={{
                boxShadow:
                  "0 3px 10px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(0,0,0,0.08)",
              }}
              unoptimized
              priority
            />
          </motion.div>

          <motion.h1
            className="text-[48px] font-normal tracking-normal leading-[48px] text-foreground"
            style={{ textWrap: "balance", fontFamily: "var(--font-perfectly-nineties), sans-serif" }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springTransition, delay: 0.05 * d }}
          >
            Sometime.Chat
          </motion.h1>

          <motion.p
            className="mt-3 text-[14px] text-muted leading-[130%]"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springTransition, delay: 0.08 * d }}
          >
            Connect your calendars and find<br />overlapping free time.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springTransition, delay: 0.14 * d }}
            className="mt-4"
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
                Find time
              </motion.span>

              <AnimatePresence>
                {creating && (
                  <motion.span
                    className="absolute inset-0 flex items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...springTransition, delay: 0.18 * d }}
            className="mt-4"
          >
            <AnimatePresence mode="wait" initial={false}>
              {!showJoinCode ? (
                <motion.button
                  key="join-link"
                  type="button"
                  onClick={() => {
                    playTab();
                    setShowJoinCode(true);
                    setTimeout(() => inputRefs.current[0]?.focus(), 80);
                  }}
                  className="text-[13px] text-muted hover:text-accent cursor-pointer transition-colors duration-150 underline underline-offset-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ type: "spring", duration: 0.25, bounce: 0 }}
                >
                  Have a join code?
                </motion.button>
              ) : (
                <motion.div
                  key="join-otp"
                  initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -4, filter: "blur(4px)" }}
                  transition={{ type: "spring", duration: 0.35, bounce: 0 }}
                  className="flex flex-col items-center gap-3"
                >
                  <p id="join-code-label" className="text-[12px] text-muted">Enter your 6-digit code</p>
                  <div role="group" aria-labelledby="join-code-label" className="flex items-center gap-1.5">
                    {digits.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => { inputRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        aria-label={`Digit ${i + 1} of 6`}
                        value={digit}
                        onChange={(e) => handleDigitChange(i, e.target.value)}
                        onKeyDown={(e) => handleDigitKeyDown(i, e)}
                        onPaste={i === 0 ? handleDigitPaste : undefined}
                        disabled={joining}
                        className="aqua-input w-[38px] h-[44px] text-center font-mono text-[18px] font-semibold tracking-normal p-0 caret-accent focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all duration-150"
                        maxLength={1}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    ))}
                  </div>
                  <AnimatePresence>
                    {joining && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12 }}
                        className="flex items-center gap-1.5 text-[12px] text-muted"
                      >
                        <span className="h-3 w-3 rounded-full border-[1.5px] border-muted/30 border-t-muted animate-spin" />
                        Joining&hellip;
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <button
                    type="button"
                    onClick={() => {
                      setShowJoinCode(false);
                      setDigits(Array(6).fill(""));
                    }}
                    className="text-[11px] text-muted/50 hover:text-muted cursor-pointer transition-colors duration-150"
                  >
                    Cancel
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.p
            className="mt-5 text-xs text-muted/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...springTransition, delay: 0.22 * d }}
          >
            Built by <a href="http://krathish.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-muted/60 transition-colors">Krathish</a>
            {" · "}
            <a href="/privacy" className="underline hover:text-muted/60 transition-colors">Privacy</a>
            {" · "}
            <a href="/terms" className="underline hover:text-muted/60 transition-colors">Terms</a>
          </motion.p>
          </div>
        </motion.div>
      </motion.div>
    </main>
  );
}
