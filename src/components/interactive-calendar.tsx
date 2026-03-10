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

const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_HEIGHT = 44;
const SNAP_MINUTES = 30;
const DEFAULT_HOUR_START = 7;
const DEFAULT_HOUR_END = 22;
const MOBILE_DAYS = 4;
const MOBILE_BREAKPOINT = 640;
const LONG_PRESS_MS = 800;
const LONG_PRESS_MOVE_THRESHOLD = 8;

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

function formatDateRange(startDate: Date, count: number): string {
  const endDate = addDays(startDate, count - 1);
  const mOpts: Intl.DateTimeFormatOptions = { month: "short" };
  const m1 = startDate.toLocaleDateString("en-US", mOpts);
  const m2 = endDate.toLocaleDateString("en-US", mOpts);
  const y = startDate.getFullYear();
  if (m1 === m2) {
    return `${m1} ${startDate.getDate()}\u2013${endDate.getDate()}, ${y}`;
  }
  return `${m1} ${startDate.getDate()} \u2013 ${m2} ${endDate.getDate()}, ${y}`;
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

interface DragState {
  dayIdx: number;
  startMinutes: number;
  currentMinutes: number;
}

interface MobileDraft {
  dayIdx: number;
  startMinutes: number;
  endMinutes: number;
}

export function InteractiveCalendar({
  selectedSlots,
  onAddSlot,
  onRemoveSlot,
}: InteractiveCalendarProps) {
  const isMobile = useIsMobile();
  const [weekOffset, setWeekOffset] = useState(0);
  const [mobileOffset, setMobileOffset] = useState(0);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [mobileDraft, setMobileDraft] = useState<MobileDraft | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<"top" | "bottom" | "body" | null>(null);
  const bodyDragOrigin = useRef<{ minutes: number; dayIdx: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const touchStartDayIdx = useRef<number | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const startDate = useMemo(() => {
    if (isMobile) {
      return addDays(today, mobileOffset - 1);
    }
    return getMonday(addDays(today, weekOffset * 7));
  }, [isMobile, today, weekOffset, mobileOffset]);

  const visibleCount = isMobile ? MOBILE_DAYS : 7;

  const hourStart = DEFAULT_HOUR_START;
  const hourEnd = DEFAULT_HOUR_END;
  const totalHours = hourEnd - hourStart;
  const gridHeight = totalHours * HOUR_HEIGHT;

  const visibleDates = useMemo(() => {
    return Array.from({ length: visibleCount }, (_, i) => {
      const d = addDays(startDate, i);
      return d.toLocaleDateString("en-CA");
    });
  }, [startDate, visibleCount]);

  const slotsForDay = useCallback(
    (dayIdx: number) => {
      const dateStr = visibleDates[dayIdx];
      return selectedSlots.filter((s) => s.date === dateStr);
    },
    [selectedSlots, visibleDates]
  );

  function handlePrev() {
    if (isMobile) {
      setMobileOffset((o) => o - MOBILE_DAYS);
    } else {
      setWeekOffset((w) => w - 1);
    }
  }

  function handleNext() {
    if (isMobile) {
      setMobileOffset((o) => o + MOBILE_DAYS);
    } else {
      setWeekOffset((w) => w + 1);
    }
  }

  function handleToday() {
    if (isMobile) {
      setMobileOffset(0);
    } else {
      setWeekOffset(0);
    }
  }

  function xToDayIdx(x: number): number | null {
    for (let i = 0; i < visibleCount; i++) {
      const col = colRefs.current[i];
      if (!col) continue;
      const rect = col.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right) return i;
    }
    return null;
  }

  function yToMinutes(y: number, colEl: HTMLDivElement): number {
    const rect = colEl.getBoundingClientRect();
    const relY = Math.max(0, Math.min(y - rect.top, rect.height));
    const fraction = relY / rect.height;
    const rawMinutes = hourStart * 60 + fraction * totalHours * 60;
    return snapMinutes(Math.max(hourStart * 60, Math.min(hourEnd * 60, rawMinutes)));
  }

  // Desktop pointer handlers
  function handlePointerDown(e: React.PointerEvent, dayIdx: number) {
    if (isMobile) return;
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
    if (isMobile) return;
    if (!drag || drag.dayIdx !== dayIdx) return;
    const col = colRefs.current[dayIdx];
    if (!col) return;

    const minutes = yToMinutes(e.clientY, col);
    setDrag((prev) => (prev ? { ...prev, currentMinutes: minutes } : null));
  }

  function handlePointerUp(e: React.PointerEvent, dayIdx: number) {
    if (isMobile) return;
    if (!drag || drag.dayIdx !== dayIdx) return;
    const col = colRefs.current[dayIdx];
    if (col) col.releasePointerCapture(e.pointerId);

    const minMin = Math.min(drag.startMinutes, drag.currentMinutes);
    const maxMin = Math.max(drag.startMinutes, drag.currentMinutes);

    if (maxMin - minMin >= SNAP_MINUTES) {
      const dateStr = visibleDates[dayIdx];
      onAddSlot(dateStr, minutesToHHMM(minMin), minutesToHHMM(maxMin));
    }

    setDrag(null);
  }

  // Mobile touch handlers — long press to create, handles to resize
  function clearLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPos.current = null;
    touchStartDayIdx.current = null;
  }

  function handleTouchStartCol(e: React.TouchEvent, dayIdx: number) {
    if (!isMobile) return;
    if (mobileDraft) return;

    const target = e.target as HTMLElement;
    if (target.closest("[data-slot-block]") || target.closest("[data-handle]")) return;

    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    touchStartDayIdx.current = dayIdx;

    longPressTimer.current = setTimeout(() => {
      const col = colRefs.current[dayIdx];
      if (!col || !touchStartPos.current) return;

      const minutes = yToMinutes(touchStartPos.current.y, col);
      const endMinutes = Math.min(minutes + 60, hourEnd * 60);

      if (navigator.vibrate) navigator.vibrate(30);

      setMobileDraft({ dayIdx, startMinutes: minutes, endMinutes });
      longPressTimer.current = null;
    }, LONG_PRESS_MS);
  }

  function handleTouchMoveCol(e: React.TouchEvent) {
    if (!isMobile) return;

    // If a handle is being dragged, don't cancel the long press — handle drag is separate
    if (draggingHandle) return;

    // Cancel long press if finger moved too far (user is scrolling)
    if (longPressTimer.current && touchStartPos.current) {
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartPos.current.x;
      const dy = touch.clientY - touchStartPos.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > LONG_PRESS_MOVE_THRESHOLD) {
        clearLongPress();
      }
    }
  }

  function handleTouchEndCol() {
    if (!isMobile) return;
    clearLongPress();
  }

  function handleHandleTouchStart(e: React.TouchEvent, handle: "top" | "bottom") {
    e.stopPropagation();
    e.preventDefault();
    setDraggingHandle(handle);
  }

  function handleBodyTouchStart(e: React.TouchEvent) {
    if (!mobileDraft) return;
    e.stopPropagation();
    e.preventDefault();

    const touch = e.touches[0];
    const col = colRefs.current[mobileDraft.dayIdx];
    if (!col) return;

    const minutes = yToMinutes(touch.clientY, col);
    bodyDragOrigin.current = { minutes, dayIdx: mobileDraft.dayIdx };
    setDraggingHandle("body");
  }

  useEffect(() => {
    if (!draggingHandle || !mobileDraft) return;

    function onTouchMove(e: TouchEvent) {
      if (!mobileDraft || !draggingHandle) return;

      e.preventDefault();
      const touch = e.touches[0];

      if (draggingHandle === "body") {
        const newDayIdx = xToDayIdx(touch.clientX);
        const targetDayIdx = newDayIdx !== null ? newDayIdx : mobileDraft.dayIdx;
        const col = colRefs.current[targetDayIdx];
        if (!col || !bodyDragOrigin.current) return;

        const currentMinutes = yToMinutes(touch.clientY, col);
        const deltaMinutes = currentMinutes - bodyDragOrigin.current.minutes;
        const duration = mobileDraft.endMinutes - mobileDraft.startMinutes;

        let newStart = mobileDraft.startMinutes + deltaMinutes;
        let newEnd = newStart + duration;

        if (newStart < hourStart * 60) {
          newStart = hourStart * 60;
          newEnd = newStart + duration;
        }
        if (newEnd > hourEnd * 60) {
          newEnd = hourEnd * 60;
          newStart = newEnd - duration;
        }

        bodyDragOrigin.current = { minutes: currentMinutes, dayIdx: targetDayIdx };
        setMobileDraft({ dayIdx: targetDayIdx, startMinutes: newStart, endMinutes: newEnd });
        return;
      }

      const col = colRefs.current[mobileDraft.dayIdx];
      if (!col) return;

      const minutes = yToMinutes(touch.clientY, col);

      setMobileDraft((prev) => {
        if (!prev) return prev;
        if (draggingHandle === "top") {
          const clamped = Math.min(minutes, prev.endMinutes - SNAP_MINUTES);
          return { ...prev, startMinutes: clamped };
        } else {
          const clamped = Math.max(minutes, prev.startMinutes + SNAP_MINUTES);
          return { ...prev, endMinutes: clamped };
        }
      });
    }

    function onTouchEnd() {
      bodyDragOrigin.current = null;
      setDraggingHandle(null);
    }

    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [draggingHandle, mobileDraft]);

  function commitMobileDraft() {
    if (!mobileDraft) return;
    const dateStr = visibleDates[mobileDraft.dayIdx];
    onAddSlot(dateStr, minutesToHHMM(mobileDraft.startMinutes), minutesToHHMM(mobileDraft.endMinutes));
    setMobileDraft(null);
    setDraggingHandle(null);
  }

  function cancelMobileDraft() {
    setMobileDraft(null);
    setDraggingHandle(null);
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

  function draftPosition(startMin: number, endMin: number) {
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
          {isMobile ? "Hold to mark your free times" : "Click & drag to mark your free times"}
        </p>
      </div>

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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleToday}
            className="text-[10px] font-medium text-muted hover:text-foreground min-h-[32px] px-2 rounded hover:bg-white/80 transition-colors cursor-pointer"
            aria-label="Go to current week"
          >
            Today
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded hover:bg-white/80 text-muted hover:text-foreground transition-colors cursor-pointer"
            aria-label={isMobile ? "Next days" : "Next week"}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 overflow-hidden">
      <div className="week-cal-scroll-wrapper max-h-[320px]">
        <div
          className="week-cal-grid bg-white/50"
        >
          <div
            className="week-cal-header"
            style={{
              gridTemplateColumns: `38px repeat(${visibleCount}, 1fr)`,
            }}
          >
            <div className="week-cal-time-col" />
            {Array.from({ length: visibleCount }, (_, i) => {
              const d = addDays(startDate, i);
              const isToday = isSameDay(d, today);
              return (
                <div
                  key={visibleDates[i]}
                  className={`week-cal-day-header ${isToday ? "week-cal-today-header" : ""}`}
                >
                  <span className="text-[10px] font-medium">
                    {DAY_NAMES_SHORT[d.getDay()]}
                  </span>
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
            style={{
              height: gridHeight,
              gridTemplateColumns: `38px repeat(${visibleCount}, 1fr)`,
            }}
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

            {Array.from({ length: visibleCount }, (_, dayIdx) => {
              const dayDate = addDays(startDate, dayIdx);
              const isToday = isSameDay(dayDate, today);
              const daySlots = slotsForDay(dayIdx);
              const preview = drag?.dayIdx === dayIdx ? dragPreviewStyle() : null;
              const hasDraft = mobileDraft?.dayIdx === dayIdx;

              return (
                <div
                  key={visibleDates[dayIdx]}
                  ref={(el) => { colRefs.current[dayIdx] = el; }}
                  className={`week-cal-day-col interactive-cal-col ${isToday ? "week-cal-today-col" : ""}`}
                  onPointerDown={(e) => handlePointerDown(e, dayIdx)}
                  onPointerMove={(e) => handlePointerMove(e, dayIdx)}
                  onPointerUp={(e) => handlePointerUp(e, dayIdx)}
                  onTouchStart={(e) => handleTouchStartCol(e, dayIdx)}
                  onTouchMove={handleTouchMoveCol}
                  onTouchEnd={handleTouchEndCol}
                  style={{ touchAction: isMobile ? (draggingHandle ? "none" : "pan-y") : "none", position: "relative" }}
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

                  {/* Mobile draft with drag handles */}
                  {hasDraft && mobileDraft && (
                    <div
                      data-handle
                      className="mobile-draft-slot"
                      style={draftPosition(mobileDraft.startMinutes, mobileDraft.endMinutes)}
                      onTouchStart={handleBodyTouchStart}
                    >
                      <div
                        data-handle
                        className="mobile-draft-handle mobile-draft-handle-top"
                        onTouchStart={(e) => handleHandleTouchStart(e, "top")}
                      >
                        <span className="mobile-draft-handle-circle" />
                      </div>
                      <div className={`mobile-draft-label-wrap${mobileDraft.endMinutes - mobileDraft.startMinutes <= 60 ? " truncate" : ""}`}>
                        <span className="mobile-draft-label">
                          {formatTimeShort(minutesToHHMM(mobileDraft.startMinutes))}
                          {" \u2013 "}
                          {formatTimeShort(minutesToHHMM(mobileDraft.endMinutes))}
                        </span>
                      </div>
                      <div
                        data-handle
                        className="mobile-draft-handle mobile-draft-handle-bottom"
                        onTouchStart={(e) => handleHandleTouchStart(e, "bottom")}
                      >
                        <span className="mobile-draft-handle-circle" />
                      </div>
                    </div>
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

      {/* Mobile draft action bar */}
      <AnimatePresence>
        {mobileDraft && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ type: "spring", duration: 0.25, bounce: 0 }}
            className="flex items-center justify-between gap-2 mt-2 px-1"
          >
            <p className="text-[11px] text-muted tabular-nums flex-1 min-w-0">
              {formatTimeShort(minutesToHHMM(mobileDraft.startMinutes))}
              {" \u2013 "}
              {formatTimeShort(minutesToHHMM(mobileDraft.endMinutes))}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={cancelMobileDraft}
                className="text-[11px] text-muted hover:text-foreground px-2 py-1 rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={commitMobileDraft}
                className="aqua-btn h-[26px] px-3 text-[11px]"
              >
                Add slot
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
