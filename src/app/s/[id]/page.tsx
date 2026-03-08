"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { toast } from "sonner";
import { CopyButton } from "@/components/copy-button";
import { PlatformBadge } from "@/components/platform-badge";
import { WeekCalendar } from "@/components/week-calendar";
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
  commonSlots: { start: string; end: string }[];
  participants: { name: string; slotCount: number }[];
  totalParticipants: number;
  participantsWithAvailability: number;
}

interface PendingSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

type InputMode = "link" | "manual";
type ViewMode = "list" | "calendar";

const spring = { type: "spring" as const, duration: 0.35, bounce: 0 };
const enterAnim = {
  initial: { opacity: 0, y: 8, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -4, filter: "blur(4px)" },
  transition: spring,
};

let pendingIdCounter = 0;

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
  const [inputMode, setInputMode] = useState<InputMode>("link");
  const [pendingSlots, setPendingSlots] = useState<PendingSlot[]>([]);
  const [slotDate, setSlotDate] = useState("");
  const [slotStartTime, setSlotStartTime] = useState("");
  const [slotEndTime, setSlotEndTime] = useState("");
  const [resultsView, setResultsView] = useState<ViewMode>("list");
  const [expandedLink, setExpandedLink] = useState<string | null>(null);
  const [participantView, setParticipantView] = useState<ViewMode>("list");
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

  function handleAddPendingSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!slotDate || !slotStartTime || !slotEndTime) return;

    const startStr = `${slotDate}T${slotStartTime}`;
    const endStr = `${slotDate}T${slotEndTime}`;
    const start = new Date(startStr);
    const end = new Date(endStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      playError();
      toast.error("Invalid date or time");
      return;
    }

    if (start >= end) {
      playError();
      toast.error("Start time must be before end time");
      return;
    }

    playClick();
    setPendingSlots((prev) => [
      ...prev,
      {
        id: `ps-${++pendingIdCounter}`,
        date: slotDate,
        startTime: slotStartTime,
        endTime: slotEndTime,
      },
    ]);
    setSlotStartTime("");
    setSlotEndTime("");
  }

  function removePendingSlot(slotId: string) {
    playClick();
    setPendingSlots((prev) => prev.filter((s) => s.id !== slotId));
  }

  async function handleSaveManualSlots() {
    if (!name.trim() || pendingSlots.length === 0 || adding) return;
    playClick();
    setAdding(true);

    const slots = pendingSlots.map((s) => ({
      start: new Date(`${s.date}T${s.startTime}`).toISOString(),
      end: new Date(`${s.date}T${s.endTime}`).toISOString(),
    }));

    try {
      const res = await fetch(`/api/sessions/${id}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personName: name.trim(), slots }),
      });
      const data = await res.json();

      if (!res.ok) {
        playError();
        toast.error(data.error || "Failed to save slots");
        return;
      }

      toast.success(`Added ${data.slotsFound} manual slots`);
      setName("");
      setPendingSlots([]);
      setSlotDate("");
      setSlotStartTime("");
      setSlotEndTime("");
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
      if (expandedLink === linkId) setExpandedLink(null);
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

  function toggleExpandLink(linkId: string) {
    playClick();
    setExpandedLink((prev) => (prev === linkId ? null : linkId));
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

  const todayStr = new Date().toISOString().split("T")[0];

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

              {/* Add Availability */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                    Add Your Availability
                  </span>
                  <div className="aqua-tab-group">
                    <button
                      type="button"
                      className={`aqua-tab ${inputMode === "link" ? "aqua-tab-active" : ""}`}
                      onClick={() => setInputMode("link")}
                    >
                      Paste Link
                    </button>
                    <button
                      type="button"
                      className={`aqua-tab ${inputMode === "manual" ? "aqua-tab-active" : ""}`}
                      onClick={() => setInputMode("manual")}
                    >
                      Add Manually
                    </button>
                  </div>
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  {inputMode === "link" ? (
                    <motion.form
                      key="link-form"
                      onSubmit={handleAddLink}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ type: "spring", duration: 0.25, bounce: 0 }}
                    >
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          id="person-name-link"
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
                          whileHover={{
                            scale: 1.02,
                            filter: "brightness(1.06)",
                          }}
                          whileTap={{
                            scale: 0.96,
                            filter: "brightness(0.94)",
                          }}
                          transition={{
                            type: "spring",
                            duration: 0.2,
                            bounce: 0,
                          }}
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
                    </motion.form>
                  ) : (
                    <motion.div
                      key="manual-form"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ type: "spring", duration: 0.25, bounce: 0 }}
                    >
                      <div className="flex flex-col gap-2">
                        <input
                          id="person-name-manual"
                          type="text"
                          name="personName"
                          placeholder="Your name&hellip;"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="aqua-input w-full sm:w-44"
                          autoComplete="off"
                          spellCheck={false}
                        />

                        <form
                          onSubmit={handleAddPendingSlot}
                          className="flex flex-col sm:flex-row gap-2"
                        >
                          <input
                            type="date"
                            value={slotDate}
                            onChange={(e) => setSlotDate(e.target.value)}
                            min={todayStr}
                            className="aqua-input text-[13px] flex-1"
                            required
                          />
                          <input
                            type="time"
                            value={slotStartTime}
                            onChange={(e) => setSlotStartTime(e.target.value)}
                            className="aqua-input text-[13px] w-full sm:w-28"
                            required
                          />
                          <span className="hidden sm:flex items-center text-[11px] text-muted">
                            to
                          </span>
                          <input
                            type="time"
                            value={slotEndTime}
                            onChange={(e) => setSlotEndTime(e.target.value)}
                            className="aqua-input text-[13px] w-full sm:w-28"
                            required
                          />
                          <motion.button
                            type="submit"
                            disabled={
                              !slotDate || !slotStartTime || !slotEndTime
                            }
                            className="aqua-btn h-[30px] w-[30px] !px-0 flex-shrink-0 flex items-center justify-center"
                            whileHover={{
                              scale: 1.06,
                              filter: "brightness(1.06)",
                            }}
                            whileTap={{
                              scale: 0.92,
                              filter: "brightness(0.94)",
                            }}
                            transition={{
                              type: "spring",
                              duration: 0.2,
                              bounce: 0,
                            }}
                            aria-label="Add time slot"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              aria-hidden="true"
                            >
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                          </motion.button>
                        </form>

                        {/* Pending slots list */}
                        <AnimatePresence mode="popLayout">
                          {pendingSlots.map((slot) => (
                            <motion.div
                              key={slot.id}
                              layout
                              initial={{
                                opacity: 0,
                                y: 6,
                                filter: "blur(3px)",
                              }}
                              animate={{
                                opacity: 1,
                                y: 0,
                                filter: "blur(0px)",
                              }}
                              exit={{
                                opacity: 0,
                                x: -8,
                                filter: "blur(3px)",
                              }}
                              transition={spring}
                              className="flex items-center justify-between rounded-md border border-border bg-white/60 px-3 py-1.5"
                            >
                              <span
                                className="text-[12px] text-foreground"
                                style={{ fontVariantNumeric: "tabular-nums" }}
                              >
                                {formatPendingSlot(slot)}
                              </span>
                              <motion.button
                                type="button"
                                onClick={() => removePendingSlot(slot.id)}
                                className="p-1 rounded hover:bg-danger/10 text-muted hover:text-danger cursor-pointer"
                                whileTap={{ scale: 0.9 }}
                                aria-label="Remove slot"
                              >
                                <svg
                                  width="10"
                                  height="10"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  aria-hidden="true"
                                >
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </motion.button>
                            </motion.div>
                          ))}
                        </AnimatePresence>

                        {pendingSlots.length > 0 && (
                          <motion.button
                            type="button"
                            onClick={handleSaveManualSlots}
                            disabled={adding || !name.trim()}
                            className="aqua-btn h-[30px] text-[13px] w-full mt-1"
                            whileHover={{
                              scale: 1.01,
                              filter: "brightness(1.06)",
                            }}
                            whileTap={{
                              scale: 0.97,
                              filter: "brightness(0.94)",
                            }}
                            transition={{
                              type: "spring",
                              duration: 0.2,
                              bounce: 0,
                            }}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                          >
                            {adding ? (
                              <span className="flex items-center justify-center gap-1.5">
                                <span className="h-3 w-3 rounded-full border-[1.5px] border-white/30 border-t-white animate-spin" />
                                Saving&hellip;
                              </span>
                            ) : (
                              `Save ${pendingSlots.length} slot${pendingSlots.length !== 1 ? "s" : ""}`
                            )}
                          </motion.button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

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
                            className={`rounded-lg border overflow-hidden ${
                              link.error && !link.availability
                                ? "border-danger/40 bg-red-50/60"
                                : "border-border bg-white/60"
                            }`}
                          >
                            <div className="group flex items-center gap-3 px-3 py-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[13px] font-medium text-foreground">
                                    {link.personName}
                                  </span>
                                  <PlatformBadge platform={link.platform} />
                                  {link.availability && (
                                    <button
                                      type="button"
                                      onClick={() => toggleExpandLink(link.id)}
                                      className="text-[11px] text-accent hover:underline cursor-pointer tabular-nums"
                                      style={{
                                        fontVariantNumeric: "tabular-nums",
                                      }}
                                    >
                                      {link.availability.length} slots
                                    </button>
                                  )}
                                </div>
                                {link.platform !== "manual" && (
                                  <p className="text-[11px] text-muted truncate mt-0.5">
                                    {link.url}
                                  </p>
                                )}
                              </div>

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
                            </div>

                            {/* Expanded slot detail */}
                            <AnimatePresence>
                              {expandedLink === link.id && link.availability && (
                                <motion.div
                                  initial={{
                                    height: 0,
                                    opacity: 0,
                                  }}
                                  animate={{
                                    height: "auto",
                                    opacity: 1,
                                  }}
                                  exit={{
                                    height: 0,
                                    opacity: 0,
                                  }}
                                  transition={{
                                    type: "spring",
                                    duration: 0.35,
                                    bounce: 0,
                                  }}
                                  className="overflow-hidden"
                                >
                                  <div className="border-t border-border/50 px-3 py-2.5">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                                        Availability
                                      </span>
                                      <ViewToggle
                                        view={participantView}
                                        onChange={(v) => {
                                          playClick();
                                          setParticipantView(v);
                                        }}
                                      />
                                    </div>
                                    {participantView === "list" ? (
                                      <SlotList
                                        slots={link.availability}
                                      />
                                    ) : (
                                      <WeekCalendar
                                        slots={link.availability}
                                      />
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
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
                  <ViewToggle
                    view={resultsView}
                    onChange={(v) => {
                      playClick();
                      setResultsView(v);
                    }}
                  />
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
                  ) : resultsView === "list" ? (
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
                  ) : (
                    <WeekCalendar slots={results.commonSlots || []} />
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

/* ── Slot list (reusable for participant detail) ── */

function SlotList({ slots }: { slots: { start: string; end: string }[] }) {
  const grouped: Record<string, { start: string; end: string }[]> = {};
  for (const slot of slots) {
    const date = new Date(slot.start).toLocaleDateString("en-CA");
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(slot);
  }

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto">
      {Object.entries(grouped).map(([date, daySlots]) => (
        <div key={date}>
          <p className="text-[11px] font-semibold text-foreground mb-0.5">
            {formatDate(date)}
          </p>
          <div className="flex flex-wrap gap-1">
            {daySlots.map((s) => (
              <span
                key={`${s.start}-${s.end}`}
                className="inline-flex items-center px-2 py-0.5 rounded bg-accent-light text-accent text-[10px] font-medium border border-accent/15"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatTime(s.start)} &ndash; {formatTime(s.end)}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── View toggle (list / calendar) ── */

function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 bg-white/60 border border-border/60 rounded-md p-0.5">
      <button
        type="button"
        onClick={() => onChange("list")}
        className={`p-1 rounded transition-colors duration-100 cursor-pointer ${
          view === "list"
            ? "bg-accent text-white shadow-sm"
            : "text-muted hover:text-foreground"
        }`}
        aria-label="List view"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onChange("calendar")}
        className={`p-1 rounded transition-colors duration-100 cursor-pointer ${
          view === "calendar"
            ? "bg-accent text-white shadow-sm"
            : "text-muted hover:text-foreground"
        }`}
        aria-label="Calendar view"
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
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>
    </div>
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (!open || !triggerRef.current) return;

    function update() {
      const rect = triggerRef.current!.getBoundingClientRect();
      setPos({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    }

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  const popover = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 4, scale: 0.96, filter: "blur(3px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: 4, scale: 0.96, filter: "blur(3px)" }}
          transition={{ type: "spring", duration: 0.25, bounce: 0 }}
          className="fixed z-[9999] w-64 aqua-panel p-3 text-left"
          style={{
            top: pos.top,
            right: pos.right,
            transformOrigin: "top right",
          }}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
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
  );

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        ref={triggerRef}
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

      {typeof document !== "undefined" &&
        createPortal(popover, document.body)}
    </div>
  );
}

/* ── Helpers ── */

function formatPendingSlot(slot: PendingSlot): string {
  const d = new Date(`${slot.date}T12:00:00`);
  const dateStr = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const start = formatTimeFromHHMM(slot.startTime);
  const end = formatTimeFromHHMM(slot.endTime);
  return `${dateStr}, ${start} \u2013 ${end}`;
}

function formatTimeFromHHMM(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
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
