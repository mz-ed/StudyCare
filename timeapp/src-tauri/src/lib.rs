use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;

#[tauri::command]
fn read_pdf(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(STANDARD.encode(bytes))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        tauri_plugin_sql::Migration {
            version: 1,
            description: "initial_schema",
            sql: include_str!("../migrations/0001_initial.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 2,
            description: "calendar_events",
            sql: include_str!("../migrations/0002_calendar.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 3,
            description: "notes",
            sql: include_str!("../migrations/0003_notes.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
        tauri_plugin_sql::Migration {
            version: 4,
            description: "pdfs",
            sql: include_str!("../migrations/0004_pdfs.sql"),
            kind: tauri_plugin_sql::MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:studytracker.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![read_pdf])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
