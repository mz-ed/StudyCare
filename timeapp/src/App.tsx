import { useEffect, useState } from "react";
import { Sidebar, type Page } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { Courses } from "./pages/Courses";
import { StudyTimer } from "./pages/StudyTimer";
import { Exams } from "./pages/Exams";
import { Calendar } from "./pages/Calendar";
import { Notes } from "./pages/Notes";
import { dbInit } from "./lib/db";
import "./App.css";

function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

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
        return <Notes />;
    }
  }

  return (
    <div className="app-shell">
      <Sidebar current={page} onNavigate={setPage} />
      <main className="content">
        {!ready && !error && (
          <div className="centered-message">Loading app...</div>
        )}
        {error && <div className="centered-message error-text">{error}</div>}
        {ready && renderPage()}
      </main>
    </div>
  );
}

export default App;