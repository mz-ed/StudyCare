# StudyCare

A desktop study tracker for medical students, built with Tauri v2 (Rust backend) and React + TypeScript (frontend). All data is stored locally in SQLite — no internet required.

## Features

- 📚 **Courses** — manage courses, credits, grades, and progress status
- ⏱ **Study Timer** — Pomodoro-style focus sessions automatically logged per course
- 🩺 **Exams** — track upcoming exams with live countdowns and scored results
- 📅 **Calendar** — pick a day and add study plans, exams, and notes with color-coded categories
- 🏛 **Dashboard** — overview of courses, study hours, exam countdowns, and completion

## Tech Stack

| Layer | Technology |
|---|---|
| Shell | Tauri v2 (Rust) |
| Frontend | React 19 + TypeScript + Vite |
| Database | SQLite via `tauri-plugin-sql` |
| Cross-compile | `cargo-xwin` for Windows targets |

## Project Layout

```
timeapp/
├── src/                 # React frontend
│   ├── components/      # UI components (Sidebar, etc.)
│   ├── pages/           # Dashboard, Courses, Timer, Exams, Calendar
│   └── lib/             # Types, DB helpers, API layer
└── src-tauri/           # Rust backend
    ├── src/lib.rs       # Tauri app + SQLite migrations
    ├── migrations/      # SQL schema migrations
    └── tauri.conf.json  # App configuration
```

## Development

Requires Rust and Node.js (see Tauri prerequisites). Examples use pnpm:

```bash
cd timeapp
pnpm install
pnpm tauri dev        # run in development mode
pnpm tauri build      # build installers (deb/rpm/appimage)
pnpm tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc   # Windows .exe
```

## License

[MIT](LICENSE)

Copyright (c) 2026 Abd Elhadi