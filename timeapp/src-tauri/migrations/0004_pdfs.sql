CREATE TABLE IF NOT EXISTS pdfs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  page_count INTEGER,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_opened TEXT
);

CREATE TABLE IF NOT EXISTS pdf_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pdf_id INTEGER NOT NULL UNIQUE REFERENCES pdfs(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pdf_notes_pdf_id ON pdf_notes(pdf_id);