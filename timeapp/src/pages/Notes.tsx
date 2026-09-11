import { useEffect, useRef, useState } from "react";
import {
  addNote,
  deleteNote,
  fetchNotes,
  updateNote,
} from "../lib/api";
import type { Note } from "../lib/types";

const NOTE_CATEGORIES = ["general", "study", "exam", "clinical", "personal"];

export function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [pinned, setPinned] = useState(false);
  const [search, setSearch] = useState("");
  const [dirty, setDirty] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const dirtyRef = useRef(false);
  const currentRef = useRef<{ id: number; title: string; content: string; category: string; pinned: boolean } | null>(null);

  useEffect(() => {
    loadNotes();
  }, []);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  async function loadNotes() {
    try {
      const n = await fetchNotes();
      setNotes(n);
      if (n.length > 0 && (selectedId == null || !n.some((x) => x.id === selectedId))) {
        openNote(n[0]);
      }
    } catch (err) {
      console.error("Failed to load notes", err);
    }
  }

  function openNote(note: Note) {
    setSelectedId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setCategory(note.category);
    setPinned(note.pinned === 1);
    setDirty(false);
    currentRef.current = {
      id: note.id,
      title: note.title,
      content: note.content,
      category: note.category,
      pinned: note.pinned === 1,
    };
  }

  async function persistCurrent() {
    const cur = currentRef.current;
    if (!cur) return;
    try {
      await updateNote(cur.id, {
        title,
        content,
        category,
        pinned,
      });
      // keep ref in sync with latest edited values
      currentRef.current = { id: cur.id, title, content, category, pinned };
      setDirty(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      await loadNotesOrdered();
    } catch (err) {
      console.error("Failed to save note", err);
    }
  }

  // After saving, reload, but don't blow away the editor state
  async function loadNotesOrdered() {
    try {
      setNotes(await fetchNotes());
    } catch (err) {
      console.error("Failed to reload notes", err);
    }
  }

  async function handleSelect(id: number) {
    if (id === selectedId) return;
    if (dirtyRef.current) {
      await persistCurrent();
    }
    const note = notes.find((n) => n.id === id);
    if (note) openNote(note);
  }

  async function handleNew() {
    if (dirtyRef.current) {
      await persistCurrent();
    }
    try {
      const note = await addNote();
      if (note) {
        setNotes([note, ...notes]);
        openNote(note);
      }
    } catch (err) {
      console.error("Failed to create note", err);
    }
  }

  async function handleDelete() {
    if (selectedId == null) return;
    if (!confirm("Delete this note?")) return;
    try {
      await deleteNote(selectedId);
      const remaining = notes.filter((n) => n.id !== selectedId);
      setNotes(remaining);
      if (remaining.length > 0) {
        openNote(remaining[0]);
      } else {
        setSelectedId(null);
        setTitle("");
        setContent("");
        currentRef.current = null;
      }
    } catch (err) {
      console.error("Failed to delete note", err);
    }
  }

  async function togglePin() {
    const next = !pinned;
    setPinned(next);
    if (currentRef.current) {
      try {
        await updateNote(currentRef.current.id, { title, content, category, pinned: next });
        currentRef.current = { ...currentRef.current, pinned: next };
        await loadNotesOrdered();
      } catch (err) {
        console.error("Failed to update pin", err);
      }
    }
  }

  const filtered = notes.filter((n) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q)
    );
  });

  function preview(note: Note): string {
    const text = note.content.trim();
    return text.length > 80 ? text.slice(0, 80) + "…" : text;
  }

  function dateLabel(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="page">
      <header className="page-header">
        <h2>Notes</h2>
        <p>Store your study notes and reference material</p>
        <button className="btn-primary" onClick={handleNew}>
          + New Note
        </button>
      </header>

      <div className="notes-layout">
        <section className="panel notes-list-panel">
          <input
            className="notes-search"
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="notes-list">
            {filtered.length === 0 ? (
              <p className="empty-state">
                {notes.length === 0
                  ? "No notes yet. Click '+ New Note' to write one."
                  : "No notes match your search."}
              </p>
            ) : (
              filtered.map((n) => (
                <div
                  key={n.id}
                  className={`note-item ${selectedId === n.id ? "active" : ""}`}
                  onClick={() => handleSelect(n.id)}
                >
                  <div className="note-item-top">
                    {n.pinned === 1 && <span className="pin-star" title="Pinned">★</span>}
                    <span className="note-item-title">{n.title}</span>
                  </div>
                  <p className="note-item-preview">{preview(n)}</p>
                  <div className="note-item-meta">
                    <span className={`badge badge-${n.category}`}>{n.category}</span>
                    <span className="note-item-date">{dateLabel(n.updated_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel notes-editor">
          {selectedId == null ? (
            <p className="empty-state">
              Select a note from the list, or create a new one.
            </p>
          ) : (
            <>
              <div className="notes-editor-top">
                <input
                  className="note-title-input"
                  placeholder="Note title..."
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setDirty(true);
                  }}
                />
                <button
                  className={`pin-btn ${pinned ? "active" : ""}`}
                  onClick={togglePin}
                  title={pinned ? "Unpin" : "Pin to top"}
                >
                  ★
                </button>
              </div>
              <div className="notes-editor-meta">
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setDirty(true);
                  }}
                >
                  {NOTE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
                {savedFlash && <span className="success-text">Saved ✓</span>}
              </div>
              <textarea
                className="note-content-input"
                placeholder="Write your notes here..."
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setDirty(true);
                }}
              />
              <div className="notes-editor-actions">
                <button className="btn-primary" onClick={persistCurrent}>
                  💾 Save
                </button>
                <button className="btn-danger" onClick={handleDelete}>
                  🗑 Delete
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}