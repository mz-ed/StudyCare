import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type PDFPageProxy } from "pdfjs-dist";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";
import { invoke } from "@tauri-apps/api/core";

GlobalWorkerOptions.workerPort = new PdfWorker();

export async function readPdf(path: string): Promise<Uint8Array> {
  const b64 = await invoke<string>("read_pdf", { path });
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function loadPdf(data: Uint8Array): Promise<PDFDocumentProxy> {
  return getDocument({ data }).promise;
}

export async function renderPageToCanvas(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  scale: number,
): Promise<void> {
  const dpr = window.devicePixelRatio || 1;
  const viewport = page.getViewport({ scale });
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  canvas.setAttribute("data-page", String(page.pageNumber));
  await page.render({
    canvas,
    viewport,
    transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
  }).promise;
}