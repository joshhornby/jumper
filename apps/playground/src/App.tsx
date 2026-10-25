import { type BuildResult, build, type Diagnostic, type Fidelity, positionAt } from "@jumper/lang";
import { examples } from "@jumper/lang/examples";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Editor, type EditorHandle } from "./Editor.tsx";
import { Preview } from "./Preview.tsx";
import { loadSettings, readShareHash, saveSettings, shareHash } from "./state.ts";

type Ok = Extract<BuildResult, { ok: true }>;

const firstExample = examples[0];
const DEFAULT_SOURCE = firstExample?.source ?? '(board "Untitled")';

function plural({ count, word }: { count: number; word: string }): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function PaneIcon({ side }: { side: "left" | "right" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="1.5" />
      <path d={side === "left" ? "M6 2.75v10.5" : "M10 2.75v10.5"} />
    </svg>
  );
}

export function App() {
  const saved = useMemo(loadSettings, []);
  const [source, setSource] = useState(saved?.source ?? DEFAULT_SOURCE);
  const [fidelity, setFidelity] = useState<Fidelity>(saved?.fidelity ?? "wireframe");
  const [showNotes, setShowNotes] = useState(saved?.showNotes ?? true);
  const [showSource, setShowSource] = useState(saved?.showSource ?? true);
  const [showSide, setShowSide] = useState(saved?.showSide ?? true);
  const [story, setStory] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [fitSignal, setFitSignal] = useState(0);
  const editor = useRef<EditorHandle>(null);

  useEffect(() => {
    void readShareHash(window.location.hash).then((shared) => {
      if (shared === null) return;
      setSource(shared);
      setFitSignal((signal) => signal + 1);
      history.replaceState(null, "", window.location.pathname);
    });
  }, []);

  useEffect(() => {
    saveSettings({ source, fidelity, showNotes, showSource, showSide });
  }, [source, fidelity, showNotes, showSource, showSide]);

  useEffect(() => {
    if (toast === null) return undefined;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const deferred = useDeferredValue(source);
  const result = useMemo(() => build({ source: deferred, fidelity, showNotes, story }), [deferred, fidelity, showNotes, story]);

  // Keep the last good board on screen while the source has a syntax error.
  const lastGood = useRef<Ok | null>(null);
  if (result.ok) lastGood.current = result;
  const shown = result.ok ? result : lastGood.current;

  const stories = shown?.board.stories ?? [];
  useEffect(() => {
    if (story !== null && story >= stories.length) setStory(null);
  }, [story, stories.length]);

  const placeIds = useMemo(() => shown?.board.places.map((place) => place.id) ?? [], [shown]);
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const gaps = result.diagnostics.filter((diagnostic) => diagnostic.severity === "gap");

  const loadExample = (id: string): void => {
    const example = examples.find((candidate) => candidate.id === id);
    if (example === undefined) return;
    setSource(example.source);
    setStory(null);
    setFitSignal((signal) => signal + 1);
  };

  // An edited example no longer matches, so the select falls back to its placeholder.
  const selectedExample = examples.find((example) => example.source === source)?.id ?? "";

  // The board gains or loses width, so fit it again.
  const togglePane = (setShow: (update: (shown: boolean) => boolean) => void): void => {
    setShow((shown) => !shown);
    setFitSignal((signal) => signal + 1);
  };

  const copyText = async ({ text, done }: { text: string; done: string }): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setToast(done);
    } catch {
      setToast("The browser blocked the clipboard.");
    }
  };

  const share = async (): Promise<void> => {
    const hash = await shareHash(source);
    await copyText({ text: `${window.location.origin}${window.location.pathname}${hash}`, done: "Share link copied." });
  };

  const download = (): void => {
    if (shown === null) return;
    const blob = new Blob([shown.svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${shown.board.title.replace(/[^\w-]+/g, "-").toLowerCase() || "board"}.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  // A story's gaps are the ones inside its source, so :touch and missing places count, not only missing hops.
  const pathFor = (index: number): { gaps: number; steps: number } => {
    const item = shown?.board.stories[index];
    if (shown === null || item === undefined) return { gaps: 0, steps: 0 };
    const inside = shown.diagnostics.filter(
      (diagnostic) => diagnostic.span.start >= item.span.start && diagnostic.span.end <= item.span.end,
    );
    return { gaps: inside.length, steps: item.steps.length };
  };

  return (
    <div className="app">
      <header className="toolbar">
        <button
          type="button"
          className="button icon"
          aria-pressed={showSource}
          aria-label="Show source"
          title="Show source"
          onClick={() => togglePane(setShowSource)}
        >
          <PaneIcon side="left" />
        </button>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ⌁
          </span>
          Jumper
        </div>
        <label className="field">
          <span className="sr-only">Example</span>
          <select value={selectedExample} onChange={(event) => loadExample(event.target.value)} aria-label="Load an example">
            <option value="" disabled>
              Load example…
            </option>
            {examples.map((example) => (
              <option key={example.id} value={example.id}>
                {example.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="segmented" aria-label="Fidelity">
          {(["wireframe", "breadboard"] as const).map((option) => (
            <button key={option} type="button" aria-pressed={fidelity === option} onClick={() => setFidelity(option)}>
              {option === "wireframe" ? "Wireframes" : "Breadboard"}
            </button>
          ))}
        </fieldset>
        <label className="switch">
          <input type="checkbox" checked={showNotes} onChange={(event) => setShowNotes(event.target.checked)} />
          Notes
        </label>
        <div className="spacer" />
        <button type="button" className="button" onClick={() => void share()}>
          Share
        </button>
        <button
          type="button"
          className="button"
          disabled={shown === null}
          onClick={() => shown && void copyText({ text: shown.svg, done: "SVG copied." })}
        >
          Copy SVG
        </button>
        <button type="button" className="button primary" disabled={shown === null} onClick={download}>
          Download
        </button>
        <button
          type="button"
          className="button icon"
          aria-pressed={showSide}
          aria-label="Show stories and problems"
          title="Show stories and problems"
          onClick={() => togglePane(setShowSide)}
        >
          <PaneIcon side="right" />
        </button>
      </header>

      <main className={`workspace${showSource ? "" : " no-source"}${showSide ? "" : " no-side"}`}>
        <section className="pane source-pane" aria-label="Source" hidden={!showSource}>
          <Editor ref={editor} value={source} onChange={setSource} diagnostics={result.diagnostics} placeIds={placeIds} />
        </section>

        <section className="pane preview-pane" aria-label="Board">
          {errors.length > 0 && (
            <div className="banner" role="status">
              {shown === null ? "Fix the error to draw the board." : "Showing the last good board. Fix the error to update it."}
            </div>
          )}
          <Preview svg={shown?.svg ?? null} width={shown?.width ?? 0} height={shown?.height ?? 0} fitSignal={fitSignal} />
        </section>

        <aside className="pane side-pane" aria-label="Stories and problems" hidden={!showSide}>
          <h2>Stories</h2>
          {stories.length === 0 ? (
            <p className="muted">Add a (story …) to walk a path through the board.</p>
          ) : (
            <ul className="stories">
              <li>
                <button type="button" aria-pressed={story === null} onClick={() => setStory(null)}>
                  <span className="story-title">Whole board</span>
                </button>
              </li>
              {stories.map((item, index) => {
                const { gaps: storyGaps, steps } = pathFor(index);
                return (
                  <li key={item.span.start}>
                    <button type="button" aria-pressed={story === index} onClick={() => setStory(index)}>
                      <span className="story-title">{item.title}</span>
                      <span className={storyGaps > 0 ? "story-meta gap" : "story-meta"}>
                        {plural({ count: steps, word: "step" })}
                        {storyGaps > 0 ? ` · ${plural({ count: storyGaps, word: "gap" })}` : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <h2>
            Problems <span className="count">{result.diagnostics.length}</span>
          </h2>
          {result.diagnostics.length === 0 ? (
            <p className="muted">No gaps. Every story follows a real wire.</p>
          ) : (
            <ul className="problems">
              {[...errors, ...gaps].map((diagnostic: Diagnostic) => {
                const { line, column } = positionAt({ source, offset: diagnostic.span.start });
                return (
                  <li key={`${diagnostic.severity}-${diagnostic.span.start}-${diagnostic.message}`}>
                    <button type="button" className={diagnostic.severity} onClick={() => editor.current?.reveal(diagnostic.span.start)}>
                      <span className="severity">{diagnostic.severity}</span>
                      <span className="message">{diagnostic.message}</span>
                      <span className="where">
                        {line}:{column}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <h2>Legend</h2>
          <dl className="legend">
            <dt>
              <span className="swatch story" />
            </dt>
            <dd>Story path. Dashed means Jumper inferred the wire.</dd>
            <dt>
              <span className="swatch gap" />
            </dt>
            <dd>Gap: a hop or wire with nothing behind it.</dd>
            <dt>
              <span className="swatch system" />
            </dt>
            <dd>System place: code the user does not see.</dd>
          </dl>
        </aside>
      </main>

      {toast !== null && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
