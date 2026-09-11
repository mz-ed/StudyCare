import { loadPdf } from "./pdf";

export interface AiProvider {
  id: string;
  name: string;
  needsKey: boolean;
  keyHint?: string;
}

export const PROVIDERS: AiProvider[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    needsKey: true,
    keyHint: "get one at aistudio.google.com/apikey",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    needsKey: true,
    keyHint: "get one at console.anthropic.com/settings/keys",
  },
  {
    id: "openai",
    name: "OpenAI",
    needsKey: true,
    keyHint: "get one at platform.openai.com/api-keys",
  },
  {
    id: "openrouter",
    name: "OpenRouter (all models, one key)",
    needsKey: true,
    keyHint: "get one at openrouter.ai/keys",
  },
];

export function getProvider(id: string): AiProvider {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

const EXTRACT_MAX = 22_000;

export async function extractPdfText(
  data: Uint8Array,
  maxChars = EXTRACT_MAX,
): Promise<string> {
  const doc = await loadPdf(data);
  const pages: string[] = [];
  let totalLen = 0;
  const limit = Math.min(doc.numPages, 40);
  for (let i = 1; i <= limit && totalLen < maxChars; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it: any) => ("str" in it ? it.str : ""))
      .join(" ")
      .trim();
    if (!text) continue;
    const chunk = `[Page ${i}]\n${text}`;
    totalLen += chunk.length;
    pages.push(chunk);
  }
  await doc.loadingTask.destroy();
  const joined = pages.join("\n\n");
  if (joined.length > maxChars) return joined.slice(0, maxChars) + "\n\n[truncated]";
  return joined || "(no extractable text)";
}
