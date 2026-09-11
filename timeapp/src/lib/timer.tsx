import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { addStudySession } from "./api";

export type TimerMode = "focus" | "break";
type TimerStatus = "idle" | "running" | "paused";

interface TimerContextValue {
  courseId: number | "";
  mode: TimerMode;
  status: TimerStatus;
  remainingMs: number;
  cycles: number;
  note: string;
  lastSaved: string | null;
  focusMinutes: number;
  breakMinutes: number;
  setCourseId: (id: number | "") => void;
  setNote: (note: string) => void;
  setFocusMinutes: (min: number) => void;
  setBreakMinutes: (min: number) => void;
  start: () => void;
  pause: () => void;
  stop: () => void;
  reset: () => void;
  switchMode: (mode: TimerMode) => void;
}

const TimerContext = createContext<TimerContextValue | undefined>(undefined);

export function TimerProvider({ children }: { children: ReactNode }) {
  const [courseId, setCourseId] = useState<number | "">("");
  const [mode, setMode] = useState<TimerMode>("focus");
  const [status, setStatus] = useState<TimerStatus>("idle");
  const [focusMinutes, setFocusMinutesState] = useState(25);
  const [breakMinutes, setBreakMinutesState] = useState(5);
  const [remainingMs, setRemainingMs] = useState(25 * 60 * 1000);
  const [cycles, setCycles] = useState(0);
  const [note, setNote] = useState("");
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const focusMs = focusMinutes * 60 * 1000;
  const breakMs = breakMinutes * 60 * 1000;

  const endAtRef = useRef<number | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const sessionCourseRef = useRef<number>(0);
  const modeRef = useRef<TimerMode>("focus");
  const courseIdRef = useRef<number | "">("");
  const noteRef = useRef("");
  const statusRef = useRef<TimerStatus>("idle");
  const remainingMsRef = useRef(25 * 60 * 1000);
  const focusMsRef = useRef(25 * 60 * 1000);
  const breakMsRef = useRef(5 * 60 * 1000);

  modeRef.current = mode;
  courseIdRef.current = courseId;
  noteRef.current = note;
  statusRef.current = status;
  remainingMsRef.current = remainingMs;
  focusMsRef.current = focusMs;
  breakMsRef.current = breakMs;

  function setFocusMinutes(min: number) {
    const clamped = Math.max(1, Math.min(120, Math.round(min)));
    setFocusMinutesState(clamped);
    if (status === "idle" && mode === "focus") {
      setRemainingMs(clamped * 60 * 1000);
    }
  }

  function setBreakMinutes(min: number) {
    const clamped = Math.max(1, Math.min(60, Math.round(min)));
    setBreakMinutesState(clamped);
    if (status === "idle" && mode === "break") {
      setRemainingMs(clamped * 60 * 1000);
    }
  }

  function playBeep() {
    try {
      const audioCtx = new AudioContext();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.8);
    } catch {
      /* beep audio not available */
    }
  }

  async function saveSession() {
    const start = sessionStartRef.current;
    const course = sessionCourseRef.current;
    if (!start || !course) return;
    const end = Date.now();
    const duration = Math.max(1, Math.round((end - start) / 60000));
    try {
      await addStudySession({
        course_id: course as number,
        started_at: new Date(start).toISOString(),
        ended_at: new Date(end).toISOString(),
        duration_minutes: duration,
        notes: noteRef.current.trim() || undefined,
      });
      setLastSaved(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Failed to save session", err);
    }
  }

  function beginPhase(next: TimerMode) {
    const dur = next === "focus" ? focusMsRef.current : breakMsRef.current;
    setMode(next);
    setRemainingMs(dur);
    endAtRef.current = Date.now() + dur;
    sessionStartRef.current = next === "focus" ? Date.now() : null;
    sessionCourseRef.current = next === "focus" ? (courseIdRef.current as number) : 0;
  }

  function onPhaseComplete() {
    const wasFocus = modeRef.current === "focus";
    if (wasFocus) {
      saveSession();
      setCycles((c) => c + 1);
    } else {
      setCycles(0);
    }
    playBeep();
    beginPhase(wasFocus ? "break" : "focus");
  }

  useEffect(() => {
    if (status !== "running") return;
    const id = window.setInterval(() => {
      const endAt = endAtRef.current;
      if (endAt == null) return;
      const remaining = endAt - Date.now();
      if (remaining > 0) {
        setRemainingMs(remaining);
      } else {
        onPhaseComplete();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [status]);

  function start() {
    if (!courseIdRef.current) {
      alert("Select a course first so your session gets tracked.");
      return;
    }
    if (statusRef.current === "paused") {
      endAtRef.current = Date.now() + Math.max(1000, remainingMsRef.current);
      setStatus("running");
      return;
    }
    beginPhase(modeRef.current);
    setStatus("running");
  }

  function pause() {
    if (statusRef.current !== "running") return;
    const endAt = endAtRef.current;
    if (endAt != null) setRemainingMs(Math.max(0, endAt - Date.now()));
    setStatus("paused");
  }

  async function stop() {
    setStatus("idle");
    if (modeRef.current === "focus" && sessionStartRef.current && sessionCourseRef.current) {
      await saveSession();
    }
    endAtRef.current = null;
    sessionStartRef.current = null;
    sessionCourseRef.current = 0;
    setMode("focus");
    setRemainingMs(focusMsRef.current);
  }

  function reset() {
    setStatus("idle");
    endAtRef.current = null;
    sessionStartRef.current = null;
    sessionCourseRef.current = 0;
    setMode("focus");
    setRemainingMs(focusMsRef.current);
    setCycles(0);
  }

  function switchMode(next: TimerMode) {
    setStatus("idle");
    endAtRef.current = null;
    sessionStartRef.current = null;
    sessionCourseRef.current = 0;
    setMode(next);
    setRemainingMs(next === "focus" ? focusMsRef.current : breakMsRef.current);
  }

  return (
    <TimerContext.Provider
      value={{
        courseId,
        mode,
        status,
        remainingMs,
        cycles,
        note,
        lastSaved,
        focusMinutes,
        breakMinutes,
        setCourseId,
        setNote,
        setFocusMinutes,
        setBreakMinutes,
        start,
        pause,
        stop,
        reset,
        switchMode,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) {
    throw new Error("useTimer must be used within a TimerProvider");
  }
  return ctx;
}