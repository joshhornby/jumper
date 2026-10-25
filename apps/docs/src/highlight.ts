export function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const STEP_KEYS = new Set([":via", ":touch"]);

// An unclosed string runs to the end of the source, so a broken example still highlights.
const TOKEN = /(;[^\n]*)|("(?:[^"\\]|\\.)*"?)|([()])|([^\s()";]+)|(\s+)/y;

/** Uses the same token classes as the playground editor, so a board looks the same in both. */
export function highlightJumper(source: string): string {
  let html = "";
  let afterParen = false;
  TOKEN.lastIndex = 0;
  for (let match = TOKEN.exec(source); match !== null; match = TOKEN.exec(source)) {
    const [text, comment, string, paren, atom] = match;
    const span = (kind: string): string => `<span class="tok-${kind}">${escapeHtml(text)}</span>`;
    if (comment !== undefined) html += span("comment");
    else if (string !== undefined) html += span("string");
    else if (paren !== undefined) html += span("paren");
    else if (atom === undefined) html += text;
    else if (atom === "->") html += span("arrow");
    else if (atom.startsWith(":")) html += span(STEP_KEYS.has(atom) ? "key" : "id");
    else if (afterParen) html += span("form");
    else html += escapeHtml(text);
    if (match[5] === undefined) afterParen = paren === "(";
    if (TOKEN.lastIndex >= source.length) break;
  }
  return html;
}
