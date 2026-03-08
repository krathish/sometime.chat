"use client";

import { useState, useEffect, useCallback, use } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { toast } from "sonner";
import { CopyButton } from "@/components/copy-button";
import { PlatformBadge } from "@/components/platform-badge";
import { useSound } from "@/lib/use-sound";

interface LinkData {
  id: string;
  url: string;
  personName: string;
  platform: string;
  availability: { start: string; end: string }[] | null;
  error: string | null;
}

interface SessionData {
  id: string;
  name: string | null;
  links: LinkData[];
}

interface CommonResult {
  grouped: Record<string, { start: string; end: string }[]>;
  participants: { name: string; slotCount: number }[];
  totalParticipants: number;
  participantsWithAvailability: number;
}

const spring = { type: "spring" as const, duration: 0.35, bounce: 0 };
const enterAnim = {
  initial: { opacity: 0, y: 8, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -4, filter: "blur(4px)" },
  transition: spring,
};

export default function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [results, setResults] = useState<CommonResult | null>(null);
  const [finding, setFinding] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const playClick = useSound("/sounds/click.mp3", 0.4);
  const playNotify = useSound("/sounds/notify.mp3", 0.5);
  const playError = useSound("/sounds/error.mp3", 0.45);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setSession(data);
    } catch {
      /* silently fail for polling */
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 5000);
    return () => clearInterval(interval);
  }, [fetchSession]);

  async function handleAddLink(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || !name.trim() || adding) return;
    playClick();

    setAdding(true);
    try {
      const res = await fetch(`/api/sessions/${id}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), personName: name.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        playError();
        toast.error(data.error || "Failed to add link");
        return;
      }

      if (data.error) {
        playError();
        toast.warning(data.error);
      } else if (data.slotsFound > 0) {
        toast.success(`Found ${data.slotsFound} available slots`);
      } else {
        playError();
        toast("Link added, but no available slots were detected");
      }

      setUrl("");
      setName("");
      await fetchSession();
    } catch {
      playError();
      toast.error("Something went wrong");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveLink(linkId: string) {
    try {
      await fetch(`/api/sessions/${id}/links/${linkId}`, {
        method: "DELETE",
      });
      await fetchSession();
      setResults(null);
    } catch {
      playError();
      toast.error("Failed to remove link");
    }
  }

  async function handleRetry(linkId: string) {
    if (retrying) return;
    playClick();
    setRetrying(linkId);
    try {
      const res = await fetch(`/api/sessions/${id}/links/${linkId}`, {
        method: "PATCH",
      });
      const data = await res.json();

      if (data.error) {
        playError();
        toast.warning(data.error);
      } else if (data.slotsFound > 0) {
        toast.success(`Found ${data.slotsFound} available slots`);
      } else {
        playError();
        toast("Retry complete, but no slots found");
      }

      await fetchSession();
    } catch {
      playError();
      toast.error("Retry failed");
    } finally {
      setRetrying(null);
    }
  }

  async function handleFindCommon() {
    if (finding) return;
    playClick();
    setFinding(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch(
        `/api/sessions/${id}/availability?timezone=${encodeURIComponent(tz)}`
      );
      const data = await res.json();
      setResults(data);

      const slotCount = Object.values(
        data.grouped as Record<string, unknown[]>
      ).reduce((sum: number, day: unknown[]) => sum + day.length, 0);

      if (slotCount > 0) {
        playNotify();
      } else {
        playError();
        toast("No common times found");
      }
    } catch {
      playError();
      toast.error("Failed to compute common times");
    } finally {
      setFinding(false);
    }
  }

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/s/${id}` : "";

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-muted text-sm"
        >
          Loading&hellip;
        </motion.div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <motion.div
          {...enterAnim}
          className="aqua-panel px-8 py-10 text-center max-w-sm"
        >
          <h1 className="text-xl font-semibold">Session Not Found</h1>
          <p className="mt-2 text-sm text-muted">
            This session may have expired or doesn&apos;t exist.
          </p>
          <a
            href="/"
            className="aqua-btn inline-flex items-center justify-center h-[30px] px-5 text-[13px] mt-4"
          >
            Go Home
          </a>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-10 px-6">
      <div className="max-w-xl mx-auto">
        <LayoutGroup>
          {/* Back link */}
          <motion.div {...enterAnim} className="mb-6">
            <a
              href="/"
              className="text-sm text-muted hover:text-foreground transition-colors duration-150"
            >
              &larr; FreeTime
            </a>
          </motion.div>

          {/* Main panel */}
          <motion.div
            className="aqua-panel overflow-hidden"
            {...enterAnim}
            transition={{ ...spring, delay: 0.03 }}
          >
            {/* Title bar */}
            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border/60 bg-gradient-to-b from-[#f6f6f6] to-[#dfdfdf]">
              <span className="w-3 h-3 rounded-full bg-[#ff5f57] border border-[#e2463f]" />
              <span className="w-3 h-3 rounded-full bg-[#febc2e] border border-[#e09e1a]" />
              <span className="w-3 h-3 rounded-full bg-[#28c840] border border-[#1aab29]" />
              <span className="flex-1 text-center text-xs font-medium text-muted select-none">
                Session
              </span>
              <span className="w-[54px]" />
            </div>

            <div className="p-5 space-y-5">
              {/* Share URL */}
              <div>
                <label
                  htmlFor="share-url"
                  className="text-[11px] font-semibold text-muted uppercase tracking-wider"
                >
                  Share This Link
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    id="share-url"
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="aqua-input flex-1 min-w-0 font-mono text-[12px] truncate"
                    onFocus={(e) => e.target.select()}
                    tabIndex={0}
                  />
                  <CopyButton text={shareUrl} />
                </div>
              </div>

              {/* Add Link Form */}
              <form onSubmit={handleAddLink}>
                <label
                  htmlFor="person-name"
                  className="text-[11px] font-semibold text-muted uppercase tracking-wider"
                >
                  Add Your Availability
                </label>
                <div className="mt-1.5 flex flex-col sm:flex-row gap-2">
                  <input
                    id="person-name"
                    type="text"
                    name="personName"
                    placeholder="Your name&hellip;"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="aqua-input flex-shrink-0 sm:w-32"
                    autoComplete="off"
                    spellCheck={false}
                    required
                  />
                  <input
                    id="scheduling-url"
                    type="url"
                    name="url"
                    placeholder="Paste scheduling link&hellip;"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="aqua-input flex-1 min-w-0"
                    autoComplete="off"
                    spellCheck={false}
                    required
                  />
                  <motion.button
                    type="submit"
                    disabled={adding || !url.trim() || !name.trim()}
                    className="aqua-btn h-[30px] px-4 text-[13px] flex-shrink-0"
                    whileHover={{ scale: 1.02, filter: "brightness(1.06)" }}
                    whileTap={{ scale: 0.96, filter: "brightness(0.94)" }}
                    transition={{ type: "spring", duration: 0.2, bounce: 0 }}
                  >
                    {adding ? (
                      <span className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-full border-[1.5px] border-white/30 border-t-white animate-spin" />
                        Adding&hellip;
                      </span>
                    ) : (
                      "Add"
                    )}
                  </motion.button>
                </div>
              </form>

              {/* Participants */}
              <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                  Participants ({session.links.length})
                </span>

                <div className="mt-1.5">
                  <AnimatePresence mode="popLayout">
                    {session.links.length === 0 ? (
                      <motion.div
                        key="empty"
                        {...enterAnim}
                        className="rounded-lg border border-dashed border-border py-8 text-center"
                      >
                        <p className="text-sm text-muted">
                          No one has added their link yet.
                        </p>
                        <p className="text-xs text-muted/60 mt-1">
                          Share the link above to get started.
                        </p>
                      </motion.div>
                    ) : (
                      <motion.ul layout className="space-y-1.5">
                        {session.links.map((link, i) => (
                          <motion.li
                            key={link.id}
                            layout
                            initial={{
                              opacity: 0,
                              y: 8,
                              filter: "blur(4px)",
                            }}
                            animate={{
                              opacity: 1,
                              y: 0,
                              filter: "blur(0px)",
                            }}
                            exit={{
                              opacity: 0,
                              x: -8,
                              filter: "blur(4px)",
                            }}
                            transition={{ ...spring, delay: i * 0.03 }}
                            className={`group flex items-center gap-3 rounded-lg border px-3 py-2 ${
                              link.error && !link.availability
                                ? "border-danger/40 bg-red-50/60"
                                : "border-border bg-white/60"
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-medium text-foreground">
                                  {link.personName}
                                </span>
                                <PlatformBadge platform={link.platform} />
                                {link.availability && (
                                  <span className="text-[11px] text-muted tabular-nums">
                                    {link.availability.length} slots
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted truncate mt-0.5">
                                {link.url}
                              </p>
                            </div>

                            {/* Error indicator with hover tooltip */}
                            {link.error && !link.availability && (
                              <ErrorBadge
                                error={link.error}
                                onRetry={() => handleRetry(link.id)}
                                isRetrying={retrying === link.id}
                              />
                            )}

                            <motion.button
                              onClick={() => handleRemoveLink(link.id)}
                              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-150 p-1.5 rounded-md hover:bg-danger/10 text-muted hover:text-danger cursor-pointer"
                              whileTap={{ scale: 0.9 }}
                              aria-label={`Remove ${link.personName}`}
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </motion.button>
                          </motion.li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Hint */}
              {session.links.length === 1 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ ...spring, delay: 0.1 }}
                  className="text-center text-[11px] text-muted"
                >
                  Need at least 2 participants to find common times.
                </motion.p>
              )}

              {/* Find Common Times */}
              {session.links.length >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring, delay: 0.05 }}
                >
                  <motion.button
                    onClick={handleFindCommon}
                    disabled={finding}
                    className="aqua-btn w-full h-[34px] text-[14px]"
                    whileHover={{ scale: 1.01, filter: "brightness(1.06)" }}
                    whileTap={{ scale: 0.98, filter: "brightness(0.94)" }}
                    transition={{ type: "spring", duration: 0.2, bounce: 0 }}
                  >
                    {finding ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Finding&hellip;
                      </span>
                    ) : (
                      "Find Common Times"
                    )}
                  </motion.button>
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Results */}
          <AnimatePresence>
            {results && (
              <motion.div
                initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                transition={{ ...spring, delay: 0.05 }}
                className="mt-4 aqua-panel overflow-hidden"
              >
                <div className="flex items-center px-4 py-2 border-b border-border/60 bg-gradient-to-b from-[#f6f6f6] to-[#dfdfdf]">
                  <span className="flex-1 text-center text-xs font-medium text-muted select-none">
                    Common Availability
                  </span>
                </div>

                <div className="p-5">
                  {results.participantsWithAvailability <
                    results.totalParticipants && (
                    <motion.p
                      {...enterAnim}
                      className="mb-3 text-[11px] bg-amber-50 text-amber-800 border border-amber-300 rounded-md px-3 py-2"
                    >
                      {results.totalParticipants -
                        results.participantsWithAvailability}{" "}
                      of {results.totalParticipants} participant(s) don&apos;t
                      have parsed availability data.
                    </motion.p>
                  )}

                  {Object.keys(results.grouped).length === 0 ? (
                    <motion.div
                      {...enterAnim}
                      className="rounded-lg border border-dashed border-border py-6 text-center"
                    >
                      <p className="text-sm text-muted">
                        No overlapping time slots found.
                      </p>
                      <p className="text-[11px] text-muted/60 mt-1">
                        Try different links or a wider date range.
                      </p>
                    </motion.div>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(results.grouped).map(
                        ([date, slots], dateIdx) => (
                          <motion.div
                            key={date}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              ...spring,
                              delay: 0.1 + dateIdx * 0.05,
                            }}
                          >
                            <h2 className="text-[13px] font-semibold text-foreground mb-1.5">
                              {formatDate(date)}
                            </h2>
                            <div className="flex flex-wrap gap-1">
                              {slots.map((slot, slotIdx) => (
                                <motion.span
                                  key={`${slot.start}-${slot.end}`}
                                  initial={{
                                    opacity: 0,
                                    scale: 0.95,
                                    filter: "blur(2px)",
                                  }}
                                  animate={{
                                    opacity: 1,
                                    scale: 1,
                                    filter: "blur(0px)",
                                  }}
                                  transition={{
                                    ...spring,
                                    delay:
                                      0.15 +
                                      dateIdx * 0.05 +
                                      slotIdx * 0.02,
                                  }}
                                  className="inline-flex items-center px-2.5 py-1 rounded-md bg-accent-light text-accent text-[11px] font-medium border border-accent/15"
                                  style={{
                                    fontVariantNumeric: "tabular-nums",
                                  }}
                                >
                                  {formatTime(slot.start)} &ndash;{" "}
                                  {formatTime(slot.end)}
                                </motion.span>
                              ))}
                            </div>
                          </motion.div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </LayoutGroup>
      </div>
    </main>
  );
}

/* ── Error Badge with hover popover ── */

function ErrorBadge({
  error,
  onRetry,
  isRetrying,
}: {
  error: string;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        className="flex items-center justify-center w-6 h-6 rounded-full bg-danger/10 text-danger cursor-pointer hover:bg-danger/20 transition-colors duration-150"
        aria-label="View parsing error"
        tabIndex={0}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.96, filter: "blur(3px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 4, scale: 0.96, filter: "blur(3px)" }}
            transition={{ type: "spring", duration: 0.25, bounce: 0 }}
            className="absolute right-0 top-full mt-1.5 z-50 w-64 aqua-panel p-3 text-left"
            style={{ transformOrigin: "top right" }}
          >
            <p className="text-[11px] font-semibold text-danger mb-1">
              Parsing Error
            </p>
            <p className="text-[11px] text-foreground/80 leading-relaxed break-words">
              {error}
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry();
                }}
                disabled={isRetrying}
                className="aqua-btn h-[24px] px-3 text-[11px] disabled:opacity-50"
              >
                {isRetrying ? "Retrying\u2026" : "Retry"}
              </button>
              <p className="text-[10px] text-muted/70 leading-tight self-center">
                Re-fetch availability from this link
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
