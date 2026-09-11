import { useEffect, useState } from "react";
import {
  getDashboardStats,
  getDailyMinutes,
  getMinutesByCourse,
  getExamStatusCounts,
  getRecentSessions,
  getStudyActivity,
  lastNDates,
  localDateStr,
} from "../lib/api";
import {
  BarChart,
  DonutChart,
  AreaChart,
  fmtMinutes,
  chartPalette,
  type ChartDatum,
} from "../components/Charts";
import { useTheme } from "../lib/theme";

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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function weekLabelDate(dateStr: string): string {
  return WEEKDAYS[new Date(dateStr + "T00:00:00").getDay()];
}

function cumLabel(dateStr: string): string {
  return dateStr.slice(5);
}

function computeStreak(daySet: Set<string>): number {
  let streak = 0;
  const cur = new Date();
  if (!daySet.has(localDateStr(cur))) {
    cur.setDate(cur.getDate() - 1);
  }
  while (daySet.has(localDateStr(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

type ExamStatus = "upcoming" | "passed" | "failed";

const EXAM_COLORS: Record<ExamStatus, string> = {
  upcoming: "#2a7fa3",
  passed: "#2e9e6b",
  failed: "#c44536",
};

const EXAM_LABELS: Record<ExamStatus, string> = {
  upcoming: "Upcoming",
  passed: "Passed",
  failed: "Failed",
};

export function Dashboard() {
  const { theme } = useTheme();
  const palette = chartPalette(theme);

  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentSession[]>([]);
  const [weekly, setWeekly] = useState<ChartDatum[]>([]);
  const [byCourse, setByCourse] = useState<ChartDatum[]>([]);
  const [cumulative, setCumulative] = useState<ChartDatum[]>([]);
  const [examCounts, setExamCounts] = useState(
    new Map<ExamStatus, number>(),
  );
  const [activity, setActivity] = useState({
    sessions: 0,
    activeDays: 0,
    streak: 0,
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [s, r, daily, byC, examC, act] = await Promise.all([
        getDashboardStats(),
        getRecentSessions(),
        getDailyMinutes(),
        getMinutesByCourse(),
        getExamStatusCounts(),
        getStudyActivity(),
      ]);
      setStats(s);
      setRecent(r);

      const byDay = new Map(daily.map((d) => [d.day, d.minutes]));
      const weekDates = lastNDates(7);
      setWeekly(
        weekDates.map((day) => ({
          label: weekLabelDate(day),
          value: byDay.get(day) ?? 0,
        })),
      );

      const top = byC
        .filter((c) => c.minutes > 0)
        .slice(0, 6)
        .map((c, i) => ({
          label: c.course_name,
          value: c.minutes,
          color: palette[i % palette.length],
        }));
      setByCourse(top);

      const cum: ChartDatum[] = [];
      let acc = 0;
      for (const d of daily) {
        acc += d.minutes;
        cum.push({ label: cumLabel(d.day), value: acc });
      }
      setCumulative(cum);

      const examMap = new Map<ExamStatus, number>();
      for (const e of examC) {
        if (e.status === "upcoming" || e.status === "passed" || e.status === "failed") {
          examMap.set(e.status, e.count);
        }
      }
      setExamCounts(examMap);

      const daySet = new Set(daily.map((d) => d.day));
      setActivity({
        sessions: act.sessions,
        activeDays: act.activeDays,
        streak: computeStreak(daySet),
      });
    } catch (err) {
      console.error("Failed to load dashboard", err);
    }
  }

  const hours = stats ? Math.floor(stats.totalStudyMinutes / 60) : 0;
  const minutes = stats ? stats.totalStudyMinutes % 60 : 0;

  const weekTotal = weekly.reduce((a, b) => a + b.value, 0);
  const examTotal = examCounts
    ? [...examCounts.values()].reduce((a, b) => a + b, 0)
    : 0;
  const examTotalCum = Math.max(0, examTotal);
  const cumTotal = cumulative.length ? cumulative[cumulative.length - 1].value : 0;

  const examTypes: ExamStatus[] = ["upcoming", "passed", "failed"];

  return (
    <div className="page page-wide">
      <header className="page-header dash-header">
        <p>Your study progress at a glance</p>
        {activity.streak > 0 && (
          <div className="dash-streak" title={`${activity.streak} day streak`}>
            <span className="dash-streak-flame">🔥</span>
            <div>
              <span className="dash-streak-num">{activity.streak}</span>
              <span className="dash-streak-label">day streak</span>
            </div>
          </div>
        )}
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon-bubble bubble-teal">📚</span>
          <div className="stat-value">{stats?.totalCourses ?? "-"}</div>
          <div className="stat-label">Courses</div>
          <div className="stat-sub">
            {stats?.completedCourses ?? 0} completed
          </div>
        </div>
        <div className="stat-card">
          <span className="stat-icon-bubble bubble-accent">⏱</span>
          <div className="stat-value">
            {stats ? `${hours}h ${minutes}m` : "-"}
          </div>
          <div className="stat-label">Study Time</div>
          <div className="stat-sub">Total tracked</div>
        </div>
        <div className="stat-card">
          <span className="stat-icon-bubble bubble-success">🩺</span>
          <div className="stat-value">{stats?.upcomingExams ?? "-"}</div>
          <div className="stat-label">Upcoming Exams</div>
          <div className="stat-sub">Need to prepare</div>
        </div>
        <div className="stat-card">
          <span className="stat-icon-bubble bubble-purple">📈</span>
          <div className="stat-value">
            {stats && stats.totalCourses > 0
              ? Math.round(
                  (stats.completedCourses / stats.totalCourses) * 100,
                ) + "%"
              : "-"}
          </div>
          <div className="stat-label">Completion</div>
          <div className="stat-sub">Courses done</div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-title-row">
          <h3>Weekly Study Activity</h3>
          <span className="panel-chip">{fmtMinutes(weekTotal)} this week</span>
        </div>
        {weekly.length === 0 || weekTotal === 0 ? (
          <p className="empty-state">
            No study sessions this week yet. Start your first one with the
            Study Timer!
          </p>
        ) : (
          <BarChart data={weekly} />
        )}
      </section>

      <div className="charts-row">
        <section className="panel">
          <h3>Study Time by Course</h3>
          {byCourse.length === 0 ? (
            <p className="empty-state">No study sessions recorded yet.</p>
          ) : (
            <div className="donut-layout">
              <DonutChart data={byCourse} centerValue={cumTotal} />
              <ul className="chart-key">
                {byCourse.map((c) => (
                  <li key={c.label}>
                    <span
                      className="chart-swatch"
                      style={{ background: c.color }}
                    />
                    <span className="chart-key-label" title={c.label}>
                      {c.label}
                    </span>
                    <span className="chart-key-value">
                      {fmtMinutes(c.value)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-title-row">
            <h3>Cumulative Study Time</h3>
            <span className="panel-chip">{fmtMinutes(cumTotal)} total</span>
          </div>
          {cumulative.length === 0 ? (
            <p className="empty-state">No study time yet.</p>
          ) : (
            <AreaChart data={cumulative} />
          )}
        </section>
      </div>

      <div className="charts-row">
        <section className="panel">
          <h3>Exam Results</h3>
          {examTotalCum === 0 ? (
            <p className="empty-state">No exams added yet.</p>
          ) : (
            <>
              <div className="exam-stack">
                {examTypes.map((t) => {
                  const count = examCounts.get(t) ?? 0;
                  return (
                    <div
                      key={t}
                      className="exam-stack-seg"
                      style={{
                        background: EXAM_COLORS[t],
                        width: `${(count / examTotalCum) * 100}%`,
                      }}
                      title={`${EXAM_LABELS[t]}: ${count}`}
                    />
                  );
                })}
              </div>
              <div className="exam-legend">
                {examTypes.map((t) => (
                  <span key={t} className="exam-legend-item">
                    <span
                      className="chart-swatch"
                      style={{ background: EXAM_COLORS[t] }}
                    />
                    {EXAM_LABELS[t]}
                    <strong>{examCounts.get(t) ?? 0}</strong>
                  </span>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="panel">
          <h3>Consistency</h3>
          {activity.sessions === 0 ? (
            <p className="empty-state">No activity yet.</p>
          ) : (
            <div className="consistency-grid">
              <div className="consistency-card">
                <span className="consistency-val">{activity.streak}</span>
                <span className="consistency-label">Current streak 🔥</span>
              </div>
              <div className="consistency-card">
                <span className="consistency-val">{activity.activeDays}</span>
                <span className="consistency-label">Active days</span>
              </div>
              <div className="consistency-card">
                <span className="consistency-val">{activity.sessions}</span>
                <span className="consistency-label">Sessions</span>
              </div>
            </div>
          )}
        </section>
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