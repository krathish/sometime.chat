"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { toast } from "sonner";
import { PlatformBadge } from "@/components/platform-badge";
import { WeekCalendar } from "@/components/week-calendar";
import { InteractiveCalendar } from "@/components/interactive-calendar";
import { useSound } from "@/lib/use-sound";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LinkData {
  id: string;
  url: string;
  personName: string;
  platform: string;
  availability: { start: string; end: string }[] | null;
  error: string | null;
  canRefresh?: boolean;
  calendarEmail?: string | null;
  timezone?: string | null;
  tzLabel?: string | null;
}

interface SessionData {
  id: string;
  code: string | null;
  name: string | null;
  links: LinkData[];
}

interface LevelSlot {
  start: string;
  end: string;
  count: number;
  total: number;
  available: string[];
  unavailable: string[];
}

interface TzParticipantComfort {
  name: string;
  timezone: string;
  localTime: string;
  hour: number;
  score: number;
  label: "great" | "ok" | "early" | "late" | "bad";
}

interface SlotComfortData {
  start: string;
  end: string;
  comfort: {
    overallScore: number;
    perParticipant: TzParticipantComfort[];
  };
}

interface TimezoneInsights {
  goldenHours: { startUtcHour: number; endUtcHour: number; widthHours: number } | null;
  slotComforts: SlotComfortData[];
  participantTimezones: { name: string; timezone: string; label: string }[];
  spansTzCount: number;
}

interface CommonResult {
  grouped: Record<string, { start: string; end: string }[]>;
  groupedLevels: Record<string, LevelSlot[]>;
  commonSlots: { start: string; end: string }[];
  levelSlots: LevelSlot[];
  participants: { name: string; slotCount: number; timezone?: string | null; tzLabel?: string | null }[];
  totalParticipants: number;
  participantsWithAvailability: number;
  timezoneInsights: TimezoneInsights | null;
}

interface PendingSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

type InputMode = "link" | "manual" | "calendar" | "google";
type ViewMode = "list" | "calendar";

const spring = { type: "spring" as const, duration: 0.35, bounce: 0 };
const exitSpring = { type: "spring" as const, duration: 0.28, bounce: 0 };
const enterAnim = {
  initial: { opacity: 0, y: 8, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -4, filter: "blur(4px)", transition: exitSpring },
  transition: spring,
};

