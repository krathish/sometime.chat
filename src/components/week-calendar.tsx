"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

interface TimeSlot {
  start: string;
  end: string;
}

interface LevelSlot {
  start: string;
  end: string;
  count: number;
  total: number;
  available: string[];
  unavailable: string[];
}

interface WeekCalendarProps {
  slots: TimeSlot[];
  levelSlots?: LevelSlot[];
  busySlots?: TimeSlot[] | null;
  label?: string;
  participants?: { name: string }[];
  activeParticipants?: Set<string>;
  onToggleParticipant?: (name: string) => void;
  maxHeight?: string;
  visibleDays?: number;
}

const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_HEIGHT = 40;
const MOBILE_DAYS = 4;
const MOBILE_BREAKPOINT = 640;

function useIsMobile(breakpoint = MOBILE_BREAKPOINT): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    setIsMobile(mql.matches);
    function onChange(e: MediaQueryListEvent) {
      setIsMobile(e.matches);
    }
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [breakpoint]);
  return isMobile;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDateRange(start: Date, count: number): string {
  const end = addDays(start, count - 1);
  const mOpts: Intl.DateTimeFormatOptions = { month: "short" };
  const m1 = start.toLocaleDateString("en-US", mOpts);
  const m2 = end.toLocaleDateString("en-US", mOpts);
  const y = start.getFullYear();
  if (m1 === m2) {
    return `${m1} ${start.getDate()}\u2013${end.getDate()}, ${y}`;
  }
  return `${m1} ${start.getDate()} \u2013 ${m2} ${end.getDate()}, ${y}`;
}

