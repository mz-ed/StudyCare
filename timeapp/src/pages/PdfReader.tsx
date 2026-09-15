import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { fetchPdfNote, updatePdfMeta, upsertPdfNote } from "../lib/api";
import { loadPdf, readPdf, renderPageToCanvas } from "../lib/pdf";
import type { Pdf } from "../lib/types";

interface PdfReaderProps {
  pdf: Pdf;
  onBack: () => void;
}

export function PdfReader({ pdf, onBack }: PdfReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const scaleRef = useRef(1);
  const fitScaleRef = useRef(1);
  const noteDirtyRef = useRef(false);
  const pageInputFocusRef = useRef(false);
  const pageInputRef = useRef("1");
  const renderTimerRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rendering, setRendering] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [zoomPercent, setZoomPercent] = useState(100);
  const [notesOpen, setNotesOpen] = useState(true);
  const [noteText, setNoteText] = useState<string | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [focus, setFocus] = useState(false);

  useEffect(
    () => () => {
      delete document.documentElement.dataset.focus;
    },
    [],
  );

  function toggleFocus() {
    setFocus((f) => {
      const next = !f;
      if (next) {
        document.documentElement.dataset.focus = "1";
        setNotesOpen(false);
      } else {
        delete document.documentElement.dataset.focus;
      }
      return next;
    });
  }

  async function renderAll(scale: number) {
    const doc = docRef.current;
    const container = containerRef.current;
    if (!doc || !container) return;
    setRendering(true);
    container.replaceChildren();
    try {
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const canvas = document.createElement("canvas");
        container.appendChild(canvas);
        await renderPageToCanvas(page, canvas, scale);
      }
    } finally {
      setRendering(false);
    }
    updateCurrentPage();
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const bytes = await readPdf(pdf.file_path);
        const doc = await loadPdf(bytes);
        if (cancelled) {
          void doc.loadingTask.destroy();
          return;
        }
        docRef.current = doc;
        setPageCount(doc.numPages);
        pageInputRef.current = "1";
        setPageInput("1");
        const page = await doc.getPage(1);
        const baseW = page.getViewport({ scale: 1 }).width;
        const avail = (containerRef.current?.clientWidth ?? 800) - 24;
        const fit = Math.max(0.2, Math.min(2.5, avail / baseW));
        fitScaleRef.current = fit;
        scaleRef.current = fit;
        setZoomPercent(Math.round(fit * 100));
        await updatePdfMeta(pdf.id, doc.numPages);
        const note = await fetchPdfNote(pdf.id);
        if (cancelled) return;
        setNoteText(note?.content ?? "");
        noteDirtyRef.current = false;
        await renderAll(fit);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load PDF", err);
          setError("Failed to load this PDF. The file may be missing or unreadable.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      void docRef.current?.loadingTask.destroy();
      docRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf.id]);

  function updateCurrentPage() {
    const container = containerRef.current;
    if (!container || container.childElementCount === 0) return;
    const mid = container.scrollTop + container.clientHeight / 2;
    let cur = 1;
    for (const el of Array.from(container.children)) {
      const top = (el as HTMLElement).offsetTop;
      if (top <= mid) {
        cur = Number((el as HTMLCanvasElement).dataset.page);
      } else {
        break;
      }
    }
    setCurrentPage(cur);
    if (!pageInputFocusRef.current) {
      pageInputRef.current = String(cur);
      setPageInput(String(cur));
    }
  }

  function gotoPage(n: number) {
    const container = containerRef.current;
    if (!container) return;
    const idx = Math.min(Math.max(1, n), pageCount) - 1;
    const el = container.children[idx] as HTMLElement | undefined;
    if (el) container.scrollTo({ top: el.offsetTop });
  }

  function handleJump() {
    const n = parseInt(pageInput, 10);
    if (!Number.isNaN(n)) gotoPage(n);
  }

  function applyScaleImmediate(scale: number) {
    const next = Math.round(Math.max(25, Math.min(300, scale * 100))) / 100;
    scaleRef.current = next;
    setZoomPercent(Math.round(next * 100));
    window.clearTimeout(renderTimerRef.current);
    void renderAll(next);
  }

  function applyScaleDebounced(scale: number) {
    const next = Math.round(Math.max(25, Math.min(300, scale * 100))) / 100;
    scaleRef.current = next;
    setZoomPercent(Math.round(next * 100));
    window.clearTimeout(renderTimerRef.current);
    renderTimerRef.current = window.setTimeout(() => {
      void renderAll(next);
    }, 150);
  }

  function zoomBy(deltaPct: number) {
    applyScaleImmediate((scaleRef.current * 100 + deltaPct) / 100);
  }

  function zoomToFit() {
    applyScaleImmediate(fitScaleRef.current);
  }

  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandlerRef.current = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === "+" || e.key === "=")) {
      e.preventDefault();
      zoomBy(15);
    } else if (mod && (e.key === "-" || e.key === "_")) {
      e.preventDefault();
      zoomBy(-15);
    } else if (mod && e.key === "0") {
      e.preventDefault();
      zoomToFit();
    } else if (mod && e.key === "1") {
      e.preventDefault();
      applyScaleImmediate(1);
    } else if (!mod && (e.key === "+" || e.key === "=")) {
      zoomBy(15);
    } else if (!mod && (e.key === "-" || e.key === "_")) {
      zoomBy(-15);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandlerRef.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const flushNote = useCallback(async () => {
    if (noteText === null || !noteDirtyRef.current) return;
    try {
      await upsertPdfNote(pdf.id, noteText);
      noteDirtyRef.current = false;
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 1500);
    } catch (err) {
      console.error("Failed to save note", err);
    }
  }, [noteText, pdf.id]);

  useEffect(() => {
    if (noteText === null) return;
    if (!noteDirtyRef.current) return;
    const timer = window.setTimeout(() => {
      setNoteSaving(true);
      void upsertPdfNote(pdf.id, noteText)
        .then(() => {
          noteDirtyRef.current = false;
          setNoteSaved(true);
          setTimeout(() => setNoteSaved(false), 1500);
        })
        .catch((err) => console.error("Failed to save note", err))
        .finally(() => setNoteSaving(false));
    }, 800);
    return () => window.clearTimeout(timer);
  }, [noteText, pdf.id]);

  return (
    <section className="pdf-reader">
      <div className="pdf-toolbar">
        <button
          className="btn-secondary btn-small"
          onClick={() => {
            delete document.documentElement.dataset.focus;
            void flushNote().then(onBack);
          }}
        >
          ← Library
        </button>
        <span className="pdf-file-name" title={pdf.file_path}>
          {pdf.file_name}
        </span>
        <div className="pdf-toolbar-spacer" />
        <button
          className={`btn-secondary btn-small${focus ? " active" : ""}`}
          onClick={toggleFocus}
          title={focus ? "Exit focus mode (expand app)" : "Focus: expand PDF to fill screen"}
        >
          {focus ? "✕ Exit Focus" : "⛶ Expand"}
        </button>
        <div className="pdf-pager">
          <button
            className="icon-btn"
            onClick={() => gotoPage(currentPage - 1)}
            disabled={currentPage <= 1}
            title="Previous page"
          >
            ‹
          </button>
          <input
            className="pdf-page-input"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ""))}
            onFocus={() => (pageInputFocusRef.current = true)}
            onBlur={() => {
              pageInputFocusRef.current = false;
              handleJump();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleJump();
            }}
          />
          <span className="pdf-page-total">/ {pageCount}</span>
          <button
            className="icon-btn"
            onClick={() => gotoPage(currentPage + 1)}
            disabled={pageCount === 0 || currentPage >= pageCount}
            title="Next page"
          >
            ›
          </button>
        </div>
        <div className="pdf-zoom">
          <button className="icon-btn" onClick={() => zoomBy(-15)} title="Zoom out">
            −
          </button>
          <input
            type="range"
            className="pdf-zoom-slider"
            min={25}
            max={300}
            step={5}
            value={zoomPercent}
            onChange={(e) =>
              applyScaleDebounced(Number((e.target as HTMLInputElement).value) / 100)
            }
            title="Drag to adjust zoom"
          />
          <button className="zoom-label" onClick={zoomToFit} title="Fit width">
            {zoomPercent}%
          </button>
          <button className="icon-btn" onClick={() => zoomBy(15)} title="Zoom in">
            +
          </button>
        </div>
        <button
          className={`btn-secondary btn-small${notesOpen ? " active" : ""}`}
          onClick={() => setNotesOpen((o) => !o)}
        >
          {notesOpen ? "Hide Notes" : "Notes"}
        </button>
      </div>

      <div className="pdf-body">
        <div className="pdf-scroll" ref={containerRef} onScroll={updateCurrentPage} />
        {loading && (
          <div className="pdf-overlay">
            <p>Loading PDF…</p>
          </div>
        )}
        {error && (
          <div className="pdf-overlay">
            <p className="error-text">{error}</p>
            <button
              className="btn-secondary btn-small"
              onClick={() => {
                delete document.documentElement.dataset.focus;
                onBack();
              }}
            >
              Back to library
            </button>
          </div>
        )}
        {rendering && (
          <div className="pdf-overlay subtle">
            <p>Rendering…</p>
          </div>
        )}
        {notesOpen && (
          <aside className="pdf-notes-panel">
            <div className="pdf-notes-header">
              <h3>📝 Notes</h3>
              <button className="icon-btn" onClick={() => setNotesOpen(false)} title="Close notes">
                ✕
              </button>
            </div>
            <p className="pdf-notes-hint">
              Take notes while you read — saved automatically.
            </p>
            <textarea
              className="pdf-notes-textarea"
              placeholder="Write your notes here..."
              value={noteText ?? ""}
              onChange={(e) => {
                setNoteText(e.target.value);
                noteDirtyRef.current = true;
              }}
            />
            <div className="pdf-notes-status">
              {noteSaving ? (
                <span className="pdf-notes-status-muted">Saving…</span>
              ) : noteSaved ? (
                <span className="success-text">Saved ✓</span>
              ) : null}
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}
