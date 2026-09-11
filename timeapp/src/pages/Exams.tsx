import { useEffect, useState } from "react";
import {
  addExam,
  deleteExam,
  fetchCourses,
  fetchExams,
  updateExam,
} from "../lib/api";
import type { Course, Exam } from "../lib/types";

const EMPTY_FORM = {
  course_id: "",
  title: "",
  exam_date: "",
  status: "upcoming",
};

export function Exams() {
  const [exams, setExams] = useState<
    Array<Exam & { course_name?: string }>
  >([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [ex, cs] = await Promise.all([fetchExams(), fetchCourses()]);
      const courseMap = new Map(cs.map((c) => [c.id, c.name]));
      setExams(ex.map((e) => ({ ...e, course_name: courseMap.get(e.course_id) })));
      setCourses(cs);
    } catch (err) {
      console.error("Failed to load exams", err);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.course_id || !form.title.trim() || !form.exam_date) {
      setError("Course, title, and date are required.");
      return;
    }
    try {
      await addExam({
        course_id: Number(form.course_id),
        title: form.title.trim(),
        exam_date: form.exam_date,
        status: "upcoming",
      });
      await load();
      setShowForm(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError("Failed to add exam: " + String(err));
    }
  }

  async function saveScore(exam: Exam, score: number) {
    if (Number.isNaN(score) || score < 0 || score > 100) return;
    try {
      if (exam.status === "upcoming") {
        await updateExam(exam.id, {
          score,
          status: score >= 50 ? "passed" : "failed",
        });
      } else {
        await updateExam(exam.id, { score });
      }
      await load();
    } catch (err) {
      console.error("Failed to save score", err);
    }
  }

  async function handleDelete(id: number) {
    if (confirm("Delete this exam?")) {
      try {
        await deleteExam(id);
        await load();
      } catch (err) {
        console.error("Failed to delete exam", err);
      }
    }
  }

  function daysUntil(dateStr: string): string {
    const target = new Date(dateStr + "T23:59:59");
    const diff = Math.ceil((target.getTime() - Date.now()) / 86400000);
    if (diff < 0) return "Overdue";
    if (diff === 0) return "Today!";
    if (diff === 1) return "Tomorrow";
    return `${diff} days`;
  }

  return (
    <div className="page">
      <header className="page-header">
        <p>Track your upcoming exams and assessments</p>
        <button
          className="btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Cancel" : "+ Add Exam"}
        </button>
      </header>

      {showForm && (
        <form className="panel form-grid" onSubmit={handleSave}>
          <h3>New Exam</h3>
          <label>
            Course *
            <select
              value={form.course_id}
              onChange={(e) => setForm({ ...form, course_id: e.target.value })}
            >
              <option value="">Select a course...</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Title *
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Anatomy Midterm"
            />
          </label>
          <label>
            Exam Date *
            <input
              type="date"
              value={form.exam_date}
              onChange={(e) => setForm({ ...form, exam_date: e.target.value })}
            />
          </label>
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button type="submit" className="btn-primary">
              Add Exam
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setShowForm(false);
                setForm(EMPTY_FORM);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="panel">
        {exams.length === 0 ? (
          <p className="empty-state">
            No exams tracked. Add upcoming exams to keep an eye on deadlines.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Exam</th>
                <th>Course</th>
                <th>Date</th>
                <th>Countdown</th>
                <th>Score</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {exams.map((ex) => (
                <tr key={ex.id}>
                  <td className="exam-title">{ex.title}</td>
                  <td>{ex.course_name || "-"}</td>
                  <td>{new Date(ex.exam_date).toLocaleDateString()}</td>
                  <td>
                    {ex.status === "upcoming" ? (
                      <span className={`countdown ${daysUntil(ex.exam_date) === "Overdue" ? "overdue" : ""}`}>
                        {daysUntil(ex.exam_date)}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    <div className="score-cell">
                      <input
                        key={`${ex.id}-${ex.status}`}
                        type="number"
                        min="0"
                        max="100"
                        placeholder="—"
                        className="score-input"
                        defaultValue={ex.score ?? ""}
                        title="Enter your score and press Enter or ✓"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            (e.target as HTMLInputElement).blur();
                            saveScore(
                              ex,
                              parseFloat((e.target as HTMLInputElement).value),
                            );
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn-secondary btn-small score-save"
                        title="Save score"
                        onClick={(e) => {
                          const input = e.currentTarget
                            .previousElementSibling as HTMLInputElement;
                          saveScore(ex, parseFloat(input.value));
                        }}
                      >
                        ✓
                      </button>
                    </div>
                  </td>
                  <td>
                    <span className={`badge badge-${ex.status}`}>
                      {ex.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn-danger btn-small"
                      onClick={() => handleDelete(ex.id)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}