"use client";

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SelectedSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

interface InteractiveCalendarProps {
  selectedSlots: SelectedSlot[];
  onAddSlot: (date: string, startTime: string, endTime: string) => void;
  onRemoveSlot: (slotId: string) => void;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_HEIGHT = 44;
const SNAP_MINUTES = 30;
const DEFAULT_HOUR_START = 7;
const DEFAULT_HOUR_END = 22;

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

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function snapMinutes(raw: number): number {
  return Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
}

function formatTimeLabel(h: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour} ${ampm}`;
}

function formatTimeShort(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${pad2(m)} ${ampm}`;
}

interface DragState {
  dayIdx: number;
  startMinutes: number;
  currentMinutes: number;
}

export function InteractiveCalendar({
  selectedSlots,
  onAddSlot,
  onRemoveSlot,
}: InteractiveCalendarProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [drag, setDrag] = useState<DragState | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);

  const monday = useMemo(() => {
    const today = new Date();
    return getMonday(addDays(today, weekOffset * 7));
  }, [weekOffset]);

  const hourStart = DEFAULT_HOUR_START;
  const hourEnd = DEFAULT_HOUR_END;
  const totalHours = hourEnd - hourStart;
  const gridHeight = totalHours * HOUR_HEIGHT;
  const today = new Date();

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(monday, i);
      return d.toLocaleDateString("en-CA");
    });
  }, [monday]);

  const slotsForDay = useCallback(
    (dayIdx: number) => {
      const dateStr = weekDates[dayIdx];
      return selectedSlots.filter((s) => s.date === dateStr);
    },
    [selectedSlots, weekDates]
  );

  function yToMinutes(y: number, colEl: HTMLDivElement): number {
    const rect = colEl.getBoundingClientRect();
    const relY = Math.max(0, Math.min(y - rect.top, rect.height));
    const fraction = relY / rect.height;
    const rawMinutes = hourStart * 60 + fraction * totalHours * 60;
    return snapMinutes(Math.max(hourStart * 60, Math.min(hourEnd * 60, rawMinutes)));
  }

  function handlePointerDown(e: React.PointerEvent, dayIdx: number) {
    const col = colRefs.current[dayIdx];
    if (!col) return;

    const target = e.target as HTMLElement;
    if (target.closest("[data-slot-block]")) return;

    e.preventDefault();
    col.setPointerCapture(e.pointerId);

    const minutes = yToMinutes(e.clientY, col);
    setDrag({ dayIdx, startMinutes: minutes, currentMinutes: minutes });
  }

  function handlePointerMove(e: React.PointerEvent, dayIdx: number) {
    if (!drag || drag.dayIdx !== dayIdx) return;
    const col = colRefs.current[dayIdx];
    if (!col) return;

    const minutes = yToMinutes(e.clientY, col);
    setDrag((prev) => (prev ? { ...prev, currentMinutes: minutes } : null));
  }

  function handlePointerUp(e: React.PointerEvent, dayIdx: number) {
    if (!drag || drag.dayIdx !== dayIdx) return;
    const col = colRefs.current[dayIdx];
    if (col) col.releasePointerCapture(e.pointerId);

    const minMin = Math.min(drag.startMinutes, drag.currentMinutes);
    const maxMin = Math.max(drag.startMinutes, drag.currentMinutes);

    if (maxMin - minMin >= SNAP_MINUTES) {
      const dateStr = weekDates[dayIdx];
      onAddSlot(dateStr, minutesToHHMM(minMin), minutesToHHMM(maxMin));
    }

    setDrag(null);
  }

  function slotPosition(startTime: string, endTime: string) {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    const totalMin = totalHours * 60;
    const offsetMin = hourStart * 60;

    const top = ((startMin - offsetMin) / totalMin) * 100;
    const height = ((endMin - startMin) / totalMin) * 100;
    return { top: `${top}%`, height: `${Math.max(height, 1)}%` };
  }

  function dragPreviewStyle(): React.CSSProperties | null {
    if (!drag) return null;
    const minMin = Math.min(drag.startMinutes, drag.currentMinutes);
    const maxMin = Math.max(drag.startMinutes, drag.currentMinutes);
    if (maxMin - minMin < SNAP_MINUTES) return null;

    const totalMin = totalHours * 60;
    const offsetMin = hourStart * 60;
    const top = ((minMin - offsetMin) / totalMin) * 100;
    const height = ((maxMin - minMin) / totalMin) * 100;
    return { top: `${top}%`, height: `${height}%` };
  }

  useEffect(() => {
    function handleGlobalUp() {
      if (drag) setDrag(null);
    }
    window.addEventListener("pointerup", handleGlobalUp);
    return () => window.removeEventListener("pointerup", handleGlobalUp);
  }, [drag]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] text-muted">
          Click &amp; drag to mark your free times
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w - 1)}
            className="p-1 rounded hover:bg-white/80 text-muted hover:text-foreground transition-colors cursor-pointer"
            aria-label="Previous week"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      <p className="text-[11px] text-muted mb-2 tabular-nums">
        {formatMonthRange(monday)}
      </p>

      <div className="week-cal-scroll-wrapper rounded-lg border border-border/60 max-h-[320px] overflow-y-auto">
        <div className="week-cal-grid bg-white/50">
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

          <div
            ref={bodyRef}
            className="week-cal-body"
            style={{ height: gridHeight }}
          >
            <div className="week-cal-time-col">
              {Array.from({ length: totalHours }, (_, i) => (
                <div
                  key={hourStart + i}
                  className="week-cal-time-label"
                  style={{ height: HOUR_HEIGHT }}
                >
                  <span className="text-[9px] text-muted tabular-nums">
                    {formatTimeLabel(hourStart + i)}
                  </span>
                </div>
              ))}
            </div>

            {Array.from({ length: 7 }, (_, dayIdx) => {
              const dayDate = addDays(monday, dayIdx);
              const isToday = isSameDay(dayDate, today);
              const daySlots = slotsForDay(dayIdx);
              const preview = drag?.dayIdx === dayIdx ? dragPreviewStyle() : null;

              return (
                <div
                  key={dayIdx}
                  ref={(el) => { colRefs.current[dayIdx] = el; }}
                  className={`week-cal-day-col interactive-cal-col ${isToday ? "week-cal-today-col" : ""}`}
                  onPointerDown={(e) => handlePointerDown(e, dayIdx)}
                  onPointerMove={(e) => handlePointerMove(e, dayIdx)}
                  onPointerUp={(e) => handlePointerUp(e, dayIdx)}
                  style={{ touchAction: "none" }}
                >
                  {Array.from({ length: totalHours }, (_, hi) => (
                    <div
                      key={hi}
                      className="week-cal-hour-line"
                      style={{ top: hi * HOUR_HEIGHT }}
                    />
                  ))}

                  {preview && (
                    <div
                      className="interactive-cal-preview"
                      style={preview}
                    />
                  )}

                  <AnimatePresence>
                    {daySlots.map((slot) => {
                      const pos = slotPosition(slot.startTime, slot.endTime);
                      return (
                        <motion.div
                          key={slot.id}
                          data-slot-block
                          className="interactive-cal-selected"
                          style={pos}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ type: "spring", duration: 0.25, bounce: 0 }}
                        >
                          <span className="interactive-cal-label">
                            {formatTimeShort(slot.startTime)} &ndash; {formatTimeShort(slot.endTime)}
                          </span>
                          <button
                            type="button"
                            className="interactive-cal-remove"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveSlot(slot.id);
                            }}
                            aria-label="Remove slot"
                          >
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
