import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { HighlightStyle, StreamLanguage, type StringStream } from "@codemirror/language";
import { tags } from "@lezer/highlight";

type State = { afterParen: boolean };

const FORMS = new Set([
  "board",
  "story",
  "step",
  "region",
  "screen",
  "place",
  "slot",
  "system",
  "decision",
  "title",
  "text",
  "info",
  "meta",
  "image",
  "field",
  "button",
  "primary",
  "link",
  "check",
  "post",
  "list",
  "divider",
  "columns",
  "col",
  "out",
  "to",
  "note",
  "question",
]);

export const jumperLanguage = StreamLanguage.define<State>({
  name: "jumper",
  startState: () => ({ afterParen: false }),
  token(stream: StringStream, state: State): string | null {
    if (stream.eatSpace()) return null;
    if (stream.match(";")) {
      stream.skipToEnd();
      return "comment";
    }
    if (stream.match('"')) {
      state.afterParen = false;
      let escaped = false;
      for (let char = stream.next(); char !== undefined; char = stream.next()) {
        if (char === '"' && !escaped) break;
        escaped = !escaped && char === "\\";
      }
      return "string";
    }
    if (stream.match("(")) {
      state.afterParen = true;
      return "paren";
    }
    if (stream.match(")")) {
      state.afterParen = false;
      return "paren";
    }
    if (stream.match("->")) {
      state.afterParen = false;
      return "operator";
    }
    const word = stream.match(/^[^\s()";]+/);
    const afterParen = state.afterParen;
    state.afterParen = false;
    if (Array.isArray(word)) {
      const text = word[0] ?? "";
      if (text.startsWith(":")) return text === ":via" || text === ":touch" ? "propertyName" : "atom";
      if (afterParen) return FORMS.has(text) ? "keyword" : "invalid";
      return "variableName";
    }
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: ";" } },
});

export const jumperHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--syntax-form)", fontWeight: "600" },
  { tag: tags.atom, color: "var(--syntax-id)" },
  { tag: tags.propertyName, color: "var(--syntax-key)" },
  { tag: tags.string, color: "var(--syntax-string)" },
  { tag: tags.comment, color: "var(--syntax-comment)", fontStyle: "italic" },
  { tag: tags.operator, color: "var(--syntax-arrow)", fontWeight: "700" },
  { tag: tags.paren, color: "var(--syntax-paren)" },
  { tag: tags.invalid, color: "var(--syntax-invalid)", textDecoration: "underline wavy" },
]);

const FORM_DOCS: Record<string, string> = {
  board: '(board "Title" …regions and places)',
  story: '(story "Title" (step …) …)',
  step: '(step :place "caption" :via "Affordance" :touch "Widget")',
  region: '(region "Title" "question" …places)',
  screen: '(screen :id "Title" …widgets)',
  slot: '(slot :id "Title") — or (slot "text") inside a screen',
  system: '(system :id "Title" (out "label" -> :id) …)',
  decision: '(decision :id "Question?" (to :id "condition") …)',
  title: '(title "text")',
  text: '(text "text")',
  meta: '(meta "small grey text")',
  image: '(image "alt text")',
  field: '(field "label")',
  button: '(button "label" -> :id)',
  primary: '(primary "label" -> :id)',
  link: '(link "label" -> :id)',
  check: '(check "label")',
  post: '(post "Author" "body")',
  list: '(list "item" "item" …)',
  divider: "(divider)",
  columns: '(columns (col "Title" "card" …) …)',
  col: '(col "Title" "card" …)',
  out: '(out "label" -> :id)',
  to: '(to :id "condition")',
  note: '(note "text")',
  question: '(question "open question")',
};

/** Completes form names after "(" and place ids after ":". Ids come from the last good compile. */
export function jumperCompletions(getIds: () => readonly string[]) {
  return (context: CompletionContext): CompletionResult | null => {
    const form = context.matchBefore(/\(\s*[\w-]*/);
    if (form !== null) {
      const start = form.from + form.text.search(/[\w-]|$/);
      return {
        from: start,
        options: Object.entries(FORM_DOCS).map(([label, detail]) => ({ label, detail, type: "keyword" })),
        validFor: /^[\w-]*$/,
      };
    }
    const id = context.matchBefore(/:[\w-]*/);
    if (id !== null) {
      return {
        from: id.from + 1,
        options: [
          ...getIds().map((label) => ({ label, type: "variable" })),
          { label: "via", type: "property", detail: "the affordance this step uses" },
          { label: "touch", type: "property", detail: "a widget to highlight" },
        ],
        validFor: /^[\w-]*$/,
      };
    }
    return null;
  };
}
