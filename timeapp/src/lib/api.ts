import { execute, query } from "./db";
import type { CalendarEvent, Course, Exam, Note, Pdf, PdfNote, StudySession } from "./types";

export async function fetchCourses(): Promise<Course[]> {
  return query<Course>("SELECT * FROM courses ORDER BY created_at DESC");
}

export async function addCourse(course: {
  name: string;
  code?: string;
  semester?: string;
  credits: number;
  status: string;
}): Promise<void> {
  await execute(
    "INSERT INTO courses (name, code, semester, credits, status) VALUES ($1, $2, $3, $4, $5)",
    [course.name, course.code ?? null, course.semester ?? null, course.credits, course.status],
  );
}

export async function updateCourse(
  id: number,
  course: Partial<Course>,
): Promise<void> {
  const params: unknown[] = [];
  const setters: string[] = [];

  if (course.name !== undefined) {
    params.push(course.name);
    setters.push("name = $" + params.length.toString());
  }
  if (course.code !== undefined) {
    params.push(course.code);
    setters.push("code = $" + params.length.toString());
  }
  if (course.semester !== undefined) {
    params.push(course.semester);
    setters.push("semester = $" + params.length.toString());
  }
  if (course.credits !== undefined) {
    params.push(course.credits);
    setters.push("credits = $" + params.length.toString());
  }
  if (course.grade !== undefined) {
    params.push(course.grade);
    setters.push("grade = $" + params.length.toString());
  }
  if (course.status !== undefined) {
    params.push(course.status);
    setters.push("status = $" + params.length.toString());
  }
  setters.push("updated_at = CURRENT_TIMESTAMP");
  params.push(id);
  await execute(
    `UPDATE courses SET ${setters.join(", ")} WHERE id = $${params.length}`,
    params,
  );
}

export async function deleteCourse(id: number): Promise<void> {
  await execute("DELETE FROM courses WHERE id = $1", [id]);
}

export async function fetchStudySessions(
  courseId?: number,
): Promise<StudySession[]> {
  if (courseId) {
    return query<StudySession>(
      "SELECT * FROM study_sessions WHERE course_id = $1 ORDER BY created_at DESC",
      [courseId],
    );
  }
  return query<StudySession>(
    "SELECT * FROM study_sessions ORDER BY created_at DESC",
  );
}

export async function addStudySession(session: {
  course_id: number;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  notes?: string;
}): Promise<void> {
  await execute(
    "INSERT INTO study_sessions (course_id, started_at, ended_at, duration_minutes, notes) VALUES ($1, $2, $3, $4, $5)",
    [session.course_id, session.started_at, session.ended_at, session.duration_minutes, session.notes ?? null],
  );
}

export async function fetchExams(): Promise<Exam[]> {
  return query<Exam>("SELECT * FROM exams ORDER BY exam_date ASC");
}

export async function addExam(exam: {
  course_id: number;
  title: string;
  exam_date: string;
  weight: number;
  status: string;
}): Promise<void> {
  await execute(
    "INSERT INTO exams (course_id, title, exam_date, weight, status) VALUES ($1, $2, $3, $4, $5)",
    [exam.course_id, exam.title, exam.exam_date, exam.weight, exam.status],
  );
}

export async function updateExam(
  id: number,
  exam: Partial<Exam>,
): Promise<void> {
  const setters: string[] = [];
  const params: unknown[] = [];

  if (exam.score !== undefined) {
    params.push(exam.score);
    setters.push("score = $" + params.length.toString());
  }
  if (exam.status !== undefined) {
    params.push(exam.status);
    setters.push("status = $" + params.length.toString());
  }
  setters.push("updated_at = CURRENT_TIMESTAMP");
  params.push(id);
  await execute(
    `UPDATE exams SET ${setters.join(", ")} WHERE id = $${params.length}`,
    params,
  );
}

export async function deleteExam(id: number): Promise<void> {
  await execute("DELETE FROM exams WHERE id = $1", [id]);
}

export async function getDashboardStats(): Promise<{
  totalCourses: number;
  completedCourses: number;
  totalStudyMinutes: number;
  upcomingExams: number;
}> {
  const courses = await query<{ total: number; completed: number }>(
    `SELECT COUNT(*) as total,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
     FROM courses`,
  );
  const sessions = await query<{ total: number }>(
    "SELECT COALESCE(SUM(duration_minutes), 0) as total FROM study_sessions",
  );
  const exams = await query<{ total: number }>(
    "SELECT COUNT(*) as total FROM exams WHERE status = 'upcoming'",
  );

  return {
    totalCourses: courses[0]?.total ?? 0,
    completedCourses: courses[0]?.completed ?? 0,
    totalStudyMinutes: sessions[0]?.total ?? 0,
    upcomingExams: exams[0]?.total ?? 0,
  };
}

