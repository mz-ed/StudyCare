export type Page = "dashboard" | "courses" | "timer" | "exams" | "calendar";

interface SidebarProps {
  current: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { page: Page; label: string; icon: string }[] = [
  { page: "dashboard", label: "Dashboard", icon: "🏛" },
  { page: "courses", label: "Courses", icon: "📚" },
  { page: "timer", label: "Study Timer", icon: "⏱" },
  { page: "exams", label: "Exams", icon: "🩺" },
  { page: "calendar", label: "Calendar", icon: "📅" },
];

export function Sidebar({ current, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-icon">🎓</span>
        <div>
          <h1>StudyCare</h1>
          <p>Medical Study Tracker</p>
        </div>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.page}
            className={`nav-item ${current === item.page ? "active" : ""}`}
            onClick={() => onNavigate(item.page)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">v0.1.0</div>
    </aside>
  );
}