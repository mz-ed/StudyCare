import { useEffect, useMemo, useState } from "react";
import {
  addCalendarEvent,
  deleteCalendarEvent,
  fetchEventsForDate,
  fetchEventsForMonth,
  updateCalendarEvent,
} from "../lib/api";
import type { CalendarEvent, EventCategory } from "../lib/types";

const CATEGORY_COLORS: Record<EventCategory, string> = {
  general: "#5b6b78",
  study: "#1a5f7a",
  exam: "#c44536",
  clinical: "#2e9e6b",
  personal: "#9a6a16",
};

const CATEGORY_LABELS: Record<EventCategory, string> = {
  general: "General",
  study: "Study",
  exam: "Exam",
  clinical: "Clinical",
  personal: "Personal",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function Calendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(
    formatDateKey(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  const [dayEvents, setDayEvents] = useState<CalendarEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "general" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadMonth();
  }, [year, month]);

  useEffect(() => {
    if (selectedDate) loadDay();
  }, [selectedDate]);

  async function loadMonth() {
    try {
      setEvents(await fetchEventsForMonth(year, month));
    } catch (err) {
      console.error("Failed to load month events", err);
    }
  }

  async function loadDay() {
    if (!selectedDate) return;
    try {
      setDayEvents(await fetchEventsForDate(selectedDate));
    } catch (err) {
      console.error("Failed to load day events", err);
    }
  }

  const grid = useMemo(() => {
    const first = new Date(year, month, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: { dateKey: string; day: number; isCurrentMonth: boolean }[] = [];
    for (let i = 0; i < startWeekday; i++) {
      const d = new Date(year, month, i - startWeekday + 1);
      cells.push({ dateKey: formatDateKey(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ dateKey: formatDateKey(year, month, d), day: d, isCurrentMonth: true });
    }
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      cells.push({ dateKey: formatDateKey(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), isCurrentMonth: false });
    }
    return cells;
  }, [year, month]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [events]);

  function prevMonth() {
    const d = new Date(year, month - 1, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  function nextMonth() {
    const d = new Date(year, month + 1, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  const monthName = new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  function selectedDateLabel() {
    if (!selectedDate) return "";
    const [y, m, d] = selectedDate.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function resetForm() {
    setForm({ title: "", description: "", category: "general" });
    setEditingId(null);
    setError("");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedDate) return;
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    try {
      if (editingId !== null) {
        await updateCalendarEvent(editingId, {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          category: form.category,
        });
      } else {
        await addCalendarEvent({
          date: selectedDate,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          category: form.category,
        });
      }
      await loadMonth();
      await loadDay();
      resetForm();
      setShowForm(false);
    } catch (err) {
      setError("Failed to save event: " + String(err));
    }
  }

  function startEdit(e: CalendarEvent) {
    setEditingId(e.id);
    setForm({ title: e.title, description: e.description ?? "", category: e.category });
    setShowForm(true);
  }

  async function handleDelete(id: number) {
    if (confirm("Delete this event?")) {
      try {
        await deleteCalendarEvent(id);
        await loadMonth();
        await loadDay();
      } catch (err) {
        console.error("Failed to delete event", err);
      }
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h2>Calendar</h2>
        <p>Pick a day and add your study plans, exams, and notes</p>
      </header>

      <div className="calendar-layout">
        <section className="panel calendar-panel">
          <div className="calendar-toolbar">
            <button className="btn-secondary" onClick={prevMonth}>←</button>
            <h3 className="calendar-month">{monthName}</h3>
            <button className="btn-secondary" onClick={nextMonth}>→</button>
          </div>

          <div className="calendar-grid-head">
            {WEEKDAYS.map((w) => (
              <div key={w} className="calendar-weekday">{w}</div>
            ))}
          </div>

          <div className="calendar-grid">
            {grid.map((cell, i) => {
              const dayEventsList = eventsByDate.get(cell.dateKey);
              const isToday = cell.dateKey === formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());
              const isSelected = cell.dateKey === selectedDate;
              return (
                <div
                  key={i}
                  className={`calendar-day ${cell.isCurrentMonth ? "" : "out-month"} ${
                    isToday ? "today" : ""
                  } ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedDate(cell.dateKey)}
                >
                  <span className="calendar-day-num">{cell.day}</span>
                  <div className="calendar-day-dots">
                    {(dayEventsList ?? []).slice(0, 3).map((e) => (
                      <span
                        key={e.id}
                        className="event-dot"
                        style={{ background: CATEGORY_COLORS[e.category] }}
                        title={e.title}
                      />
                    ))}
                    {(dayEventsList ?? []).length > 3 && (
                      <span className="event-more">+{(dayEventsList ?? []).length - 3}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="calendar-legend">
            {(Object.keys(CATEGORY_COLORS) as EventCategory[]).map((c) => (
              <span key={c} className="legend-item">
                <span className="event-dot" style={{ background: CATEGORY_COLORS[c] }} />
                {CATEGORY_LABELS[c]}
              </span>
            ))}
          </div>
        </section>

        <section className="panel day-panel">
          <h3>{selectedDateLabel()}</h3>
          <button
            className="btn-primary"
            onClick={() => {
              resetForm();
              setEditingId(null);
              setShowForm(!showForm);
            }}
          >
            {showForm ? "Cancel" : "+ Add Event"}
          </button>

          {showForm && (
            <form className="event-form" onSubmit={handleSave}>
              <label>
                Title *
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Review Pharmacology ch. 5"
                />
              </label>
              <label>
                Description
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional details..."
                />
              </label>
              <label>
                Category
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {(Object.keys(CATEGORY_LABELS) as EventCategory[]).map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </label>
              {error && <p className="error-text">{error}</p>}
              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  {editingId !== null ? "Save Changes" : "Add Event"}
                </button>
                <button type="button" className="btn-secondary" onClick={() => { resetForm(); setShowForm(false); }}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {!showForm && (
            <div className="day-events">
              {dayEvents.length === 0 ? (
                <p className="empty-state">
                  Nothing on this day yet. Click "+ Add Event" to plan something.
                </p>
              ) : (
                dayEvents.map((e) => (
                  <div key={e.id} className="event-card">
                    <div className="event-card-top">
                      <span
                        className="event-cat-pill"
                        style={{
                          background: CATEGORY_COLORS[e.category] + "22",
                          color: CATEGORY_COLORS[e.category],
                        }}
                      >
                        {CATEGORY_LABELS[e.category]}
                      </span>
                      <h4>{e.title}</h4>
                    </div>
                    {e.description && <p className="event-desc">{e.description}</p>}
                    <div className="event-actions">
                      <button className="btn-secondary btn-small" onClick={() => startEdit(e)}>
                        Edit
                      </button>
                      <button className="btn-danger btn-small" onClick={() => handleDelete(e.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}