export function WeekCalendar({ slots, levelSlots, busySlots, label, participants, activeParticipants, onToggleParticipant, maxHeight, visibleDays }: WeekCalendarProps) {
  const isMobile = useIsMobile();
  const hasLevels = levelSlots && levelSlots.length > 0;

  const visibleCount = visibleDays ?? (isMobile ? MOBILE_DAYS : 7);

  const [offset, setOffset] = useState(0);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const startDate = useMemo(() => {
    return addDays(today, offset);
  }, [today, offset]);

  const handlePrev = useCallback(() => {
    setOffset((o) => o - visibleCount);
  }, [visibleCount]);

  const handleNext = useCallback(() => {
    setOffset((o) => o + visibleCount);
  }, [visibleCount]);

  const handleToday = useCallback(() => {
    setOffset(0);
  }, []);

  const { hourStart, hourEnd, weekSlots, weekLevelSlots, weekBusySlots } = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < visibleCount; i++) days.push(addDays(startDate, i));

    const isInRange = (s: { start: Date; end: Date }) =>
      days.some(
        (d) =>
          isSameDay(s.start, d) ||
          isSameDay(s.end, d) ||
          (s.start <= d && s.end >= addDays(d, 1))
      );

    const filtered = slots
      .map((s) => ({ start: new Date(s.start), end: new Date(s.end) }))
      .filter(isInRange);

    const filteredBusy = busySlots
      ? busySlots
          .map((s) => ({ start: new Date(s.start), end: new Date(s.end) }))
          .filter(isInRange)
      : [];

    const filteredLevels = hasLevels
      ? levelSlots
          .map((s) => ({
            ...s,
            startDate: new Date(s.start),
            endDate: new Date(s.end),
          }))
          .filter((s) => isInRange({ start: s.startDate, end: s.endDate }))
      : [];

    return {
      hourStart: 6,
      hourEnd: 24,
      weekSlots: filtered,
      weekLevelSlots: filteredLevels,
      weekBusySlots: filteredBusy,
    };
  }, [startDate, visibleCount, slots, levelSlots, busySlots, hasLevels]);

  const totalHours = hourEnd - hourStart;
  const gridHeight = totalHours * HOUR_HEIGHT;

  function slotStyle(
    slot: { start: Date; end: Date },
    dayDate: Date
  ): React.CSSProperties | null {
    const dayStart = new Date(dayDate);
    dayStart.setHours(hourStart, 0, 0, 0);
    const dayEnd = new Date(dayDate);
    dayEnd.setHours(hourEnd, 0, 0, 0);

    const visStart = Math.max(slot.start.getTime(), dayStart.getTime());
    const visEnd = Math.min(slot.end.getTime(), dayEnd.getTime());
    if (visStart >= visEnd) return null;

    const topMinutes =
      (visStart - dayStart.getTime()) / 60000;
    const heightMinutes = (visEnd - visStart) / 60000;
    const totalMinutes = totalHours * 60;

    return {
      top: `${(topMinutes / totalMinutes) * 100}%`,
      height: `${Math.max((heightMinutes / totalMinutes) * 100, 1)}%`,
    };
  }

  const gridCols = `38px repeat(${visibleCount}, 1fr)`;

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      {/* Header */}
      {label && (
        <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">
          {label}
        </p>
      )}

      {participants && participants.length > 0 && activeParticipants && onToggleParticipant && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          <button
            type="button"
            onClick={() => onToggleParticipant("__all__")}
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-pointer transition-all duration-150 ${
              participants.every((p) => activeParticipants.has(p.name))
                ? "bg-accent text-white border-accent shadow-sm"
                : "bg-white/60 text-muted border-border/60 hover:border-border"
            }`}
          >
            Show all
          </button>
          {participants.map((p) => {
            const isActive = activeParticipants.has(p.name);
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => onToggleParticipant(p.name)}
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

      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] text-muted tabular-nums">
          {formatDateRange(startDate, visibleCount)}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrev}
            className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded hover:bg-white/80 text-muted hover:text-foreground transition-colors cursor-pointer"
            aria-label={isMobile ? "Previous days" : "Previous week"}
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
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="text-[10px] font-medium text-muted hover:text-foreground min-h-[32px] px-2 rounded hover:bg-white/80 transition-colors cursor-pointer"
            aria-label="Go to today"
          >
            Today
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded hover:bg-white/80 text-muted hover:text-foreground transition-colors cursor-pointer"
            aria-label={isMobile ? "Next days" : "Next week"}
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
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="week-cal-scroll-wrapper rounded-lg border border-border/60" style={maxHeight ? { maxHeight } : undefined}>
        <div className="week-cal-grid bg-white/50">
          {/* Day headers */}
          <div className="week-cal-header" style={{ gridTemplateColumns: gridCols }}>
            <div className="week-cal-time-col" />
            {Array.from({ length: visibleCount }, (_, i) => {
              const d = addDays(startDate, i);
              const isToday_ = isSameDay(d, today);
              return (
                <div
                  key={i}
                  className={`week-cal-day-header ${isToday_ ? "week-cal-today-header" : ""}`}
                >
                  <span className="text-[10px] font-medium">{DAY_NAMES_SHORT[d.getDay()]}</span>
                  <span
                    className={`text-[11px] font-semibold tabular-nums ${isToday_ ? "week-cal-today-num" : ""}`}
                  >
                    {d.getDate()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="week-cal-body" style={{ height: gridHeight, gridTemplateColumns: gridCols }}>
            {/* Time labels */}
            <div className="week-cal-time-col">
              {Array.from({ length: totalHours }, (_, i) => {
                const h = hourStart + i;
                const ampm = h >= 12 ? "PM" : "AM";
                const hour = h % 12 || 12;
                return (
                  <div
                    key={h}
                    className="week-cal-time-label"
                    style={{ height: HOUR_HEIGHT }}
                  >
                    <span className="text-[9px] text-muted tabular-nums">
                      {hour} {ampm}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Day columns */}
            {Array.from({ length: visibleCount }, (_, dayIdx) => {
              const dayDate = addDays(startDate, dayIdx);
              const isToday_ = isSameDay(dayDate, today);
              return (
                <div
                  key={dayIdx}
                  className={`week-cal-day-col ${isToday_ ? "week-cal-today-col" : ""}`}
                >
                  {/* Hour lines */}
                  {Array.from({ length: totalHours }, (_, hi) => (
                    <div
                      key={hi}
                      className="week-cal-hour-line"
                      style={{ top: hi * HOUR_HEIGHT }}
                    />
                  ))}

                  {isToday_ && (() => {
                    const nowMin = now.getHours() * 60 + now.getMinutes();
                    if (nowMin < hourStart * 60 || nowMin > hourEnd * 60) return null;
                    const pct = ((nowMin - hourStart * 60) / (totalHours * 60)) * 100;
                    return (
                      <div
                        className="absolute left-0 right-0 z-20 pointer-events-none"
                        style={{ top: `${pct}%` }}
                        aria-hidden="true"
                      >
                        <div className="absolute -left-[3px] -top-[3px] w-[7px] h-[7px] rounded-full bg-red-500" />
                        <div className="absolute left-0 right-0 top-0 h-[1.5px] bg-red-500" />
                      </div>
                    );
                  })()}

                  {/* Busy blocks */}
                  {weekBusySlots.map((slot, si) => {
                    const style = slotStyle(slot, dayDate);
                    if (!style) return null;
                    return (
                      <motion.div
                        key={`busy-${dayIdx}-${si}`}
                        className="week-cal-slot-busy"
                        style={style}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                          type: "spring",
                          duration: 0.3,
                          bounce: 0,
                          delay: si * 0.02,
                        }}
                      >
                        <span className="text-[8px] font-semibold uppercase tracking-wider text-gray-400 select-none">
                          Busy
                        </span>
                      </motion.div>
                    );
                  })}

                  {/* Free slot blocks */}
                  {hasLevels
                    ? weekLevelSlots.map((slot, si) => {
                        const style = slotStyle(
                          { start: slot.startDate, end: slot.endDate },
                          dayDate
                        );
                        if (!style) return null;
                        return (
                          <CalendarLevelSlot
                            key={`${dayIdx}-${si}`}
                            slot={slot}
                            style={style}
                            delay={si * 0.02}
                          />
                        );
                      })
                    : weekSlots.map((slot, si) => {
                        const style = slotStyle(slot, dayDate);
                        if (!style) return null;
                        return (
                          <motion.div
                            key={`${dayIdx}-${si}`}
                            className="week-cal-slot"
                            style={style}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{
                              type: "spring",
                              duration: 0.3,
                              bounce: 0,
                              delay: si * 0.02,
                            }}
                          />
                        );
                      })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {weekSlots.length === 0 && weekLevelSlots.length === 0 && weekBusySlots.length === 0 && (
          <motion.p
            key="no-slots"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="text-[11px] text-muted text-center mt-3"
          >
            No slots this week.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function slotLevelGradient(count: number, total: number): string {
  const ratio = count / total;
  if (ratio >= 1) return "linear-gradient(180deg, #34d399 0%, #10b981 100%)";
  if (ratio >= 0.75) return "linear-gradient(180deg, #6CB4F8 0%, #1A82F7 100%)";
  if (ratio >= 0.5) return "linear-gradient(180deg, #93c5fd 0%, #60a5fa 100%)";
  if (ratio >= 0.25) return "linear-gradient(180deg, #93c5fd 0%, #60a5fa 100%)";
  return "linear-gradient(180deg, #bfdbfe 0%, #93c5fd 100%)";
}

interface CalendarLevelSlotProps {
  slot: LevelSlot & { startDate: Date; endDate: Date };
  style: React.CSSProperties;
  delay: number;
}

function formatSlotTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatSlotDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function CalendarLevelSlot({ slot, style, delay }: CalendarLevelSlotProps) {
  const dateLabel = formatSlotDate(slot.start);
  const timeLabel = `${formatSlotTime(slot.start)} \u2013 ${formatSlotTime(slot.end)}`;
  const label = `${dateLabel}, ${timeLabel}, ${slot.count} of ${slot.total} free`;
  return (
    <Tooltip delay={200} closeDelay={100}>
      <TooltipTrigger
        render={
          <motion.div
            tabIndex={0}
            aria-label={label}
            className="week-cal-slot"
            style={{
              ...style,
              background: slotLevelGradient(slot.count, slot.total),
              opacity: Math.max(0.4, slot.count / slot.total),
              cursor: "default",
            }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: Math.max(0.4, slot.count / slot.total), scale: 1 }}
            whileHover={{ opacity: 1, scale: 1.04 }}
            whileFocus={{ opacity: 1, scale: 1.04 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0, delay }}
          />
        }
      />
      <TooltipContent
        className="!flex !flex-col !items-start !w-44 !max-w-none !gap-0 px-3 py-2.5 text-left aqua-panel !bg-popover !text-popover-foreground border border-border/30 shadow-md [&>svg]:hidden"
        sideOffset={6}
      >
        <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-0.5">
          {dateLabel}
        </p>
        <p className="text-[11px] font-medium text-foreground mb-0.5" style={{ fontVariantNumeric: "tabular-nums" }}>
          {timeLabel}
        </p>
        <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1.5">
          {slot.count} of {slot.total} free
        </p>
        <div className="space-y-1">
          {slot.available.map((name) => (
            <div key={name} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-[11px] text-foreground truncate">{name}</span>
            </div>
          ))}
          {slot.unavailable.map((name) => (
            <div key={name} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <span className="text-[11px] text-muted truncate">{name}</span>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