const TIME_OPTIONS = (() => {
  const opts: { value: string; label: string }[] = [];
  for (let h = 7; h <= 22; h++) {
    for (let m = 0; m < 60; m += 30) {
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const hour12 = h % 12 || 12;
      const ampm = h < 12 ? "AM" : "PM";
      const label = `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
      opts.push({ value, label });
    }
  }
  return opts;
})();

const TIME_PRESETS = [
  { label: "Morning", start: "09:00", end: "12:00" },
  { label: "Afternoon", start: "12:00", end: "17:00" },
  { label: "Evening", start: "17:00", end: "21:00" },
];

let pendingIdCounter = 0;

export default function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [nameRequired, setNameRequired] = useState(false);
  const [results, setResults] = useState<CommonResult | null>(null);
  const [finding, setFinding] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>("link");
  const [pendingSlots, setPendingSlots] = useState<PendingSlot[]>([]);
  const [slotDate, setSlotDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [slotStartTime, setSlotStartTime] = useState("");
  const [slotEndTime, setSlotEndTime] = useState("");
  const [resultsView, setResultsView] = useState<ViewMode>("list");
  const [expandedLink, setExpandedLink] = useState<string | null>(null);
  const [participantView, setParticipantView] = useState<ViewMode>("list");
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const playClick = useSound("/sounds/click.mp3", 0.4);
  const playClose = useSound("/sounds/close.mp3", 0.5);
  const playNotify = useSound("/sounds/notify.mp3", 0.5);
  const playError = useSound("/sounds/error.mp3", 0.45);
  const playTab = useSound("/sounds/tab.mp3", 0.4);
  const gcalHandled = useRef(false);

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

  useEffect(() => {
    if (gcalHandled.current) return;
    const gcal = searchParams.get("gcal");
    if (!gcal) return;
    gcalHandled.current = true;

    if (gcal === "success") {
      const slots = searchParams.get("slots");
      const gcalName = searchParams.get("name");
      playNotify();
      toast.success(
        `Google Calendar connected${gcalName ? ` for ${gcalName}` : ""}${slots ? ` \u2014 ${slots} free slots found` : ""}`
      );
    } else if (gcal === "denied") {
      playError();
      toast.error("Google Calendar access was denied");
    } else if (gcal === "error") {
      playError();
      toast.error("Failed to connect Google Calendar");
    }

    router.replace(`/s/${id}`, { scroll: false });
  }, [searchParams, id, router, playNotify, playError]);

  function handleConnectGoogle() {
    if (!name.trim()) {
      playError();
      toast.error("Please enter your name first");
      return;
    }
    playClick();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const authUrl = `/api/auth/google?sessionId=${encodeURIComponent(id)}&personName=${encodeURIComponent(name.trim())}&timezone=${encodeURIComponent(tz)}`;
    window.location.href = authUrl;
  }

  async function handleRefreshCalendar(linkId: string) {
    if (refreshing) return;
    playClick();
    setRefreshing(linkId);
    try {
      const res = await fetch(`/api/sessions/${id}/links/${linkId}/refresh`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        playError();
        if (data.reconnect) {
          toast.error("Calendar access expired. Please reconnect.");
        } else {
          toast.error(data.error || "Failed to refresh");
        }
        return;
      }

      if (data.slotsFound > 0) {
        toast.success(`Refreshed \u2014 ${data.slotsFound} free slots`);
      } else {
        toast("Refreshed, but no free slots found");
      }

      await fetchSession();
    } catch {
      playError();
      toast.error("Failed to refresh calendar");
    } finally {
      setRefreshing(null);
    }
  }

  async function handleAddLink(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || !name.trim() || adding) return;
    playClick();

    setAdding(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch(`/api/sessions/${id}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), personName: name.trim(), timezone: tz }),
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
    if (pendingSlots.length === 0 || adding) return;
    if (!name.trim()) {
      setNameRequired(true);
      playError();
      return;
    }
    playClick();
    setAdding(true);

    const slots = pendingSlots.map((s) => ({
      start: new Date(`${s.date}T${s.startTime}`).toISOString(),
      end: new Date(`${s.date}T${s.endTime}`).toISOString(),
    }));

    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch(`/api/sessions/${id}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personName: name.trim(), slots, timezone: tz }),
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
      const now = new Date();
      setSlotDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`);
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
        data.groupedLevels as Record<string, unknown[]>
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

  function startEditingName() {
    setDraftName(session?.name || "");
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.select(), 0);
  }

  async function saveName() {
    const trimmed = draftName.trim();
    setEditingName(false);
    if (!trimmed || trimmed === session?.name) return;

    try {
      await fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      setSession((prev) => prev ? { ...prev, name: trimmed } : prev);
    } catch {
      playError();
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

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, "0")}-${String(tomorrowDate.getDate()).padStart(2, "0")}`;

  function formatDateLabel(dateStr: string) {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const day = date.getDate();
    const suffix = [11, 12, 13].includes(day % 100)
      ? "th"
      : ["th", "st", "nd", "rd"][day % 10] || "th";
    const month = date.toLocaleDateString("en-US", { month: "long" });
    const currentYear = new Date().getFullYear();
    return `${day}${suffix} ${month}${y !== currentYear ? ` ${y}` : ""}`;
  }

  function getDateTag(dateStr: string) {
    if (dateStr === todayStr) return "Today";
    if (dateStr === tomorrowStr) return "Tomorrow";
    return null;
  }

  return (
    <main className="min-h-screen py-6 sm:py-10 px-4 sm:px-6">
      <div className="max-w-xl mx-auto">
        <LayoutGroup>
          {/* Main panel */}
          <motion.div
            className="aqua-panel overflow-hidden"
            {...enterAnim}
            transition={{ ...spring, delay: 0.03 }}
          >
            {/* Title bar */}
            <div className="aqua-title-bar">
              <button
                type="button"
                onClick={() => {
                  playClose();
                  router.push("/");
                }}
                className="aqua-traffic-light aqua-traffic-close cursor-pointer transition-opacity hover:opacity-80"
                aria-label="Back to home"
              />
              <span className="aqua-traffic-disabled" />
              <span className="aqua-traffic-disabled" />
              <span className="flex-1 text-center text-[11px] font-semibold text-muted select-none">
                Sometime.Chat
              </span>
              <span className="w-[48px]" />
            </div>

            <div className="p-5 space-y-5">
              {/* Event name + Share */}
              <div className="flex items-center justify-between gap-4">
                {/* Left: Event Name */}
                <div className="min-w-0">
                  <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                    Event Name
                  </label>
                  <div className="group/name mt-0.5 flex items-center gap-1.5 h-[30px]">
                    {editingName ? (
                      <input
                        ref={nameInputRef}
                        type="text"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onBlur={saveName}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveName();
                          if (e.key === "Escape") setEditingName(false);
                        }}
                        className="bg-transparent text-[20px] leading-[30px] h-[30px] font-semibold text-foreground outline-none border-b-2 border-accent/40 focus:border-accent w-full max-w-[240px]"
                        autoFocus
                        spellCheck={false}
                      />
                    ) : (
                      <motion.button
                        type="button"
                        onClick={startEditingName}
                        className="text-[20px] leading-[30px] h-[30px] font-semibold text-foreground cursor-pointer flex items-center gap-1.5 hover:text-accent transition-colors duration-150 truncate"
                        whileTap={{ scale: 0.98 }}
                      >
                        <span className="truncate">{session.name || "Untitled Session"}</span>
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-muted/0 group-hover/name:text-muted/60 transition-colors duration-150 shrink-0"
                          aria-hidden="true"
                        >
                          <path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5Z" />
                          <path d="m15 5 4 4" />
                        </svg>
                      </motion.button>
                    )}
                  </div>
                </div>

                {/* Right: Share */}
                <div className="shrink-0">
                  <div className="flex items-center gap-1.5 h-full justify-end">
                    {session.code && (
                      <ShareCopyButton text={session.code} label={session.code} icon="code" />
                    )}
                    <span className="text-muted/25 text-[10px]">|</span>
                    <ShareCopyButton text={shareUrl} label="link" icon="link" />
                  </div>
                </div>
              </div>

              {/* Add Availability */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-1.5">
                  <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                    Add Your Availability
                  </span>
                  <div className="aqua-tab-group">
                    {(["link", "manual", "calendar", "google"] as InputMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className="aqua-tab"
                        onClick={() => { playTab(); setInputMode(mode); }}
                      >
                        {inputMode === mode && (
                          <motion.span
                            layoutId="input-tab-indicator"
                            className="aqua-tab-indicator"
                            transition={{ type: "spring", duration: 0.3, bounce: 0.1 }}
                          />
                        )}
                        <span className={`relative z-[1] transition-colors duration-150 ${inputMode === mode ? "text-white" : ""}`} style={inputMode === mode ? { textShadow: "0 -1px 0 rgba(0,0,0,0.2)" } : undefined}>
                          {mode[0].toUpperCase() + mode.slice(1)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  {inputMode === "link" && (
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
                          className="aqua-input flex-shrink-0 w-full sm:w-32"
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
                          className="aqua-input sm:flex-1 min-w-0"
                          autoComplete="off"
                          spellCheck={false}
                          required
                        />
                        <motion.button
                          type="submit"
                          disabled={adding || !url.trim() || !name.trim()}
                          className="aqua-btn h-[32px] sm:h-[30px] px-4 text-[13px] flex-shrink-0 w-full sm:w-auto"
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
                          <AnimatePresence mode="wait" initial={false}>
                            {adding ? (
                              <motion.span
                                key="adding"
                                className="flex items-center justify-center gap-1.5"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.12 }}
                              >
                                <span className="h-3 w-3 rounded-full border-[1.5px] border-white/30 border-t-white animate-spin" />
                                Adding&hellip;
                              </motion.span>
                            ) : (
                              <motion.span
                                key="add-label"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.12 }}
                              >
                                Add
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </motion.button>
                      </div>
                    </motion.form>
                  )}
                  {inputMode === "manual" && (
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
                          className="aqua-input w-full sm:w-48"
                          autoComplete="off"
                          spellCheck={false}
                        />

                        <form
                          onSubmit={handleAddPendingSlot}
                          className="flex flex-col gap-2"
                        >
                          <Popover>
                            <PopoverTrigger className="aqua-input text-[13px] h-[32px] sm:h-[30px] flex items-center justify-between w-full cursor-pointer">
                              <span className="flex items-center gap-1.5">
                                <span className={slotDate ? "text-foreground" : "text-[#999]"}>
                                  {slotDate ? formatDateLabel(slotDate) : "Select date\u2026"}
                                </span>
                                {slotDate && getDateTag(slotDate) && (
                                  <span className="text-[10px] font-medium text-accent bg-accent/10 border border-accent/20 rounded-full px-1.5 py-0.5 leading-none">
                                    {getDateTag(slotDate)}
                                  </span>
                                )}
                              </span>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted flex-shrink-0">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                              </svg>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={slotDate ? new Date(slotDate + "T00:00:00") : undefined}
                                onSelect={(date) => {
                                  if (date) {
                                    const y = date.getFullYear();
                                    const m = String(date.getMonth() + 1).padStart(2, "0");
                                    const d = String(date.getDate()).padStart(2, "0");
                                    setSlotDate(`${y}-${m}-${d}`);
                                  }
                                }}
                                disabled={(date) => date < new Date(todayStr + "T00:00:00")}
                              />
                            </PopoverContent>
                          </Popover>

                          <AnimatePresence>
                            {slotDate && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                                className="flex flex-col gap-2 overflow-hidden"
                              >
                                <div className="flex items-center gap-1.5">
                                  {TIME_PRESETS.map((preset) => (
                                    <button
                                      key={preset.label}
                                      type="button"
                                      className="flex-1 sm:flex-initial text-[11px] px-2.5 py-1 rounded-full border border-border bg-white/60 text-muted hover:bg-white hover:text-foreground hover:border-foreground/20 transition-colors cursor-pointer"
                                      onClick={() => {
                                        setSlotStartTime(preset.start);
                                        setSlotEndTime(preset.end);
                                      }}
                                    >
                                      {preset.label}
                                    </button>
                                  ))}
                                </div>

                                <div className="flex items-center gap-2">
                                  <Select
                                    value={slotStartTime}
                                    onValueChange={(val) => {
                                      if (!val) return;
                                      setSlotStartTime(val);
                                      if (!slotEndTime || slotEndTime <= val) {
                                        const [h, m] = val.split(":").map(Number);
                                        const endH = Math.min(h + 1, 22);
                                        setSlotEndTime(
                                          `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`
                                        );
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="flex-1 min-w-0 text-[13px] h-[30px] bg-white border-border shadow-[inset_0_2px_4px_rgba(0,0,0,0.12),inset_0_0_0_0.5px_rgba(0,0,0,0.06),0_1px_0_rgba(255,255,255,0.7)] rounded-[5px]">
                                      <SelectValue placeholder="Start time" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {TIME_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                          {opt.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <span className="flex items-center text-[11px] text-muted shrink-0">
                                    to
                                  </span>
                                  <Select
                                    value={slotEndTime}
                                    onValueChange={(val) => { if (val) setSlotEndTime(val); }}
                                  >
                                    <SelectTrigger className={`flex-1 min-w-0 text-[13px] h-[30px] bg-white border-border shadow-[inset_0_2px_4px_rgba(0,0,0,0.12),inset_0_0_0_0.5px_rgba(0,0,0,0.06),0_1px_0_rgba(255,255,255,0.7)] rounded-[5px] ${
                                      slotStartTime && slotEndTime && slotEndTime <= slotStartTime
                                        ? "!border-red-400"
                                        : ""
                                    }`}>
                                      <SelectValue placeholder="End time" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {TIME_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                          {opt.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <AnimatePresence>
                                  {slotStartTime && slotEndTime && slotEndTime <= slotStartTime && (
                                    <motion.p
                                      key="time-error"
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: "auto" }}
                                      exit={{ opacity: 0, height: 0 }}
                                      transition={{ duration: 0.2 }}
                                      className="text-[11px] text-red-500 -mt-1 overflow-hidden"
                                    >
                                      End time must be after start time
                                    </motion.p>
                                  )}
                                </AnimatePresence>

                                <motion.button
                                  type="submit"
                                  disabled={
                                    !slotDate ||
                                    !slotStartTime ||
                                    !slotEndTime ||
                                    slotEndTime <= slotStartTime
                                  }
                                  className="aqua-btn h-[30px] text-[13px] w-full"
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
                                >
                                  Add slot
                                </motion.button>
                              </motion.div>
                            )}
                          </AnimatePresence>
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
                                whileTap={{ scale: 0.95 }}
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
                            disabled={adding}
                            className="aqua-btn h-[32px] sm:h-[30px] text-[13px] w-full mt-1"
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
                            <AnimatePresence mode="wait" initial={false}>
                              {adding ? (
                                <motion.span
                                  key="saving"
                                  className="flex items-center justify-center gap-1.5"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.12 }}
                                >
                                  <span className="h-3 w-3 rounded-full border-[1.5px] border-white/30 border-t-white animate-spin" />
                                  Saving&hellip;
                                </motion.span>
                              ) : (
                                <motion.span
                                  key="save-label"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.12 }}
                                >
                                  {`Save ${pendingSlots.length} slot${pendingSlots.length !== 1 ? "s" : ""}`}
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </motion.button>
                        )}
                      </div>
                    </motion.div>
                  )}
                  {inputMode === "calendar" && (
                    <motion.div
                      key="calendar-form"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ type: "spring", duration: 0.25, bounce: 0 }}
                    >
                      <div className="flex flex-col gap-2">
                        <input
                          id="person-name-calendar"
                          type="text"
                          name="personName"
                          placeholder="Your name&hellip;"
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                            if (nameRequired) setNameRequired(false);
                          }}
                          className={`aqua-input w-full sm:w-48 ${nameRequired ? "!border-danger ring-2 ring-danger/30" : ""}`}
                          autoComplete="off"
                          spellCheck={false}
                        />

                        <InteractiveCalendar
                          selectedSlots={pendingSlots}
                          onAddSlot={(date, startTime, endTime) => {
                            playClick();
                            setPendingSlots((prev) => [
                              ...prev,
                              {
                                id: `ps-${++pendingIdCounter}`,
                                date,
                                startTime,
                                endTime,
                              },
                            ]);
                          }}
                          onRemoveSlot={(slotId) => {
                            playClick();
                            setPendingSlots((prev) =>
                              prev.filter((s) => s.id !== slotId)
                            );
                          }}
                        />

                        {pendingSlots.length > 0 && (
                          <motion.button
                            type="button"
                            onClick={handleSaveManualSlots}
                            disabled={adding}
                            className="aqua-btn h-[32px] sm:h-[30px] text-[13px] w-full mt-1"
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
                            <AnimatePresence mode="wait" initial={false}>
                              {adding ? (
                                <motion.span
                                  key="saving"
                                  className="flex items-center justify-center gap-1.5"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.12 }}
                                >
                                  <span className="h-3 w-3 rounded-full border-[1.5px] border-white/30 border-t-white animate-spin" />
                                  Saving&hellip;
                                </motion.span>
                              ) : (
                                <motion.span
                                  key="save-label"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ duration: 0.12 }}
                                >
                                  {`Save ${pendingSlots.length} slot${pendingSlots.length !== 1 ? "s" : ""}`}
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </motion.button>
                        )}
                      </div>
                    </motion.div>
                  )}
                  {inputMode === "google" && (
                    <motion.div
                      key="google-form"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ type: "spring", duration: 0.25, bounce: 0 }}
                    >
                      <div className="flex flex-col gap-3">
                        <input
                          id="person-name-google"
                          type="text"
                          name="personName"
                          placeholder="Your name&hellip;"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="aqua-input w-full sm:w-48"
                          autoComplete="off"
                          spellCheck={false}
                        />

                        <div className="rounded-lg border border-border bg-white/60 p-4 text-center">
                          <div className="flex justify-center mb-3">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                          </div>
                          <p className="text-[13px] text-foreground font-medium mb-1">
                            Import from Google Calendar
                          </p>
                          <p className="text-[11px] text-muted mb-3 leading-relaxed">
                            Connect your Google account to automatically import your
                            free times for the next 14 days (weekdays, 9 AM&ndash;5 PM).
                          </p>
                          <motion.button
                            type="button"
                            onClick={handleConnectGoogle}
                            disabled={!name.trim()}
                            className="aqua-btn h-[32px] sm:h-[34px] px-6 text-[13px] inline-flex items-center gap-2"
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
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                              <polyline points="10 17 15 12 10 7" />
                              <line x1="15" y1="12" x2="3" y2="12" />
                            </svg>
                            Connect Google Calendar
                          </motion.button>
                          <AnimatePresence>
                            {!name.trim() && (
                              <motion.p
                                key="name-hint"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="text-[10px] text-muted mt-2"
                              >
                                Enter your name above to continue
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>
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
                            <div className="group flex items-center gap-2 sm:gap-3 px-3 py-2.5 sm:py-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[13px] font-medium text-foreground">
                                    {link.personName}
                                  </span>
                                  <PlatformBadge platform={link.platform} />
                                  {link.tzLabel && (
                                    <span
                                      className="inline-flex items-center gap-1 px-1.5 py-px rounded text-[10px] font-semibold border bg-sky-50/80 text-sky-700 border-sky-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
                                      title={link.timezone || ""}
                                    >
                                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="2" y1="12" x2="22" y2="12" />
                                        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                                      </svg>
                                      {link.tzLabel}
                                    </span>
                                  )}
                                  {link.availability && (
                                    <button
                                      type="button"
                                      onClick={() => toggleExpandLink(link.id)}
                                      className="text-[11px] text-accent hover:text-accent/70 cursor-pointer tabular-nums transition-colors duration-150"
                                      style={{
                                        fontVariantNumeric: "tabular-nums",
                                      }}
                                    >
                                      {link.availability.length} slots
                                    </button>
                                  )}
                                </div>
                                {link.platform === "gcal" &&
                                  link.calendarEmail && (
                                    <p className="text-[11px] text-muted truncate mt-0.5">
                                      {link.calendarEmail}
                                    </p>
                                  )}
                                {link.platform !== "manual" &&
                                  link.platform !== "gcal" && (
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

                              {link.canRefresh && (
                                <motion.button
                                  onClick={() =>
                                    handleRefreshCalendar(link.id)
                                  }
                                  disabled={refreshing === link.id}
                                  className="p-1.5 rounded-md hover:bg-accent/10 text-muted hover:text-accent cursor-pointer transition-colors duration-150 disabled:opacity-50"
                                  whileTap={{ scale: 0.95 }}
                                  aria-label="Refresh calendar"
                                  title="Refresh availability from Google Calendar"
                                >
                                  <svg
                                    width="13"
                                    height="13"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                    className={
                                      refreshing === link.id
                                        ? "animate-spin"
                                        : ""
                                    }
                                  >
                                    <polyline points="23 4 23 10 17 10" />
                                    <polyline points="1 20 1 14 7 14" />
                                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                                  </svg>
                                </motion.button>
                              )}

                              <motion.button
                                onClick={() => handleRemoveLink(link.id)}
                                className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-150 p-1.5 rounded-md hover:bg-danger/10 text-muted hover:text-danger cursor-pointer"
                                whileTap={{ scale: 0.95 }}
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
                                    <div className="max-h-[280px] overflow-y-auto">
                                      <AnimatePresence mode="wait" initial={false}>
                                        {participantView === "list" ? (
                                          <motion.div
                                            key="p-list"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.15 }}
                                          >
                                            <SlotList
                                              slots={link.availability}
                                            />
                                          </motion.div>
                                        ) : (
                                          <motion.div
                                            key="p-calendar"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.15 }}
                                          >
                                            <WeekCalendar
                                              slots={link.availability}
                                            />
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
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
              <AnimatePresence>
                {session.links.length === 1 && (
                  <motion.p
                    key="min-hint"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={spring}
                    className="text-center text-[11px] text-muted"
                  >
                    Need at least 2 participants to find common times.
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Find Common Times */}
              <AnimatePresence>
                {session.links.length >= 2 && (
                  <motion.div
                    key="find-btn"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={spring}
                  >
                    <motion.button
                      onClick={handleFindCommon}
                      disabled={finding}
                      className="aqua-btn w-full h-[42px] sm:h-[34px] text-[14px]"
                      whileHover={{ scale: 1.01, filter: "brightness(1.06)" }}
                      whileTap={{ scale: 0.98, filter: "brightness(0.94)" }}
                      transition={{ type: "spring", duration: 0.2, bounce: 0 }}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {finding ? (
                          <motion.span
                            key="finding"
                            className="flex items-center justify-center gap-2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.12 }}
                          >
                            <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            Finding&hellip;
                          </motion.span>
                        ) : (
                          <motion.span
                            key="find-label"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.12 }}
                          >
                            Find Common Times
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
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
                <div className="aqua-title-bar">
                  <span className="flex-1 text-center text-[11px] font-semibold text-muted select-none">
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

                  {results.timezoneInsights && (
                    <TimezoneInsightsBanner insights={results.timezoneInsights} />
                  )}

                  {Object.keys(results.groupedLevels).length === 0 ? (
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
                    <AnimatePresence mode="wait" initial={false}>
                      {resultsView === "list" ? (
                        <motion.div
                          key="results-list"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          <div className="space-y-4">
                            {Object.entries(results.groupedLevels).map(
                              ([date, slots], dateIdx) => (
                                <motion.div
                                  key={date}
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{
                                    ...spring,
                                    delay: Math.min(0.25, 0.05 + dateIdx * 0.04),
                                  }}
                                >
                                  <h2 className="text-[13px] font-semibold text-foreground mb-1.5">
                                    {formatDate(date)}
                                  </h2>
                                  <div className="flex flex-wrap gap-1">
                                    {slots.map((slot, slotIdx) => (
                                      <LevelSlotBadge
                                        key={`${slot.start}-${slot.end}`}
                                        slot={slot}
                                        comfort={results.timezoneInsights?.slotComforts.find(
                                          (c) => c.start === slot.start && c.end === slot.end
                                        )?.comfort ?? null}
                                        delay={Math.min(0.3, 0.08 + dateIdx * 0.04 + slotIdx * 0.015)}
                                      />
                                    ))}
                                  </div>
                                </motion.div>
                              )
                            )}
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="results-calendar"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          <WeekCalendar
                            slots={results.commonSlots || []}
                            levelSlots={results.levelSlots}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
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

/* ── Level slot badge with hover tooltip ── */

function levelColor(count: number, total: number) {
  const ratio = count / total;
  if (ratio >= 1) return { bg: "bg-accent", text: "text-white", border: "border-accent" };
  if (ratio >= 0.75) return { bg: "bg-blue-200", text: "text-blue-900", border: "border-blue-300" };
  if (ratio >= 0.5) return { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-200" };
  if (ratio >= 0.25) return { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-100" };
  return { bg: "bg-blue-50/50", text: "text-blue-600", border: "border-blue-100/60" };
}

interface ComfortInfo {
  overallScore: number;
  perParticipant: TzParticipantComfort[];
}

function LevelSlotBadge({
  slot,
  comfort,
  delay: animDelay,
}: {
  slot: LevelSlot;
  comfort: ComfortInfo | null;
  delay: number;
}) {
  const colors = levelColor(slot.count, slot.total);

  const comfortBorder =
    comfort && comfort.overallScore < 0.5
      ? "ring-1 ring-amber-400/50"
      : "";

  const comfortDotColor = (label: string) => {
    if (label === "great") return "bg-emerald-500";
    if (label === "ok") return "bg-emerald-400";
    if (label === "early" || label === "late") return "bg-amber-400";
    return "bg-red-400";
  };

  return (
    <Popover openOnHover delay={200} closeDelay={100}>
      <PopoverTrigger asChild>
        <motion.span
          initial={{ opacity: 0, scale: 0.95, filter: "blur(2px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ ...spring, delay: animDelay }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border cursor-default select-none ${colors.bg} ${colors.text} ${colors.border} ${comfortBorder}`}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          <span
            className="inline-block w-[6px] h-[6px] rounded-full shrink-0"
            style={{
              background:
                slot.count === slot.total
                  ? "#16a34a"
                  : `rgba(26, 130, 247, ${Math.max(0.25, slot.count / slot.total)})`,
            }}
          />
          {formatTime(slot.start)} &ndash; {formatTime(slot.end)}
          <span className="text-[9px] opacity-70">
            {slot.count}/{slot.total}
          </span>
          {comfort && comfort.overallScore < 0.5 && (
            <span className="text-[9px] text-amber-600" title="Outside comfortable hours for some">
              &#9679;
            </span>
          )}
        </motion.span>
      </PopoverTrigger>
      <PopoverContent className="w-56 px-3 py-2.5 text-left aqua-panel" sideOffset={6}>
        <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1.5">
          {slot.count} of {slot.total} free
        </p>
        <div className="space-y-1">
          {slot.available.map((personName) => {
            const tzInfo = comfort?.perParticipant.find(
              (p) => p.name === personName
            );
            return (
              <div key={personName} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-[11px] text-foreground truncate flex-1">
                  {personName}
                </span>
                {tzInfo && (
                  <span
                    className={`text-[9px] px-1 py-px rounded ${comfortDotColor(tzInfo.label) === "bg-emerald-500" || comfortDotColor(tzInfo.label) === "bg-emerald-400" ? "text-emerald-700 bg-emerald-50" : comfortDotColor(tzInfo.label) === "bg-amber-400" ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50"}`}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {tzInfo.localTime}
                  </span>
                )}
              </div>
            );
          })}
          {slot.unavailable.map((personName) => {
            const tzInfo = comfort?.perParticipant.find(
              (p) => p.name === personName
            );
            return (
              <div key={personName} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                <span className="text-[11px] text-muted truncate flex-1">
                  {personName}
                </span>
                {tzInfo && (
                  <span
                    className="text-[9px] text-muted/70 px-1 py-px"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {tzInfo.localTime}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {comfort && comfort.overallScore < 0.7 && (
          <p className="mt-2 text-[9px] text-amber-600 border-t border-border/30 pt-1.5">
            {comfort.overallScore < 0.3
              ? "Outside working hours for some participants"
              : "Not ideal hours for all participants"}
          </p>
        )}
      </PopoverContent>
    </Popover>
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

/* ── Error Badge with popover ── */

function ErrorBadge({
  error,
  onRetry,
  isRetrying,
}: {
  error: string;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-center w-7 h-7 sm:w-6 sm:h-6 rounded-full bg-danger/10 text-danger cursor-pointer hover:bg-danger/20 transition-colors duration-150"
          aria-label="View parsing error"
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
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-3 text-left aqua-panel"
        align="end"
        sideOffset={6}
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
      </PopoverContent>
    </Popover>
  );
}

/* ── Timezone insights banner ── */

function TimezoneInsightsBanner({
  insights,
}: {
  insights: TimezoneInsights;
}) {
  const { goldenHours, participantTimezones, spansTzCount } = insights;

  const formatUtcHour = (h: number) => {
    const ampm = h >= 12 ? "PM" : "AM";
    const hr = h % 12 || 12;
    return `${hr} ${ampm}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", duration: 0.3, bounce: 0 }}
      className="mb-4 rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2.5"
    >
      <div className="flex items-start gap-2">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-sky-600 mt-0.5 shrink-0"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-sky-800">
            {spansTzCount} time zone{spansTzCount !== 1 ? "s" : ""} detected
          </p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            {participantTimezones.map((p) => (
              <span
                key={p.name}
                className="text-[10px] text-sky-700"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {p.name}{" "}
                <span className="text-sky-500">{p.label}</span>
              </span>
            ))}
          </div>
          {goldenHours ? (
            <p className="mt-1.5 text-[11px] text-sky-700">
              <span className="font-medium">Best hours for everyone:</span>{" "}
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatUtcHour(goldenHours.startUtcHour)}&ndash;
                {formatUtcHour(goldenHours.endUtcHour)} UTC
              </span>{" "}
              <span className="text-sky-500">
                ({goldenHours.widthHours}h window)
              </span>
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-amber-700">
              No fully comfortable overlap &mdash; some participants will be
              outside typical working hours. Hover slots to see local times.
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Unified share copy button (code / link) ── */

function ShareCopyButton({ text, label, icon }: { text: string; label: string; icon: "code" | "link" }) {
  const [copied, setCopied] = useState(false);
  const playClick = useSound("/sounds/click.mp3", 0.3);

  async function handleCopy() {
    playClick();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const iconSvg = icon === "link" ? (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  ) : (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );

  return (
    <motion.button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-[12px] font-semibold tracking-wide text-muted hover:text-accent cursor-pointer transition-colors duration-150"
      whileTap={{ scale: 0.95 }}
      aria-label={`Copy ${icon}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="copied"
            className="flex items-center gap-1 text-accent"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            copied
          </motion.span>
        ) : (
          <motion.span
            key="default"
            className="flex items-center gap-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            {iconSvg}
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
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
