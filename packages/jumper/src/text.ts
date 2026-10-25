/**
 * The renderer has no DOM to measure text with, so widths are estimated from
 * an average glyph width. This keeps the output identical in Node and the browser.
 */
const GLYPH_RATIO = 0.56;

export function textWidth({ text, size }: { text: string; size: number }): number {
  return text.length * size * GLYPH_RATIO;
}

export function wrap({ text, width, size }: { text: string; width: number; size: number }): string[] {
  const perLine = Math.max(4, Math.floor(width / (size * GLYPH_RATIO)));
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line === "") {
        line = word;
      } else if (line.length + 1 + word.length <= perLine) {
        line += ` ${word}`;
      } else {
        lines.push(line);
        line = word;
      }
      while (line.length > perLine) {
        lines.push(`${line.slice(0, perLine - 1)}-`);
        line = line.slice(perLine - 1);
      }
    }
    lines.push(line);
  }
  return lines;
}

export function truncate({ text, width, size }: { text: string; width: number; size: number }): string {
  const perLine = Math.max(2, Math.floor(width / (size * GLYPH_RATIO)));
  return text.length <= perLine ? text : `${text.slice(0, perLine - 1)}…`;
}

export function escapeXml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
