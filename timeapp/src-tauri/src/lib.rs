use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::time::Duration;

use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::Manager;

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
        .invoke_handler(tauri::generate_handler![
            read_pdf,
            set_api_key,
            has_api_key,
            clear_api_key,
            chat_completion,
            fetch_available_models
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn read_pdf(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(STANDARD.encode(bytes))
}

// ---------- AI chat ----------

#[derive(Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

fn keys_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("config dir: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("create dir: {e}"))?;
    Ok(dir.join("ai_keys.json"))
}

fn load_keys(app: &tauri::AppHandle) -> HashMap<String, String> {
    let Ok(path) = keys_path(app) else {
        return HashMap::new();
    };
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_keys(app: &tauri::AppHandle, keys: &HashMap<String, String>) -> Result<(), String> {
    let path = keys_path(app)?;
    let json = serde_json::to_string_pretty(keys).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        let mut opts = fs::OpenOptions::new();
        opts.create(true).write(true).truncate(true).mode(0o600);
        let mut f = opts.open(&path).map_err(|e| e.to_string())?;
        f.write_all(json.as_bytes()).map_err(|e| e.to_string())
    }
    #[cfg(not(unix))]
    {
        fs::write(&path, json).map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn set_api_key(app: tauri::AppHandle, provider: String, key: String) -> Result<(), String> {
    let key = key.trim();
    let provider = provider.trim().to_lowercase();
    if provider.is_empty() || key.is_empty() {
        return Err("Provider and API key are required.".into());
    }
    let mut keys = load_keys(&app);
    keys.insert(provider, key.to_string());
    write_keys(&app, &keys)
}

#[tauri::command]
fn has_api_key(app: tauri::AppHandle, provider: String) -> Result<bool, String> {
    Ok(load_keys(&app).contains_key(&provider.to_lowercase()))
}

#[tauri::command]
fn clear_api_key(app: tauri::AppHandle, provider: String) -> Result<(), String> {
    let mut keys = load_keys(&app);
    keys.remove(&provider.to_lowercase());
    write_keys(&app, &keys)
}

fn get_key(app: &tauri::AppHandle, provider: &str) -> Option<String> {
    load_keys(app).get(provider).cloned()
}

const MAX_TOKENS: u32 = 2048;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(180);

fn base_system(context: &[String]) -> String {
    let guide = "You are a helpful AI study assistant for a medical student. Answer clearly, accurately, and concisely.";
    if context.is_empty() {
        return guide.to_string();
    }
    format!(
        "{guide}\n\nUser-provided study material (their saved notes and/or PDF excerpts) is:\n{}\n\nUse it whenever relevant to answer questions.",
        context.join("\n\n---\n\n")
    )
}

async fn post_json(
    client: &reqwest::Client,
    url: &str,
    headers: &[(String, String)],
    body: &serde_json::Value,
) -> Result<serde_json::Value, String> {
    let mut req = client.post(url).timeout(REQUEST_TIMEOUT);
    for (k, v) in headers {
        req = req.header(k, v);
    }
    let resp = req
        .json(body)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;
    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("Response error: {e}"))?;
    if !status.is_success() {
        let msg = serde_json::from_str::<serde_json::Value>(&text)
            .ok()
            .and_then(|v| v["error"]["message"].as_str().map(String::from))
            .unwrap_or_else(|| text.chars().take(300).collect());
        return Err(format!("{status}: {msg}"));
    }
    serde_json::from_str::<serde_json::Value>(&text).map_err(|e| format!("Parse error: {e}"))
}

async fn get_json(
    client: &reqwest::Client,
    url: &str,
    headers: &[(String, String)],
) -> Result<serde_json::Value, String> {
    let mut req = client.get(url).timeout(REQUEST_TIMEOUT);
    for (k, v) in headers {
        req = req.header(k, v);
    }
    let resp = req
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;
    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("Response error: {e}"))?;
    if !status.is_success() {
        let msg = serde_json::from_str::<serde_json::Value>(&text)
            .ok()
            .and_then(|v| v["error"]["message"].as_str().map(String::from))
            .unwrap_or_else(|| text.chars().take(300).collect());
        return Err(format!("{status}: {msg}"));
    }
    serde_json::from_str::<serde_json::Value>(&text).map_err(|e| format!("Parse error: {e}"))
}

fn bearer_header(key: &str) -> Vec<(String, String)> {
    vec![(String::from("authorization"), format!("Bearer {key}"))]
}

#[tauri::command]
async fn fetch_available_models(
    app: tauri::AppHandle,
    provider: String,
) -> Result<Vec<String>, String> {
    let provider = provider.trim().to_lowercase();
    let client = reqwest::Client::new();
    let models: Vec<String> = match provider.as_str() {
        "gemini" => {
            let key =
                get_key(&app, "gemini").ok_or_else(|| "No Google Gemini API key set.".to_string())?;
            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/models?key={key}"
            );
            let v = get_json(&client, &url, &[]).await?;
            let arr = v["models"]
                .as_array()
                .ok_or_else(|| "Unexpected response format.".to_string())?;
            let mut ids: Vec<String> = arr
                .iter()
                .filter(|m| {
                    m["supportedGenerationMethods"]
                        .as_array()
                        .map(|a| a.iter().any(|x| x == "generateContent"))
                        .unwrap_or(false)
                })
                .filter_map(|m| m["name"].as_str())
                .map(|s| s.strip_prefix("models/").unwrap_or(s).to_string())
                .collect();
            ids.sort();
            ids
        }
        "openai" => {
            let key = get_key(&app, "openai").ok_or_else(|| "No OpenAI API key set.".to_string())?;
            let v = get_json(
                &client,
                "https://api.openai.com/v1/models",
                &bearer_header(&key),
            )
            .await?;
            let mut ids = sorted_model_ids(&v)?;
            ids.sort();
            ids
        }
        "openrouter" => {
            let key = get_key(&app, "openrouter")
                .ok_or_else(|| "No OpenRouter API key set.".to_string())?;
            let v = get_json(
                &client,
                "https://openrouter.ai/api/v1/models",
                &bearer_header(&key),
            )
            .await?;
            let mut ids = sorted_model_ids(&v)?;
            ids.sort();
            ids
        }
        "anthropic" => {
            let key =
                get_key(&app, "anthropic").ok_or_else(|| "No Anthropic API key set.".to_string())?;
            let v = get_json(
                &client,
                "https://api.anthropic.com/v1/models",
                &[
                    (String::from("x-api-key"), key),
                    (
                        String::from("anthropic-version"),
                        String::from("2023-06-01"),
                    ),
                ],
            )
            .await?;
            let mut ids = sorted_model_ids(&v)?;
            ids.sort();
            ids
        }
        _ => return Err(format!("No model list endpoint for provider: {provider}")),
    };
    Ok(models)
}

fn sorted_model_ids(v: &serde_json::Value) -> Result<Vec<String>, String> {
    let arr = v["data"]
        .as_array()
        .ok_or_else(|| "Unexpected response format.".to_string())?;
    let mut ids: Vec<String> = arr
        .iter()
        .filter_map(|m| m["id"].as_str().map(String::from))
        .collect();
    ids.sort();
    if ids.is_empty() {
        return Err("The provider returned no models.".into());
    }
    Ok(ids)
}

async fn chat_openai_compatible(
    client: &reqwest::Client,
    base_url: &str,
    key: &str,
    model: &str,
    messages: &[ChatMessage],
    system: &str,
) -> Result<String, String> {
    let mut body_msgs = vec![json!({ "role": "system", "content": system })];
    for m in messages {
        body_msgs.push(json!({ "role": m.role, "content": m.content }));
    }
    let body = json!({ "model": model, "messages": body_msgs, "max_tokens": MAX_TOKENS });
    let resp = post_json(
        client,
        &format!("{base_url}/chat/completions"),
        &[(String::from("authorization"), format!("Bearer {key}"))],
        &body,
    )
    .await?;
    resp["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| "The model returned no content.".into())
}

async fn chat_anthropic(
    client: &reqwest::Client,
    key: &str,
    model: &str,
    messages: &[ChatMessage],
    system: &str,
) -> Result<String, String> {
    let mut body_msgs = Vec::new();
    for m in messages {
        let role = if m.role == "assistant" { "assistant" } else { "user" };
        body_msgs.push(json!({ "role": role, "content": m.content }));
    }
    let body = json!({
        "model": model,
        "system": system,
        "max_tokens": MAX_TOKENS,
        "messages": body_msgs,
    });
    let resp = post_json(
        client,
        "https://api.anthropic.com/v1/messages",
        &[
            (String::from("x-api-key"), key.to_string()),
            (
                String::from("anthropic-version"),
                String::from("2023-06-01"),
            ),
        ],
        &body,
    )
    .await?;
    resp["content"]
        .as_array()
        .and_then(|arr| arr.iter().find(|c| c["type"] == "text"))
        .and_then(|c| c["text"].as_str())
        .map(|s| s.trim().to_string())
        .ok_or_else(|| "The model returned no content.".into())
}

async fn chat_gemini(
    client: &reqwest::Client,
    key: &str,
    model: &str,
    messages: &[ChatMessage],
    system: &str,
) -> Result<String, String> {
    let mut contents: Vec<(String, String)> = Vec::new();
    for m in messages {
        let role = if m.role == "assistant" { "model" } else { "user" };
        if let Some(last) = contents.last_mut() {
            if last.0 == role {
                last.1.push_str("\n");
                last.1.push_str(&m.content);
                continue;
            }
        }
        contents.push((role.to_string(), m.content.clone()));
    }
    if contents.first().map(|c| c.0.as_str()) == Some("model") {
        contents.insert(0, (String::from("user"), String::from("Continue.")));
    }
    let body = json!({
        "system_instruction": { "parts": [{ "text": system }] },
        "contents": contents
            .iter()
            .map(|(r, c)| json!({ "role": r, "parts": [{ "text": c }] }))
            .collect::<Vec<_>>(),
        "generationConfig": { "maxOutputTokens": MAX_TOKENS },
    });
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    );
    let resp = post_json(client, &url, &[], &body).await?;
    resp["candidates"][0]["content"]["parts"]
        .as_array()
        .and_then(|parts| {
            parts
                .iter()
                .map(|p| p["text"].as_str())
                .collect::<Option<Vec<_>>>()
        })
        .map(|texts| texts.join("").trim().to_string())
        .ok_or_else(|| "The model returned no content.".into())
}

async fn chat_ollama(
    client: &reqwest::Client,
    host: &str,
    model: &str,
    messages: &[ChatMessage],
    system: &str,
) -> Result<String, String> {
    let mut ollama_msgs = vec![json!({ "role": "system", "content": system })];
    for m in messages {
        ollama_msgs.push(json!({ "role": m.role, "content": m.content }));
    }
    let body = json!({ "model": model, "messages": ollama_msgs, "stream": false });
    let resp = post_json(client, &format!("{host}/api/chat"), &[], &body).await?;
    resp["message"]["content"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| "The model returned no content.".into())
}

#[tauri::command]
async fn chat_completion(
    app: tauri::AppHandle,
    provider: String,
    model: String,
    messages: Vec<ChatMessage>,
    context: Vec<String>,
) -> Result<String, String> {
    let provider = provider.trim().to_lowercase();
    let model = model.trim().to_string();
    if model.is_empty() {
        return Err("Select a model first.".into());
    }
    let system = base_system(&context);
    let client = reqwest::Client::new();

    match provider.as_str() {
        "openai" => {
            let key = get_key(&app, "openai").ok_or_else(|| "No OpenAI API key set.".to_string())?;
            chat_openai_compatible(
                &client,
                "https://api.openai.com/v1",
                &key,
                &model,
                &messages,
                &system,
            )
            .await
        }
        "openrouter" => {
            let key =
                get_key(&app, "openrouter").ok_or_else(|| "No OpenRouter API key set.".to_string())?;
            chat_openai_compatible(
                &client,
                "https://openrouter.ai/api/v1",
                &key,
                &model,
                &messages,
                &system,
            )
            .await
        }
        "anthropic" => {
            let key =
                get_key(&app, "anthropic").ok_or_else(|| "No Anthropic API key set.".to_string())?;
            chat_anthropic(&client, &key, &model, &messages, &system).await
        }
        "gemini" => {
            let key = get_key(&app, "gemini").ok_or_else(|| "No Google Gemini API key set.".to_string())?;
            chat_gemini(&client, &key, &model, &messages, &system).await
        }
        "ollama" => {
            chat_ollama(&client, "http://localhost:11434", &model, &messages, &system).await
        }
        _ => Err(format!("Unknown AI provider: {provider}")),
    }
}
