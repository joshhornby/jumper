import { z } from "zod";

export const MAX_SOURCE = 200_000;
const STORAGE_KEY = "jumper.playground.v1";

export const Settings = z.object({
  source: z.string().max(MAX_SOURCE),
  fidelity: z.enum(["wireframe", "breadboard"]).catch("wireframe"),
  showNotes: z.boolean().catch(true),
  showSource: z.boolean().catch(true),
  showSide: z.boolean().catch(true),
  /** The saved board open in the editor, or null for an example or unsaved work. */
  boardId: z.string().nullable().catch(null),
});

export type Settings = z.infer<typeof Settings>;

const Shared = z.object({ source: z.string().max(MAX_SOURCE) });

/** Saved state is per browser and may be stale or edited by hand, so it is parsed, not trusted. */
export function loadSettings(): Settings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = Settings.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be blocked or full. The playground still works without it.
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** Stops reading past `limit` bytes, so a crafted link cannot inflate into a huge payload. */
async function pipe({
  bytes,
  stream,
  limit,
}: {
  bytes: Uint8Array<ArrayBuffer>;
  stream: CompressionStream | DecompressionStream;
  limit: number;
}): Promise<Uint8Array> {
  const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new Error("Shared source is too large.");
    }
    chunks.push(value);
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

export async function shareHash(source: string): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify({ source }));
  const packed = await pipe({ bytes: json, stream: new CompressionStream("deflate-raw"), limit: Number.POSITIVE_INFINITY });
  return `#s=${toBase64Url(packed)}`;
}

/** A share link comes from anyone, so a bad one is ignored rather than shown. */
export async function readShareHash(hash: string): Promise<string | null> {
  const match = /^#s=([\w-]+)$/.exec(hash);
  const encoded = match?.[1];
  if (encoded === undefined) return null;
  try {
    const bytes = await pipe({ bytes: fromBase64Url(encoded), stream: new DecompressionStream("deflate-raw"), limit: MAX_SOURCE * 4 });
    const parsed = Shared.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
    return parsed.success ? parsed.data.source : null;
  } catch {
    return null;
  }
}
