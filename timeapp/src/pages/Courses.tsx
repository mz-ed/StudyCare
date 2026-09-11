import { useEffect, useState } from "react";
import { addCourse, deleteCourse, fetchCourses, updateCourse } from "../lib/api";
import type { Course } from "../lib/types";

const EMPTY_FORM = {
  name: "",
  code: "",
  semester: "",
  credits: "",
  status: "in_progress",
  grade: "",
};

export function Courses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setCourses(await fetchCourses());
    } catch (err) {
      console.error("Failed to load courses", err);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Course name is required.");
      return;
    }

    const data = {
      name: form.name.trim(),
      code: form.code.trim() || undefined,
      semester: form.semester.trim() || undefined,
      credits: parseInt(form.credits) || 0,
      status: form.status as Course["status"],
    };

    try {
      if (editingId !== null) {
        const updates: Partial<Course> = { ...data };
        if (form.grade !== "") updates.grade = parseFloat(form.grade);
        await updateCourse(editingId, updates);
      } else {
        await addCourse(data);
      }
      await load();
      resetForm();
    } catch (err) {
      setError("Failed to save course: " + String(err));
    }
  }

  function startEdit(c: Course) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      code: c.code ?? "",
      semester: c.semester ?? "",
      credits: String(c.credits ?? ""),
      status: c.status,
      grade: c.grade != null ? String(c.grade) : "",
    });
    setShowForm(true);
  }

  async function handleDelete(id: number) {
    if (confirm("Delete this course and all its data?")) {
      try {
        await deleteCourse(id);
        await load();
      } catch (err) {
        console.error("Failed to delete course", err);
      }
    }
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
    setError("");
  }

  return (
    <div className="page">
      <header className="page-header">
        <p>Manage your medical study courses</p>
        <button
          className="btn-primary"
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
        >
          {showForm ? "Cancel" : "+ Add Course"}
        </button>
      </header>

      {showForm && (
        <form className="panel form-grid" onSubmit={handleSave}>
          <h3>{editingId !== null ? "Edit Course" : "New Course"}</h3>
          <label>
            Name *
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Anatomy"
            />
          </label>
          <label>
            Code
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="e.g. MED101"
            />
          </label>
          <label>
            Semester
            <input
              value={form.semester}
              onChange={(e) => setForm({ ...form, semester: e.target.value })}
              placeholder="e.g. Year 1, Sem 2"
            />
          </label>
          <label>
            Credits
            <input
              type="number"
              min="0"
              value={form.credits}
              onChange={(e) => setForm({ ...form, credits: e.target.value })}
              placeholder="e.g. 5"
            />
          </label>
          <label>
            Status
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="in_progress">In Progress</option>
              <option value="planned">Planned</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          {editingId !== null && (
            <label>
              Grade (0-4 or %)
              <input
                type="number"
                step="0.01"
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                placeholder="e.g. 3.7"
              />
            </label>
          )}
          {error && <p className="error-text">{error}</p>}
          <div className="form-actions">
            <button type="submit" className="btn-primary">
              {editingId !== null ? "Save Changes" : "Add Course"}
            </button>
            <button type="button" className="btn-secondary" onClick={resetForm}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="panel">
        {courses.length === 0 ? (
          <p className="empty-state">
            No courses yet. Add your first course to get started.
          </p>
        ) : (
          <div className="card-list">
            {courses.map((c) => (
              <div key={c.id} className="course-card">
                <div className="course-card-header">
                  <h3>{c.name}</h3>
                  <span className={`badge badge-${c.status}`}>{c.status.replace("_", " ")}</span>
                </div>
                <div className="course-card-meta">
                  {c.code && <span>{c.code}</span>}
                  {c.semester && <span>{c.semester}</span>}
                  {c.credits > 0 && <span>{c.credits} credits</span>}
                  {c.grade != null && <span>Grade: {c.grade}</span>}
                </div>
                <div className="course-card-actions">
                  <button className="btn-secondary" onClick={() => startEdit(c)}>
                    Edit
                  </button>
                  <button className="btn-danger" onClick={() => handleDelete(c.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}