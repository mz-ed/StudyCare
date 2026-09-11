import { useTimer } from "../lib/timer";
export type Page = "dashboard" | "courses" | "timer" | "exams" | "calendar" | "notes";

interface SidebarProps {
  current: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { page: Page; label: string; icon: string }[] = [
  { page: "dashboard", label: "Dashboard", icon: "🏛" },
  { page: "courses", label: "Courses", icon: "📚" },
  { page: "timer", label: "Study Timer", icon: "⏱" },
  { page: "exams", label: "Exams", icon: "🩺" },
  { page: "calendar", label: "Calendar", icon: "📅" },
  { page: "notes", label: "Notes", icon: "📝" },
];

function formatClock(ms: number): string {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000)
    .toString()
    .padStart(2, "0");
  const s = Math.floor((total % 60000) / 1000)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export function Sidebar({ current, onNavigate }: SidebarProps) {
  const { status, mode, remainingMs } = useTimer();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-icon">🎓</span>
        <div>
          <h1>StudyCare</h1>
          <p>Medical Study Tracker</p>
        </div>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.page}
            className={`nav-item ${current === item.page ? "active" : ""}`}
            onClick={() => onNavigate(item.page)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {status !== "idle" && (
        <button
          className={`sidebar-timer ${mode} ${status === "paused" ? "paused" : ""}`}
          onClick={() => onNavigate("timer")}
          title="Open Study Timer"
        >
          <span className="sidebar-timer-dot" />
          <span className="sidebar-timer-clock">{formatClock(remainingMs)}</span>
          <span className="sidebar-timer-label">
            {mode === "focus" ? "Focus" : "Break"}
            {status === "paused" ? " (paused)" : ""}
          </span>
        </button>
      )}

      <div className="sidebar-footer">v0.1.0</div>
    </aside>
  );
}