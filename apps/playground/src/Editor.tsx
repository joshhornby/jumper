import { autocompletion } from "@codemirror/autocomplete";
import { syntaxHighlighting } from "@codemirror/language";
import { type Diagnostic as LintDiagnostic, lintGutter, setDiagnostics } from "@codemirror/lint";
import { EditorState, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import type { Diagnostic } from "@jumper/lang";
import { basicSetup } from "codemirror";
import { useEffect, useImperativeHandle, useRef } from "react";
import { jumperCompletions, jumperHighlight, jumperLanguage } from "./jumper-language.ts";

export type EditorHandle = { reveal: (offset: number) => void };

type EditorProps = {
  value: string;
  onChange: (value: string) => void;
  /** Receives the editor's text, which can be ahead of `value` straight after a key press. */
  onFormat: (text: string) => void;
  diagnostics: readonly Diagnostic[];
  placeIds: readonly string[];
  ref: React.Ref<EditorHandle>;
};

const theme = EditorView.theme({
  "&": { height: "100%", fontSize: "13px", backgroundColor: "var(--editor-bg)", color: "var(--text)" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.6" },
  ".cm-gutters": { backgroundColor: "var(--editor-bg)", color: "var(--text-faint)", border: "none" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "var(--editor-active)" },
  ".cm-cursor": { borderLeftColor: "var(--text)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": { backgroundColor: "var(--editor-selection) !important" },
  ".cm-tooltip": { backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" },
});

export function Editor({ value, onChange, onFormat, diagnostics, placeIds, ref }: EditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const latest = useRef({ onChange, onFormat, placeIds });
  latest.current = { onChange, onFormat, placeIds };

  // biome-ignore lint/correctness/useExhaustiveDependencies: the view is created once. The next effect syncs later changes to `value`.
  useEffect(() => {
    if (host.current === null) return undefined;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          Prec.high(
            keymap.of([
              {
                key: "Shift-Alt-f",
                run: (target) => {
                  latest.current.onFormat(target.state.doc.toString());
                  return true;
                },
              },
            ]),
          ),
          basicSetup,
          jumperLanguage,
          syntaxHighlighting(jumperHighlight),
          autocompletion({ override: [jumperCompletions(() => latest.current.placeIds)] }),
          lintGutter(),
          theme,
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) latest.current.onChange(update.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
  }, []);

  useEffect(() => {
    const editor = view.current;
    if (editor === null) return;
    const current = editor.state.doc.toString();
    if (current !== value) editor.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  useEffect(() => {
    const editor = view.current;
    if (editor === null) return;
    const length = editor.state.doc.length;
    const marks: LintDiagnostic[] = diagnostics.map((diagnostic) => {
      const from = Math.min(diagnostic.span.start, length);
      const edit = diagnostic.fix?.edit ?? null;
      return {
        from,
        to: Math.max(from, Math.min(diagnostic.span.end, length)),
        severity: diagnostic.severity === "error" ? "error" : "warning",
        message: diagnostic.fix === null ? diagnostic.message : `${diagnostic.message} ${diagnostic.fix.message}`,
        actions:
          edit === null
            ? []
            : [
                {
                  name: "Fix",
                  // The source may have changed since the diagnostic was made, so the edit is clamped to the document.
                  apply: (target: EditorView) => {
                    const size = target.state.doc.length;
                    const start = Math.min(edit.span.start, size);
                    target.dispatch({ changes: { from: start, to: Math.max(start, Math.min(edit.span.end, size)), insert: edit.text } });
                  },
                },
              ],
      };
    });
    editor.dispatch(setDiagnostics(editor.state, marks));
  }, [diagnostics]);

  useImperativeHandle(ref, () => ({
    reveal(offset: number) {
      const editor = view.current;
      if (editor === null) return;
      const anchor = Math.min(offset, editor.state.doc.length);
      editor.dispatch({ selection: { anchor }, effects: EditorView.scrollIntoView(anchor, { y: "center" }) });
      editor.focus();
    },
  }));

  return <div className="editor" ref={host} />;
}
