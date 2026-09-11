import { useEffect, useRef, useState } from "react";
import { addStudySession, fetchCourses } from "../lib/api";
import type { Course } from "../lib/types";

type TimerMode = "focus" | "break";
const FOCUS_DEFAULT = 25;
const BREAK_DEFAULT = 5;

export function StudyTimer() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<number | "">("");
  const [mode, setMode] = useState<TimerMode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_DEFAULT * 60);
  const [running, setRunning] = useState(false);
  const [cycles, setCycles] = useState(0);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const sessionStartRef = useRef<Date | null>(null);

  useEffect(() => {
    fetchCourses().then(setCourses).catch(console.error);
  }, []);

  // tick when running
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  // phase transition when timer hits zero
  useEffect(() => {
    if (running && secondsLeft === 0) {
      transitionPhase();
    }
  }, [secondsLeft, running]);

  function transitionPhase() {
    if (mode === "focus") {
      setRunning(false);
      if (sessionStartRef.current && courseId) {
        saveSession();
      }
      setCycles((c) => c + 1);
      playBeep();
      setMode("break");
      setSecondsLeft(BREAK_DEFAULT * 60);
      sessionStartRef.current = null;
    } else {
      setRunning(false);
      playBeep();
      setMode("focus");
      setSecondsLeft(FOCUS_DEFAULT * 60);
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
    if (!courseId || !start) return;
    const end = new Date();
    const duration = Math.max(
      1,
      Math.round((end.getTime() - start.getTime()) / 60000),
    );
    try {
      await addStudySession({
        course_id: courseId as number,
        started_at: start.toISOString(),
        ended_at: end.toISOString(),
        duration_minutes: duration,
        notes: note.trim() || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save session", err);
    }
  }

  function start() {
    if (!courseId) {
      alert("Select a course first so your session gets tracked.");
      return;
    }
    setNote("");
    setSaved(false);
    sessionStartRef.current = new Date();
    setRunning(true);
  }

  function pause() {
    setRunning(false);
  }

  async function stop() {
    setRunning(false);
    if (mode === "focus" && sessionStartRef.current && courseId) {
      await saveSession();
    }
    setSecondsLeft(mode === "focus" ? FOCUS_DEFAULT * 60 : BREAK_DEFAULT * 60);
    sessionStartRef.current = null;
  }

  function reset() {
    setRunning(false);
    setSecondsLeft(mode === "focus" ? FOCUS_DEFAULT * 60 : BREAK_DEFAULT * 60);
    sessionStartRef.current = null;
  }

  function switchMode(next: TimerMode) {
    setRunning(false);
    setMode(next);
    setSecondsLeft(next === "focus" ? FOCUS_DEFAULT * 60 : BREAK_DEFAULT * 60);
    sessionStartRef.current = null;
  }

  const total = mode === "focus" ? FOCUS_DEFAULT * 60 : BREAK_DEFAULT * 60;
  const minutes = Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, "0");
  const secs = (secondsLeft % 60).toString().padStart(2, "0");
  const progress = ((total - secondsLeft) / total) * 100;

  return (
    <div className="page">
      <header className="page-header">
        <h2>Study Timer</h2>
        <p>Pomodoro-style focus sessions for your courses</p>
      </header>

      <section className="panel timer-panel">
        <div className="timer-course-select">
          <label>Course</label>
          <select
            value={courseId}
            onChange={(e) =>
              setCourseId(e.target.value ? Number(e.target.value) : "")
            }
          >
            <option value="">Select a course...</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="timer-mode-switch">
          <button
            className={mode === "focus" ? "mode-btn active" : "mode-btn"}
            onClick={() => switchMode("focus")}
          >
            Focus ({FOCUS_DEFAULT}m)
          </button>
          <button
            className={mode === "break" ? "mode-btn active" : "mode-btn"}
            onClick={() => switchMode("break")}
          >
            Break ({BREAK_DEFAULT}m)
          </button>
        </div>

        <div
          className="timer-ring"
          style={{ "--progress": progress } as React.CSSProperties}
        >
          <div className="timer-display">
            <span className={`timer-time ${mode}`}>
              {minutes}:{secs}
            </span>
            <span className="timer-label">
              {mode === "focus" ? "Focusing" : "Breaking"}
            </span>
          </div>
        </div>

        <div className="timer-cycles">
          Completed focus sessions this run: <strong>{cycles}</strong>
        </div>

        <label className="timer-note">
          Note for this session (optional)
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Reviewed cardiovascular chapter 4"
          />
        </label>

        {saved && <p className="success-text">Session saved! ✓</p>}

        <div className="timer-controls">
          {!running ? (
            <button className="btn-primary" onClick={start}>
              ▶ Start
            </button>
          ) : (
            <button className="btn-secondary" onClick={pause}>
              ⏸ Pause
            </button>
          )}
          <button className="btn-secondary" onClick={stop}>
            ⏹ Stop & Save
          </button>
          <button className="btn-danger" onClick={reset}>
            ⟲ Reset
          </button>
        </div>
      </section>
    </div>
  );
}