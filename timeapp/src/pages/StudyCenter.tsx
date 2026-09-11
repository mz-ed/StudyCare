import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { addPdf, deletePdf, fetchPdfs } from "../lib/api";
import type { Pdf } from "../lib/types";
import { Notes } from "./Notes";
import { PdfReader } from "./PdfReader";

type StudyTab = "notes" | "pdfs";

export function StudyCenter() {
  const [tab, setTab] = useState<StudyTab>("notes");

  return (
    <div className={`page ${tab === "pdfs" ? "page-wide" : ""}`}>
      <header className="page-header">
        <h2>Study Center</h2>
        <p>Your notes and PDF study material in one place</p>
      </header>
      <div className="study-tabs">
        <button
          className={`study-tab ${tab === "notes" ? "active" : ""}`}
          onClick={() => setTab("notes")}
        >
          📝 Notes
        </button>
        <button
          className={`study-tab ${tab === "pdfs" ? "active" : ""}`}
          onClick={() => setTab("pdfs")}
        >
          📄 PDF Library
        </button>
      </div>
      {tab === "notes" ? <Notes embedded /> : <PdfLibrary />}
    </div>
  );
}

function PdfLibrary() {
  const [pdfs, setPdfs] = useState<Pdf[]>([]);
  const [openPdf, setOpenPdf] = useState<Pdf | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadPdfs();
  }, []);

  async function loadPdfs() {
    try {
      setPdfs(await fetchPdfs());
    } catch (err) {
      console.error("Failed to load PDFs", err);
      setError("Failed to load your PDF library.");
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    setError("");
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (typeof selected !== "string") return;
      const fileName = selected.split(/[\\/]/).pop() ?? selected;
      const existing = pdfs.find((p) => p.file_path === selected);
      let record = existing ?? (await addPdf(fileName, selected));
      if (record) {
        setPdfs(await fetchPdfs());
        setOpenPdf(record);
      }
    } catch (err) {
      console.error("Failed to import PDF", err);
      setError("Failed to import that PDF.");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Remove this PDF from your library?")) return;
    try {
      await deletePdf(id);
      if (openPdf?.id === id) setOpenPdf(null);
      setPdfs(await fetchPdfs());
    } catch (err) {
      console.error("Failed to remove PDF", err);
      setError("Failed to remove that PDF.");
    }
  }

  if (openPdf) {
    return <PdfReader pdf={openPdf} onBack={() => setOpenPdf(null)} />;
  }

  function dateLabel(iso: string): string {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <div className="pdf-library">
      <div className="pdf-library-top">
        <button className="btn-primary" onClick={handleImport}>
          ⇪ Import PDF
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p className="empty-state">Loading…</p>
      ) : pdfs.length === 0 ? (
        <p className="empty-state">
          No PDFs yet. Click "Import PDF" to add your first study document.
        </p>
      ) : (
        <div className="pdf-grid">
          {pdfs.map((pdf) => (
            <div className="pdf-card" key={pdf.id} onClick={() => setOpenPdf(pdf)}>
              <div className="pdf-card-icon">📄</div>
              <div className="pdf-card-info">
                <h3>{pdf.file_name}</h3>
                <p>
                  {pdf.page_count ?? "–"} pages · added {dateLabel(pdf.added_at)}
                </p>
              </div>
              <div className="pdf-card-actions">
                <button
                  className="btn-secondary btn-small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenPdf(pdf);
                  }}
                >
                  Open
                </button>
                <button
                  className="btn-danger btn-small"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDelete(pdf.id);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}