export async function getRecentSessions(limit = 5): Promise<Array<
  StudySession & { course_name: string }
>> {
  return query<StudySession & { course_name: string }>(
    `SELECT ss.*, c.name as course_name
     FROM study_sessions ss
     JOIN courses c ON c.id = ss.course_id
     ORDER BY ss.created_at DESC
     LIMIT $1`,
    [limit],
  );
}

export async function fetchEventsForMonth(
  year: number,
  month: number,
): Promise<CalendarEvent[]> {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = `${year}-${String(month).padStart(2, "0")}-31`;
  return query<CalendarEvent>(
    "SELECT * FROM calendar_events WHERE date BETWEEN $1 AND $2 ORDER BY date ASC",
    [start, end],
  );
}

export async function fetchEventsForDate(date: string): Promise<CalendarEvent[]> {
  return query<CalendarEvent>(
    "SELECT * FROM calendar_events WHERE date = $1 ORDER BY created_at DESC",
    [date],
  );
}

export async function addCalendarEvent(event: {
  date: string;
  title: string;
  description?: string;
  category: string;
}): Promise<void> {
  await execute(
    "INSERT INTO calendar_events (date, title, description, category) VALUES ($1, $2, $3, $4)",
    [event.date, event.title, event.description ?? null, event.category],
  );
}

export async function updateCalendarEvent(
  id: number,
  event: { title: string; description?: string; category: string },
): Promise<void> {
  await execute(
    "UPDATE calendar_events SET title = $1, description = $2, category = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4",
    [event.title, event.description ?? null, event.category, id],
  );
}

export async function deleteCalendarEvent(id: number): Promise<void> {
  await execute("DELETE FROM calendar_events WHERE id = $1", [id]);
}

export async function fetchNotes(): Promise<Note[]> {
  return query<Note>(
    "SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC",
  );
}

export async function addNote(): Promise<Note | null> {
  await execute(
    "INSERT INTO notes (title, content, updated_at) VALUES ('Untitled', '', CURRENT_TIMESTAMP)",
  );
  const rows = await query<Note>(
    "SELECT * FROM notes ORDER BY id DESC LIMIT 1",
  );
  return rows[0] ?? null;
}

export async function updateNote(
  id: number,
  note: {
    title: string;
    content: string;
    category: string;
    pinned?: boolean;
  },
): Promise<void> {
  await execute(
    "UPDATE notes SET title = $1, content = $2, category = $3, pinned = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5",
    [
      note.title.trim() || "Untitled",
      note.content,
      note.category,
      note.pinned ? 1 : 0,
      id,
    ],
  );
}

export async function deleteNote(id: number): Promise<void> {
  await execute("DELETE FROM notes WHERE id = $1", [id]);
}

export async function fetchPdfs(): Promise<Pdf[]> {
  return query<Pdf>("SELECT * FROM pdfs ORDER BY last_opened DESC, added_at DESC");
}

export async function addPdf(
  file_name: string,
  file_path: string,
): Promise<Pdf | null> {
  await execute(
    "INSERT INTO pdfs (file_name, file_path) VALUES ($1, $2)",
    [file_name, file_path],
  );
  const rows = await query<Pdf>("SELECT * FROM pdfs ORDER BY id DESC LIMIT 1");
  return rows[0] ?? null;
}

export async function updatePdfMeta(
  id: number,
  pageCount: number,
): Promise<void> {
  await execute(
    "UPDATE pdfs SET page_count = $1, last_opened = CURRENT_TIMESTAMP WHERE id = $2",
    [pageCount, id],
  );
}

export async function deletePdf(id: number): Promise<void> {
  await execute("DELETE FROM pdf_notes WHERE pdf_id = $1", [id]);
  await execute("DELETE FROM pdfs WHERE id = $1", [id]);
}

export async function fetchPdfNote(pdfId: number): Promise<PdfNote | null> {
  const rows = await query<PdfNote>(
    "SELECT * FROM pdf_notes WHERE pdf_id = $1 LIMIT 1",
    [pdfId],
  );
  return rows[0] ?? null;
}

export async function upsertPdfNote(
  pdfId: number,
  content: string,
): Promise<void> {
  await execute(
    "INSERT INTO pdf_notes (pdf_id, content, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT(pdf_id) DO UPDATE SET content = excluded.content, updated_at = CURRENT_TIMESTAMP",
    [pdfId, content],
  );
}