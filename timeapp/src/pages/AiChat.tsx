import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PROVIDERS, getProvider, extractPdfText } from "../lib/ai";
import { readPdf } from "../lib/pdf";
import { fetchPdfs, fetchNotes } from "../lib/api";
import type { Pdf } from "../lib/types";

const LS_PROVIDER = "ai.provider";
const LS_MODEL = "ai.model";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

function ModelPicker({
  value,
  models,
  loading,
  error,
  onPick,
}: {
  value: string;
  models: string[];
  loading: boolean;
  error: string;
  onPick: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const filtered = filter.trim()
    ? models.filter((m) => m.toLowerCase().includes(filter.trim().toLowerCase()))
    : models;

  return (
    <div className="ai-model-picker">
      <button
        type="button"
        className="ai-model-field"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={value ? "" : "ai-model-placeholder"}>
          {loading ? "Loading models…" : value || "Choose a model"}
        </span>
        <span className="ai-model-caret">▾</span>
      </button>

      {open && (
        <div className="ai-model-dropdown">
          <input
            autoFocus
            className="ai-model-search"
            placeholder="Type to filter… (Enter uses it)"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filter.trim()) {
                onPick(filter.trim());
                setOpen(false);
              }
            }}
          />
          {error && !models.length && (
            <div className="ai-models-error ai-model-msg">{error}</div>
          )}
          {!error && models.length === 0 && !loading && (
            <div className="ai-model-msg">
              No models loaded. Save your API key first.
            </div>
          )}
          <div className="ai-model-list">
            {filtered.map((m) => (
              <button
                key={m}
                type="button"
                className={`ai-model-item ${m === value ? "selected" : ""}`}
                onClick={() => {
                  onPick(m);
                  setOpen(false);
                }}
              >
                {m}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="ai-model-msg">
                No matches — press Enter to use "{filter.trim()}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AiChat() {
  const savedProvider = localStorage.getItem(LS_PROVIDER) || "gemini";
  const [provider, setProvider] = useState(savedProvider);
  const [model, setModel] = useState(localStorage.getItem(LS_MODEL) ?? "");
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [keySaving, setKeySaving] = useState(false);
  const [keyStatus, setKeyStatus] = useState("");
  const [attachNotes, setAttachNotes] = useState(false);
  const [pdfs, setPdfs] = useState<Pdf[]>([]);
  const [selectedPdfIds, setSelectedPdfIds] = useState<Set<number>>(new Set());

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    fetchPdfs().then(setPdfs).catch(() => {});
  }, []);

  useEffect(() => {
    setApiKeySaved(false);
    setKeyDraft("");
    setKeyStatus("");
    setModel("");
    setModels([]);
    setModelsError("");
    void (async () => {
      const ok = await checkKey(provider);
      if (ok) await loadModels(provider);
    })();
  }, [provider]);

  async function checkKey(prov: string): Promise<boolean> {
    try {
      const ok = await invoke<boolean>("has_api_key", { provider: prov });
      setApiKeySaved(ok);
      return ok;
    } catch {
      setApiKeySaved(false);
      return false;
    }
  }

  async function loadModels(prov: string) {
    setModelsLoading(true);
    setModelsError("");
    try {
      const list = await invoke<string[]>("fetch_available_models", {
        provider: prov,
      });
      setModels(list);
      if (list.length) {
        setModel((prev) => (list.includes(prev) ? prev : list[0]));
      }
    } catch (e) {
      setModels([]);
      setModelsError(String(e));
    } finally {
      setModelsLoading(false);
    }
  }

  async function handleSaveKey() {
    if (!keyDraft.trim()) return;
    setKeySaving(true);
    setKeyStatus("");
    try {
      await invoke("set_api_key", { provider, key: keyDraft.trim() });
      setApiKeySaved(true);
      setKeyDraft("");
      setKeyStatus("Saved");
      await loadModels(provider);
    } catch (e) {
      setKeyStatus("Error: " + e);
    } finally {
      setKeySaving(false);
    }
  }

  async function handleClearKey() {
    try {
      await invoke("clear_api_key", { provider });
      setApiKeySaved(false);
      setKeyStatus("Cleared");
      setModels([]);
      setModelsError("");
      setModel("");
    } catch {
      /* ignore */
    }
  }

  function handleProviderChange(prov: string) {
    setProvider(prov);
    localStorage.setItem(LS_PROVIDER, prov);
  }

  function handleModelChange(m: string) {
    setModel(m);
    localStorage.setItem(LS_MODEL, m);
  }

  function togglePdf(id: number) {
    setSelectedPdfIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function buildContext(): Promise<string[]> {
    const ctx: string[] = [];
    if (attachNotes) {
      try {
        const notes = await fetchNotes();
        const picked = notes.filter((n) => n.content.trim()).slice(0, 15);
        if (picked.length) {
          ctx.push(
            picked
              .map((n) => `### ${n.title} [${n.category}]\n${n.content}`)
              .join("\n\n"),
          );
        }
      } catch {
        /* ignore */
      }
    }
    for (const id of selectedPdfIds) {
      const pdf = pdfs.find((p) => p.id === id);
      if (!pdf) continue;
      try {
        const data = await readPdf(pdf.file_path);
        const text = await extractPdfText(data, 18000);
        ctx.push(`[PDF: ${pdf.file_name}]\n${text}`);
      } catch (e) {
        ctx.push(`[PDF: ${pdf.file_name}]\n(extraction failed: ${e})`);
      }
    }
    return ctx;
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    const history: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setInput("");
    setSending(true);
    setPreparing(true);
    try {
      const context = await buildContext();
      setPreparing(false);
      const reply = await invoke<string>("chat_completion", {
        provider,
        model,
        messages: history,
        context,
      });
      setMessages([...history, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages([
        ...history,
        { role: "assistant", content: "Error: " + String(e) },
      ]);
    } finally {
      setSending(false);
      setPreparing(false);
    }
  }

  const prov = getProvider(provider);

  return (
    <div className="page ai-page">
      <header className="page-header">
        <p>Ask questions — attach your notes and PDFs as context</p>
      </header>

      <details className="ai-settings panel" open>
        <summary style={{ cursor: "pointer", fontWeight: 600, marginBottom: "0.7rem" }}>
          Chat Settings
        </summary>

        <div className="ai-settings-grid">
          <label>
            Provider
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Model
            <div className="ai-model-wrap">
              <ModelPicker
                value={model}
                models={models}
                loading={modelsLoading}
                error={modelsError}
                onPick={handleModelChange}
              />
              {modelsLoading && (
                <span className="ai-models-loading">Loading models…</span>
              )}
              {!modelsLoading && models.length > 0 && (
                <span className="ai-models-count">
                  {models.length} models loaded from {prov.name}
                </span>
              )}
              {!modelsLoading && modelsError && (
                <span className="ai-models-error">{modelsError}</span>
              )}
            </div>
          </label>
        </div>

        {prov.needsKey && (
          <div className="ai-key-row ai-key-row-flex">
            <label className="ai-key-label">
              API key
              <div className="ai-key-input-row">
                <input
                  type="password"
                  className="ai-key-input"
                  placeholder={`Paste your ${prov.name} API key here`}
                  value={keyDraft}
                  onChange={(e) => {
                    setKeyDraft(e.target.value);
                    setKeyStatus("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveKey();
                  }}
                  autoComplete="off"
                />
                <button
                  className="btn-primary btn-small"
                  onClick={handleSaveKey}
                  disabled={keySaving || !keyDraft.trim()}
                >
                  {keySaving ? "Saving…" : "Save key"}
                </button>
                {apiKeySaved && (
                  <button
                    className="btn-danger btn-small"
                    onClick={handleClearKey}
                  >
                    Clear
                  </button>
                )}
              </div>
            </label>
            <div className="ai-key-meta">
              <span className={`ai-key-status ${apiKeySaved ? "saved" : "missing"}`}>
                {apiKeySaved ? "Connected — key saved" : "No key saved yet"}
              </span>
              {keyStatus && (
                <span className="ai-key-msg">{keyStatus}</span>
              )}
              {prov.keyHint && (
                <span className="ai-key-hint">
                  No account leads here — {prov.keyHint} and paste it above.
                </span>
              )}
            </div>
          </div>
        )}

        <div className="ai-context-row">
          <label className="ai-toggle">
            <input
              type="checkbox"
              checked={attachNotes}
              onChange={(e) => setAttachNotes(e.target.checked)}
            />
            Attach saved notes ({">"}0 chars)
          </label>

          {pdfs.length > 0 && (
            <div className="ai-pdf-select">
              <span className="ai-pdf-label">Attach PDFs:</span>
              <div className="ai-pdf-chips">
                {pdfs.map((p) => (
                  <label
                    key={p.id}
                    className={`ai-pdf-chip ${selectedPdfIds.has(p.id) ? "selected" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPdfIds.has(p.id)}
                      onChange={() => togglePdf(p.id)}
                    />
                    <span className="ai-pdf-chip-name">{p.file_name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </details>

      <div className="ai-chat-area">
        {messages.length === 0 && (
          <div className="ai-chat-empty">
            Ask a question to get started. Attach your notes and PDFs in settings
            so the AI can reference them.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ai-${m.role}`}>
            <div className="ai-msg-role">
              {m.role === "assistant" ? "AI" : "You"}
            </div>
            <div className="ai-msg-text">{m.content}</div>
          </div>
        ))}
        {sending && (
          <div className="ai-msg ai-assistant">
            <div className="ai-msg-role">AI</div>
            <div className="ai-msg-text ai-thinking">
              {preparing ? "Preparing context…" : "Thinking…"}
            </div>
          </div>
        )}
      </div>

      <div className="ai-input-bar">
        <textarea
          className="ai-input"
          placeholder="Ask something…"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={sending}
        />
        <button
          className="btn-primary ai-send-btn"
          onClick={handleSend}
          disabled={sending || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
