"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";

interface TimeSlot {
  start: string;
  end: string;
}

interface WeekCalendarProps {
  slots: TimeSlot[];
  label?: string;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_HEIGHT = 40;

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

function formatMonthRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  const mOpts: Intl.DateTimeFormatOptions = { month: "short" };
  const m1 = monday.toLocaleDateString("en-US", mOpts);
  const m2 = sunday.toLocaleDateString("en-US", mOpts);
  const y = monday.getFullYear();
  if (m1 === m2) {
    return `${m1} ${monday.getDate()}\u2013${sunday.getDate()}, ${y}`;
  }
  return `${m1} ${monday.getDate()} \u2013 ${m2} ${sunday.getDate()}, ${y}`;
}

export function WeekCalendar({ slots, label }: WeekCalendarProps) {
  const [weekOffset, setWeekOffset] = useState(() => {
    if (slots.length === 0) return 0;
    const earliest = new Date(
      slots.reduce(
        (min, s) => (s.start < min ? s.start : min),
        slots[0].start
      )
    );
    const today = new Date();
    const todayMonday = getMonday(today);
    const slotMonday = getMonday(earliest);
    const diff = Math.round(
      (slotMonday.getTime() - todayMonday.getTime()) / (7 * 86400000)
    );
    return diff;
  });

  const monday = useMemo(() => {
    const today = new Date();
    return getMonday(addDays(today, weekOffset * 7));
  }, [weekOffset]);

  const { hourStart, hourEnd, weekSlots } = useMemo(() => {
    const weekDays: Date[] = [];
    for (let i = 0; i < 7; i++) weekDays.push(addDays(monday, i));

    const filtered = slots
      .map((s) => ({ start: new Date(s.start), end: new Date(s.end) }))
      .filter((s) => {
        return weekDays.some(
          (d) =>
            isSameDay(s.start, d) ||
            isSameDay(s.end, d) ||
            (s.start <= d && s.end >= addDays(d, 1))
        );
      });

    let minH = 8;
    let maxH = 20;
    for (const s of filtered) {
      minH = Math.min(minH, s.start.getHours());
      maxH = Math.max(maxH, s.end.getHours() + (s.end.getMinutes() > 0 ? 1 : 0));
    }
    minH = Math.max(0, minH);
    maxH = Math.min(24, maxH);
    if (maxH <= minH) maxH = minH + 1;

    return {
      hourStart: minH,
      hourEnd: maxH,
      weekSlots: filtered,
    };
  }, [monday, slots]);

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

  const today = new Date();

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        {label && (
          <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
            {label}
          </span>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w - 1)}
            className="p-1 rounded hover:bg-white/80 text-muted hover:text-foreground transition-colors cursor-pointer"
            aria-label="Previous week"
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
            onClick={() => setWeekOffset(0)}
            className="text-[10px] font-medium text-muted hover:text-foreground px-1.5 py-0.5 rounded hover:bg-white/80 transition-colors cursor-pointer"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w + 1)}
            className="p-1 rounded hover:bg-white/80 text-muted hover:text-foreground transition-colors cursor-pointer"
            aria-label="Next week"
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

      <p className="text-[11px] text-muted mb-2 tabular-nums">
        {formatMonthRange(monday)}
      </p>

      {/* Calendar grid */}
      <div className="week-cal-grid border border-border/60 rounded-lg overflow-hidden bg-white/50">
        {/* Day headers */}
        <div className="week-cal-header">
          <div className="week-cal-time-col" />
          {Array.from({ length: 7 }, (_, i) => {
            const d = addDays(monday, i);
            const isToday = isSameDay(d, today);
            return (
              <div
                key={i}
                className={`week-cal-day-header ${isToday ? "week-cal-today-header" : ""}`}
              >
                <span className="text-[10px] font-medium">{DAY_NAMES[i]}</span>
                <span
                  className={`text-[11px] font-semibold tabular-nums ${isToday ? "week-cal-today-num" : ""}`}
                >
                  {d.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="week-cal-body" style={{ height: gridHeight }}>
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
          {Array.from({ length: 7 }, (_, dayIdx) => {
            const dayDate = addDays(monday, dayIdx);
            const isToday = isSameDay(dayDate, today);
            return (
              <div
                key={dayIdx}
                className={`week-cal-day-col ${isToday ? "week-cal-today-col" : ""}`}
              >
                {/* Hour lines */}
                {Array.from({ length: totalHours }, (_, hi) => (
                  <div
                    key={hi}
                    className="week-cal-hour-line"
                    style={{ top: hi * HOUR_HEIGHT }}
                  />
                ))}

                {/* Slot blocks */}
                {weekSlots.map((slot, si) => {
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

      {weekSlots.length === 0 && (
        <p className="text-[11px] text-muted text-center mt-3">
          No slots this week.
        </p>
      )}
    </div>
  );
}
