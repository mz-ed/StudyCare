export interface Course {
  id: number;
  name: string;
  code?: string | null;
  semester?: string | null;
  credits: number;
  grade?: number | null;
  status: "in_progress" | "completed" | "planned";
  created_at: string;
  updated_at: string;
}

export interface StudySession {
  id: number;
  course_id: number;
  started_at: string;
  ended_at?: string | null;
  duration_minutes: number;
  notes?: string | null;
  created_at: string;
}

export interface Exam {
  id: number;
  course_id: number;
  title: string;
  exam_date: string;
  score?: number | null;
  status: "upcoming" | "passed" | "failed";
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Timer {
  id: number;
  course_id?: number | null;
  mode: "pomodoro" | "custom";
  focus_minutes: number;
  break_minutes: number;
  started_at: string;
  ended_at?: string | null;
  status: string;
  created_at: string;
}

export type EventCategory =
  | "general"
  | "study"
  | "exam"
  | "clinical"
  | "personal";

export interface CalendarEvent {
  id: number;
  date: string;
  title: string;
  description?: string | null;
  category: EventCategory;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  category: string;
  pinned: number;
  created_at: string;
  updated_at: string;
}

export interface Pdf {
  id: number;
  file_name: string;
  file_path: string;
  page_count: number | null;
  added_at: string;
  last_opened: string | null;
}

export interface PdfNote {
  id: number;
  pdf_id: number;
  content: string;
  updated_at: string;
}