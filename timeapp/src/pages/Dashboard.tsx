import { useEffect, useState } from "react";
import { getDashboardStats, getRecentSessions } from "../lib/api";

interface Stats {
  totalCourses: number;
  completedCourses: number;
  totalStudyMinutes: number;
  upcomingExams: number;
}

interface RecentSession {
  id: number;
  course_name: string;
  duration_minutes: number;
  created_at: string;
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentSession[]>([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [s, r] = await Promise.all([
        getDashboardStats(),
        getRecentSessions(),
      ]);
      setStats(s);
      setRecent(r);
    } catch (err) {
      console.error("Failed to load dashboard", err);
    }
  }

  const hours = stats ? Math.floor(stats.totalStudyMinutes / 60) : 0;
  const minutes = stats ? stats.totalStudyMinutes % 60 : 0;

  return (
    <div className="page">
      <header className="page-header">
        <h2>Dashboard</h2>
        <p>Your study progress at a glance</p>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon">📚</span>
          <div className="stat-value">{stats?.totalCourses ?? "-"}</div>
          <div className="stat-label">Courses</div>
          <div className="stat-sub">
            {stats?.completedCourses ?? 0} completed
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">⏱</span>
          <div className="stat-value">
            {stats ? `${hours}h ${minutes}m` : "-"}
          </div>
          <div className="stat-label">Study Time</div>
          <div className="stat-sub">Total tracked</div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🩺</span>
          <div className="stat-value">{stats?.upcomingExams ?? "-"}</div>
          <div className="stat-label">Upcoming Exams</div>
          <div className="stat-sub">Need to prepare</div>
        </div>
        <div className="stat-card">
          <span className="stat-icon">📈</span>
          <div className="stat-value">
            {stats && stats.totalCourses > 0
              ? Math.round(
                  ((stats.completedCourses / stats.totalCourses) * 100),
                ) + "%"
              : "-"}
          </div>
          <div className="stat-label">Completion</div>
          <div className="stat-sub">CS/% of courses done</div>
        </div>
      </div>

      <section className="panel">
        <h3>Recent Study Sessions</h3>
        {recent.length === 0 ? (
          <p className="empty-state">
            No study sessions yet. Start your first one with the Study Timer!
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Duration</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((s) => (
                <tr key={s.id}>
                  <td>{s.course_name}</td>
                  <td>{s.duration_minutes} min</td>
                  <td>{new Date(s.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}