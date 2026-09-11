import { useEffect, useState } from "react";
import { fetchCourses } from "../lib/api";
import type { Course } from "../lib/types";
import { useTimer } from "../lib/timer";

export function StudyTimer() {
  const [courses, setCourses] = useState<Course[]>([]);
  const {
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
  } = useTimer();

  useEffect(() => {
    fetchCourses().then(setCourses).catch(console.error);
  }, []);

  const running = status === "running";
  const locked = status !== "idle";
  const total =
    mode === "focus"
      ? focusMinutes * 60 * 1000
      : breakMinutes * 60 * 1000;
  const minutes = Math.floor(remainingMs / 60000)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor((remainingMs % 60000) / 1000)
    .toString()
    .padStart(2, "0");
  const progress = ((total - remainingMs) / total) * 100;

  return (
    <div className="page">
      <header className="page-header">
        <p>Pomodoro-style focus sessions for your courses</p>
      </header>

      <div className="info-banner">
        You can navigate to other pages — the timer keeps running in the
        background.
      </div>

      <section className="panel timer-panel">
        <div className="timer-course-select">
          <label>Course</label>
          <select
            value={courseId}
            disabled={locked}
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
          {locked && (
            <span className="timer-settings-hint">Locked while timer is active — stop or reset first.</span>
          )}
        </div>

        <div className="timer-mode-switch">
          <button
            className={mode === "focus" ? "mode-btn active" : "mode-btn"}
            onClick={() => switchMode("focus")}
          >
            Focus ({focusMinutes}m)
          </button>
          <button
            className={mode === "break" ? "mode-btn active" : "mode-btn"}
            onClick={() => switchMode("break")}
          >
            Break ({breakMinutes}m)
          </button>
        </div>

        <div className="timer-settings">
          <label>
            Focus duration (min)
            <input
              type="number"
              min={1}
              max={120}
              value={focusMinutes}
              disabled={locked}
              onChange={(e) => setFocusMinutes(Number(e.target.value))}
            />
          </label>
          <label>
            Break duration (min)
            <input
              type="number"
              min={1}
              max={60}
              value={breakMinutes}
              disabled={locked}
              onChange={(e) => setBreakMinutes(Number(e.target.value))}
            />
          </label>
        </div>
        {locked && (
          <p className="timer-settings-locked">
            ⏸ Press Stop or Reset to change the durations.
          </p>
        )}

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
          Completed focus sessions: <strong>{cycles}</strong>
        </div>

        <label className="timer-note">
          Note for this session (optional)
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Reviewed cardiovascular chapter 4"
          />
        </label>

        {lastSaved && (
          <p className="success-text">
            Session saved ✓ (at {lastSaved})
          </p>
        )}

        <div className="timer-controls">
          {!running ? (
            <button className="btn-primary" onClick={start}>
              {status === "paused" ? "▶ Resume" : "▶ Start"}
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