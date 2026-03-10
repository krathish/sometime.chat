"use client";

import { useState, useEffect, useCallback, useRef, use, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { toast } from "sonner";
import { PlatformBadge } from "@/components/platform-badge";
import { WeekCalendar } from "@/components/week-calendar";
import { InteractiveCalendar } from "@/components/interactive-calendar";
import { useSound } from "@/lib/use-sound";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  busySlots: { start: string; end: string }[] | null;
  error: string | null;
  canRefresh?: boolean;
  calendarEmail?: string | null;
  timezone?: string | null;
  tzLabel?: string | null;
}

interface InviteData {
  id: string;
  email: string;
  status: string;
  sentAt: string;
  openedAt: string | null;
  joinedAt: string | null;
}

interface SessionData {
  id: string;
  code: string | null;
  name: string | null;
  links: LinkData[];
  invites: InviteData[];
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

type InputMode = "calendar" | "google" | "link";
type ViewMode = "list" | "calendar";

const spring = { type: "spring" as const, duration: 0.35, bounce: 0 };
const exitSpring = { type: "spring" as const, duration: 0.28, bounce: 0 };
const enterAnim = {
  initial: { opacity: 0, y: 8, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -4, filter: "blur(4px)", transition: exitSpring },
  transition: spring,
};

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
  const [inputMode, setInputMode] = useState<InputMode>("calendar");
  const [pendingSlots, setPendingSlots] = useState<PendingSlot[]>([]);
  const [resultsView, setResultsView] = useState<ViewMode>("list");
  const [expandedLink, setExpandedLink] = useState<string | null>(null);
  const [participantView, setParticipantView] = useState<ViewMode>("list");
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const submitCountRef = useRef(0);
  const [lastSubmittedName, setLastSubmittedName] = useState("");
  const [shareTooltipOpen, setShareTooltipOpen] = useState(false);
  const [activeParticipants, setActiveParticipants] = useState<Set<string>>(new Set());
  const [resultsHaveSlots, setResultsHaveSlots] = useState(false);
  const shareTooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const playClick = useSound("/sounds/click.mp3", 0.4);
  const playClose = useSound("/sounds/close.mp3", 0.5);
  const playNotify = useSound("/sounds/notify.mp3", 0.5);
  const playError = useSound("/sounds/error.mp3", 0.45);
  const playTab = useSound("/sounds/tab.mp3", 0.4);
  const gcalHandled = useRef(false);
  const inviteHandled = useRef(false);
  const [inviteEmails, setInviteEmails] = useState("");
  const [sendingInvites, setSendingInvites] = useState(false);
  const [inviteId, setInviteId] = useState<string | null>(null);

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
      setLastSubmittedName(gcalName || "");
      submitCountRef.current += 1;
      setHasSubmitted(true);
      setShareTooltipOpen(true);
    } else if (gcal === "denied") {
      playError();
      toast.error("Google Calendar access was denied");
    } else if (gcal === "error") {
      playError();
      toast.error("Failed to connect Google Calendar");
    }

    router.replace(`/s/${id}`, { scroll: false });
  }, [searchParams, id, router, playNotify, playError]);

  useEffect(() => {
    if (inviteHandled.current) return;
    const inv = searchParams.get("invite");
    if (!inv) return;
    inviteHandled.current = true;
    setInviteId(inv);

    fetch(`/api/sessions/${id}/invites`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId: inv, status: "opened" }),
    }).catch(() => {});

    router.replace(`/s/${id}`, { scroll: false });
  }, [searchParams, id, router]);

  useEffect(() => {
    if (shareTooltipOpen) {
      shareTooltipTimer.current = setTimeout(() => setShareTooltipOpen(false), 8000);
    }
    return () => {
      if (shareTooltipTimer.current) clearTimeout(shareTooltipTimer.current);
    };
  }, [shareTooltipOpen]);

  async function handleSendInvites(e: React.FormEvent) {
    e.preventDefault();
    const emails = inviteEmails
      .split(/[,;\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.includes("@"));

    if (emails.length === 0) {
      playError();
      toast.error("Enter at least one email address");
      return;
    }

    playClick();
    setSendingInvites(true);
    try {
      const res = await fetch(`/api/sessions/${id}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      const data = await res.json();

      if (!res.ok) {
        playError();
        toast.error(data.error || "Failed to send invites");
        return;
      }

      playNotify();
      const msg =
        data.sent === 1
          ? "Invite sent!"
          : `${data.sent} invites sent!`;
      toast.success(data.failed > 0 ? `${msg} (${data.failed} failed)` : msg);
      setInviteEmails("");
      await fetchSession();
    } catch {
      playError();
      toast.error("Failed to send invites");
    } finally {
      setSendingInvites(false);
    }
  }

  async function handleNativeShare() {
    playClick();
    const shareData = {
      title: session?.name || "Sometime.Chat",
      text: `Share your availability for "${session?.name || "Sometime.Chat"}"`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard");
    }
  }

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
        body: JSON.stringify({ url: url.trim(), personName: name.trim(), timezone: tz, inviteId }),
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

      setLastSubmittedName(name.trim());
      submitCountRef.current += 1;
      setUrl("");
      setName("");
      setHasSubmitted(true);
      setShareTooltipOpen(true);
      await fetchSession();
    } catch {
      playError();
      toast.error("Something went wrong");
    } finally {
      setAdding(false);
    }
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
        body: JSON.stringify({ personName: name.trim(), slots, timezone: tz, inviteId }),
      });
      const data = await res.json();

      if (!res.ok) {
        playError();
        toast.error(data.error || "Failed to save slots");
        return;
      }

      toast.success(`Added ${data.slotsFound} manual slots`);
      setLastSubmittedName(name.trim());
      submitCountRef.current += 1;
      setName("");
      setPendingSlots([]);
      setHasSubmitted(true);
      setShareTooltipOpen(true);
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
      const allNames = (data.participants as { name: string }[]).map((p) => p.name);
      setActiveParticipants(new Set(allNames));

      const slotCount = Object.values(
        data.groupedLevels as Record<string, unknown[]>
      ).reduce((sum: number, day: unknown[]) => sum + day.length, 0);

      setResultsHaveSlots(slotCount > 0);
      if (slotCount > 0) {
        playNotify();
        setTimeout(() => {
          if (resultsRef.current) {
            smoothScrollTo(resultsRef.current);
          }
        }, 80);
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

  function toggleParticipant(name: string) {
    playClick();
    setActiveParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        if (next.size > 1) next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  const filteredResults = useMemo(() => {
    if (!results) return null;
    const filtered = results.levelSlots
      .map((slot) => {
        const available = slot.available.filter((n) => activeParticipants.has(n));
        const unavailable = [
          ...slot.unavailable.filter((n) => activeParticipants.has(n)),
          ...slot.available.filter((n) => !activeParticipants.has(n)),
        ];
        return { ...slot, available, unavailable, count: available.length, total: activeParticipants.size };
      })
      .filter((slot) => slot.available.length > 0);

    const groupedLevels: Record<string, LevelSlot[]> = {};
    for (const slot of filtered) {
      const date = new Date(slot.start).toLocaleDateString("en-CA");
      if (!groupedLevels[date]) groupedLevels[date] = [];
      groupedLevels[date].push(slot);
    }
    return { levelSlots: filtered, groupedLevels };
  }, [results, activeParticipants]);

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
              <h1 className="sr-only">{session.name || "Untitled Session"} — Sometime.Chat</h1>
              {/* Event name + Share */}
              <div className="flex items-center justify-between gap-4">
                {/* Left: Event Name */}
                <div className="min-w-0">
                  <label htmlFor="event-name-input" className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                    Event Name
                  </label>
                  <div className="group/name mt-0.5 flex items-center gap-1.5 h-[30px]">
                    <AnimatePresence mode="wait" initial={false}>
                      {editingName ? (
                        <motion.input
                          key="name-input"
                          id="event-name-input"
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
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        />
                      ) : (
                        <motion.button
                          key="name-display"
                          type="button"
                          onClick={startEditingName}
                          aria-label={`Edit session name: ${session.name || "Untitled Session"}`}
                          className="text-[20px] leading-[30px] h-[30px] font-semibold text-foreground cursor-pointer flex items-center gap-1.5 hover:text-accent transition-colors duration-150 truncate"
                          whileTap={{ scale: 0.98 }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
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
                    </AnimatePresence>
                  </div>
                </div>

                {/* Right: Share */}
                <div className="shrink-0">
                  <div className="flex items-center gap-1.5 h-full justify-end">
                    {session.code && (
                      <ShareCopyButton text={session.code} label={session.code} icon="code" />
                    )}
                    <span className="text-muted/25 text-[10px]">|</span>
                    <Popover
                      open={shareTooltipOpen}
                      onOpenChange={(open) => {
                        if (!open) setShareTooltipOpen(false);
                      }}
                    >
                      <PopoverTrigger asChild>
                        <span>
                          <ShareCopyButton
                            text={shareUrl}
                            label="link"
                            icon="link"
                            onCopied={() => setShareTooltipOpen(false)}
                          />
                        </span>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-56 px-3 py-2.5 text-left aqua-panel"
                        align="end"
                        sideOffset={8}
                      >
                        <div className="flex items-start gap-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sky-500 mt-0.5 shrink-0" aria-hidden="true">
                            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                            <polyline points="16 6 12 2 8 6" />
                            <line x1="12" y1="2" x2="12" y2="15" />
                          </svg>
                          <p className="text-[11px] text-foreground/80 leading-relaxed">
                            Share this link so others can add their availability
                          </p>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              {/* Invite People — hidden for now, enable with NEXT_PUBLIC_ENABLE_INVITES=1 */}
              {process.env.NEXT_PUBLIC_ENABLE_INVITES === "1" && <div>
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                  Invite People
                </span>
                <div className="mt-1.5 space-y-2">
                  <form onSubmit={handleSendInvites} className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      aria-label="Email addresses, comma separated"
                      placeholder="Email addresses (comma separated)&hellip;"
                      value={inviteEmails}
                      onChange={(e) => setInviteEmails(e.target.value)}
                      className="aqua-input sm:flex-1 min-w-0"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <div className="flex gap-2 sm:gap-1.5">
                      <motion.button
                        type="submit"
                        disabled={sendingInvites || !inviteEmails.trim()}
                        className="aqua-btn h-[32px] sm:h-[30px] px-4 text-[13px] flex-1 sm:flex-initial"
                        whileHover={{ scale: 1.02, filter: "brightness(1.06)" }}
                        whileTap={{ scale: 0.96, filter: "brightness(0.94)" }}
                        transition={{ type: "spring", duration: 0.2, bounce: 0 }}
                      >
                        <AnimatePresence mode="wait" initial={false}>
                          {sendingInvites ? (
                            <motion.span
                              key="sending"
                              className="flex items-center justify-center gap-1.5"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.12 }}
                            >
                              <span className="h-3 w-3 rounded-full border-[1.5px] border-white/30 border-t-white animate-spin" />
                              Sending&hellip;
                            </motion.span>
                          ) : (
                            <motion.span
                              key="send-label"
                              className="flex items-center gap-1.5"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.12 }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                              </svg>
                              Send
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={handleNativeShare}
                        className="aqua-btn h-[32px] sm:h-[30px] px-3 text-[13px]"
                        whileHover={{ scale: 1.02, filter: "brightness(1.06)" }}
                        whileTap={{ scale: 0.96, filter: "brightness(0.94)" }}
                        transition={{ type: "spring", duration: 0.2, bounce: 0 }}
                        title="Share via apps"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                          <polyline points="16 6 12 2 8 6" />
                          <line x1="12" y1="2" x2="12" y2="15" />
                        </svg>
                      </motion.button>
                    </div>
                  </form>

                  <AnimatePresence mode="popLayout">
                    {session.invites && session.invites.length > 0 && (
                      <motion.ul
                        layout
                        className="space-y-1"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={spring}
                      >
                        {session.invites.map((inv, i) => (
                          <motion.li
                            key={inv.id}
                            layout
                            initial={{ opacity: 0, y: 6, filter: "blur(3px)" }}
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            exit={{ opacity: 0, x: -6, filter: "blur(3px)" }}
                            transition={{ ...spring, delay: i * 0.02 }}
                            className="flex items-center justify-between gap-2 rounded-md border border-border bg-white/60 px-3 py-1.5"
                          >
                            <span className="text-[12px] text-foreground truncate min-w-0">
                              {inv.email}
                            </span>
                            <InviteStatusBadge status={inv.status} />
                          </motion.li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>
              </div>}

              {/* Add Availability */}
              <div>
                <AnimatePresence mode="popLayout" initial={false}>
                  {hasSubmitted ? (
                    <motion.div
                      key="success-state"
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, filter: "blur(4px)" }}
                      transition={spring}
                      className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-5 text-center"
                    >
                      <motion.div
                        className="flex justify-center mb-2"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", duration: 0.5, bounce: 0.35, delay: 0.08 }}
                      >
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-600">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      </motion.div>
                      <motion.p
                        className="text-[13px] font-medium text-emerald-800"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", duration: 0.35, bounce: 0, delay: 0.18 }}
                      >
                        {submitCountRef.current <= 1
                          ? "Your availability has been added"
                          : `${lastSubmittedName}\u2019s availability has been added`}
                      </motion.p>
                      <motion.p
                        className="text-[11px] text-emerald-600/80 mt-1"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: "spring", duration: 0.35, bounce: 0, delay: 0.25 }}
                      >
                        Share the link above so others can add theirs.
                      </motion.p>
                      <motion.button
                        type="button"
                        onClick={() => {
                          playClick();
                          setHasSubmitted(false);
                          setShareTooltipOpen(false);
                        }}
                        className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700 hover:text-emerald-900 cursor-pointer transition-colors duration-150"
                        whileTap={{ scale: 0.97 }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2, delay: 0.35 }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add another person&apos;s availability
                      </motion.button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="add-form"
                      initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, filter: "blur(4px)" }}
                      transition={spring}
                    >
                <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                  Add Your Availability
                </span>

                <input
                  id="person-name"
                  type="text"
                  name="personName"
                  aria-label="Your name"
                  aria-describedby={nameRequired ? "name-error" : undefined}
                  aria-invalid={nameRequired}
                  placeholder="Your name&hellip;"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameRequired) setNameRequired(false);
                  }}
                  className={`aqua-input w-full mt-1.5 mb-2 ${nameRequired ? "!border-danger ring-2 ring-danger/30" : ""}`}
                  autoComplete="off"
                  spellCheck={false}
                />
                <AnimatePresence>
                  {nameRequired && (
                    <motion.p
                      id="name-error"
                      role="alert"
                      className="text-[11px] text-danger -mt-1 mb-2"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -2 }}
                      transition={{ type: "spring", duration: 0.25, bounce: 0 }}
                    >
                      Name is required to save slots
                    </motion.p>
                  )}
                </AnimatePresence>

                <div role="tablist" aria-label="Availability input mode" className="aqua-tab-group mb-2">
                  {(["calendar", "google", "link"] as InputMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      role="tab"
                      aria-selected={inputMode === mode}
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
                          id="scheduling-url"
                          type="url"
                          name="url"
                          aria-label="Scheduling link URL"
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
                  {inputMode === "calendar" && (
                    <motion.div
                      key="calendar-form"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ type: "spring", duration: 0.25, bounce: 0 }}
                    >
                      <div className="flex flex-col gap-2">
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

                        <AnimatePresence>
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
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{
                                type: "spring",
                                duration: 0.2,
                                bounce: 0,
                              }}
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
                        </AnimatePresence>
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
                            className="aqua-btn h-[32px] sm:h-[34px] px-6 text-[11px] sm:text-[13px] inline-flex items-center gap-2"
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
                                : "border-gray-200 bg-white/60"
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
                                    <Tooltip>
                                      <TooltipTrigger
                                        render={<span />}
                                        className="inline-flex items-center gap-1 px-1.5 py-px rounded text-[10px] font-semibold border bg-sky-50/80 text-sky-700 border-sky-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] cursor-default"
                                      >
                                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                          <circle cx="12" cy="12" r="10" />
                                          <line x1="2" y1="12" x2="22" y2="12" />
                                          <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                                        </svg>
                                        {link.tzLabel}
                                      </TooltipTrigger>
                                      <TooltipContent>{link.timezone || link.tzLabel}</TooltipContent>
                                    </Tooltip>
                                  )}
                                  {link.availability && (
                                    <button
                                      type="button"
                                      onClick={() => toggleExpandLink(link.id)}
                                      aria-expanded={expandedLink === link.id}
                                      aria-controls={`slot-detail-${link.id}`}
                                      aria-label={`${link.availability.length} slots – toggle availability for ${link.personName}`}
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
                                  type="button"
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
                                type="button"
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
                                  id={`slot-detail-${link.id}`}
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
                                        id="participant"
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
                                              busySlots={link.busySlots}
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
                                              busySlots={link.busySlots}
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
                      type="button"
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
          <div aria-live="polite" aria-atomic="false">
          <AnimatePresence>
            {results && (
              <motion.div
                ref={resultsRef}
                initial={{ opacity: 0, y: 16, scale: 0.98, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                transition={{
                  ...spring,
                  delay: 0.05,
                  ...(resultsHaveSlots ? { duration: 0.5, bounce: 0.12 } : {}),
                }}
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
                    id="results"
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

                  {Object.keys(filteredResults?.groupedLevels ?? {}).length === 0 ? (
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
                          {results.participants.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {results.participants.map((p) => {
                                const isActive = activeParticipants.has(p.name);
                                return (
                                  <button
                                    key={p.name}
                                    type="button"
                                    onClick={() => toggleParticipant(p.name)}
                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-pointer transition-all duration-150 ${
                                      isActive
                                        ? "bg-accent text-white border-accent shadow-sm"
                                        : "bg-white/60 text-muted border-border/60 hover:border-border"
                                    }`}
                                  >
                                    {p.name}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <div className="space-y-4">
                            {Object.entries(filteredResults?.groupedLevels ?? {}).map(
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
                            levelSlots={filteredResults?.levelSlots ?? []}
                            participants={results.participants}
                            activeParticipants={activeParticipants}
                            onToggleParticipant={toggleParticipant}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </LayoutGroup>
      </div>
    </main>
  );
}

/* ── Slot list (reusable for participant detail) ── */

function SlotList({
  slots,
  busySlots,
}: {
  slots: { start: string; end: string }[];
  busySlots?: { start: string; end: string }[] | null;
}) {
  const grouped: Record<string, { start: string; end: string; type: "free" | "busy" }[]> = {};
  for (const slot of slots) {
    const date = new Date(slot.start).toLocaleDateString("en-CA");
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push({ ...slot, type: "free" });
  }
  if (busySlots) {
    for (const slot of busySlots) {
      const date = new Date(slot.start).toLocaleDateString("en-CA");
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push({ ...slot, type: "busy" });
    }
  }

  for (const date of Object.keys(grouped)) {
    grouped[date].sort((a, b) => a.start.localeCompare(b.start));
  }

  const sortedDates = Object.keys(grouped).sort();

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto">
      {sortedDates.map((date) => (
        <div key={date}>
          <p className="text-[11px] font-semibold text-foreground mb-0.5">
            {formatDate(date)}
          </p>
          <div className="flex flex-wrap gap-1">
            {grouped[date].map((s) => (
              <span
                key={`${s.type}-${s.start}-${s.end}`}
                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${
                  s.type === "busy"
                    ? "bg-gray-100 text-gray-400 border-gray-200"
                    : "bg-accent-light text-accent border-accent/15"
                }`}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {s.type === "busy" && (
                  <span className="mr-1 text-[9px] uppercase tracking-wide">Busy</span>
                )}
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
          tabIndex={0}
          role="button"
          aria-label={`${formatTime(slot.start)} to ${formatTime(slot.end)}, ${slot.count} of ${slot.total} free – view details`}
          initial={{ opacity: 0, scale: 0.95, filter: "blur(2px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ ...spring, delay: animDelay }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border cursor-pointer select-none ${colors.bg} ${colors.text} ${colors.border} ${comfortBorder}`}
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
            <span className="text-[9px] text-amber-600" aria-label="Outside comfortable hours for some">
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
  id: toggleId = "view",
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
  id?: string;
}) {
  return (
    <div className="flex items-center gap-0.5 bg-white/60 border border-border/60 rounded-md p-0.5">
      {(["list", "calendar"] as ViewMode[]).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`relative p-1 rounded cursor-pointer transition-colors duration-150 ${
            view === mode
              ? "text-white"
              : "text-muted hover:text-foreground"
          }`}
          aria-label={mode === "list" ? "List view" : "Calendar view"}
        >
          {view === mode && (
            <motion.span
              layoutId={`view-toggle-${toggleId}`}
              className="absolute inset-0 rounded bg-accent shadow-sm"
              transition={{ type: "spring", duration: 0.25, bounce: 0.1 }}
            />
          )}
          <span className="relative z-[1]">
            {mode === "list" ? (
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
            ) : (
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
            )}
          </span>
        </button>
      ))}
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

  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const formatHourInLocalTz = (utcHour: number) => {
    const d = new Date();
    d.setUTCHours(utcHour, 0, 0, 0);
    return d.toLocaleTimeString("en-US", {
      timeZone: userTz,
      hour: "numeric",
      hour12: true,
    });
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
                {formatHourInLocalTz(goldenHours.startUtcHour)}&ndash;
                {formatHourInLocalTz(goldenHours.endUtcHour)}
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

function ShareCopyButton({ text, label, icon, onCopied }: { text: string; label: string; icon: "code" | "link"; onCopied?: () => void }) {
  const [copied, setCopied] = useState(false);
  const playClick = useSound("/sounds/click.mp3", 0.3);

  async function handleCopy() {
    playClick();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    onCopied?.();
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

/* ── Invite status badge ── */

function InviteStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; classes: string }> = {
    sent: {
      label: "Sent",
      classes: "bg-slate-100 text-slate-600 border-slate-200",
    },
    opened: {
      label: "Opened",
      classes: "bg-amber-50 text-amber-700 border-amber-200",
    },
    joined: {
      label: "Joined",
      classes: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
  };

  const c = config[status] || config.sent;

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-px rounded text-[10px] font-semibold border shrink-0 ${c.classes}`}
    >
      {status === "joined" && (
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {c.label}
    </span>
  );
}

/* ── Smooth scroll with ease-out-quint ── */

function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}

function smoothScrollTo(element: HTMLElement, duration = 500, offset = 24) {
  const start = window.scrollY;
  const targetY = element.getBoundingClientRect().top + start - offset;
  const distance = targetY - start;

  if (Math.abs(distance) < 1) return;

  let startTime: number | null = null;

  function step(timestamp: number) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutQuint(progress);

    window.scrollTo(0, start + distance * eased);

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

/* ── Helpers ── */

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
