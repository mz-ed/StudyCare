import { useEffect, useState } from "react";
import { Sidebar, type Page } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { Courses } from "./pages/Courses";
import { StudyTimer } from "./pages/StudyTimer";
import { Exams } from "./pages/Exams";
import { Calendar } from "./pages/Calendar";
import { StudyCenter } from "./pages/StudyCenter";
import { AiChat } from "./pages/AiChat";
import { dbInit } from "./lib/db";
import { initTheme, useTheme } from "./lib/theme";
import "./App.css";

initTheme();

const PAGE_META: Record<Page, { label: string; icon: string }> = {
  dashboard: { label: "Dashboard", icon: "🏛" },
  courses: { label: "Courses", icon: "📚" },
  timer: { label: "Study Timer", icon: "⏱" },
  exams: { label: "Exams", icon: "🩺" },
  calendar: { label: "Calendar", icon: "📅" },
  notes: { label: "Study Center", icon: "📘" },
  ai: { label: "AI Chat", icon: "🤖" },
};

function readSidebarPref(): boolean {
  try {
    return localStorage.getItem("studycare-sidebar") === "0";
  } catch {
    return false;
  }
}

function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const { theme, toggle } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarPref);

  useEffect(() => {
    try {
      localStorage.setItem(
        "studycare-sidebar",
        sidebarCollapsed ? "0" : "1",
      );
    } catch {}
  }, [sidebarCollapsed]);

  useEffect(() => {
    dbInit()
      .then(() => setReady(true))
      .catch((err) => {
        console.error("Database init failed", err);
        setError("Failed to initialize database. Is the backend running?");
      });
  }, []);

  function renderPage() {
    switch (page) {
      case "dashboard":
        return <Dashboard />;
      case "courses":
        return <Courses />;
      case "timer":
        return <StudyTimer />;
      case "exams":
        return <Exams />;
      case "calendar":
        return <Calendar />;
      case "notes":
        return <StudyCenter />;
      case "ai":
        return <AiChat />;
    }
  }

  return (
    <div
      className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}
    >
      <Sidebar current={page} onNavigate={setPage} />
      <main className="content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="topbar-nav-toggle"
              onClick={() => setSidebarCollapsed((c) => !c)}
              title={sidebarCollapsed ? "Open sidebar" : "Fold sidebar"}
            >
              {sidebarCollapsed ? "«" : "»"}
            </button>
            <div className="topbar-title">
              <span className="topbar-icon">{PAGE_META[page].icon}</span>
              <span>{PAGE_META[page].label}</span>
            </div>
          </div>
          <button
            className="theme-toggle topbar-theme"
            onClick={toggle}
            title="Toggle dark mode"
          >
            <span className="theme-toggle-icon">
              {theme === "dark" ? "☀️" : "🌙"}
            </span>
            <span className="theme-toggle-label">
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </span>
          </button>
        </header>
        <div className="page-scroll">
          {!ready && !error && (
            <div className="centered-message">Loading app...</div>
          )}
          {error && <div className="centered-message error-text">{error}</div>}
          {ready && renderPage()}
        </div>
      </main>
    </div>
  );
}

export default App;