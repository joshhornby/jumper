import { type BuildResult, build, type Diagnostic, type Fidelity, formatSource, positionAt } from "@jumper/lang";
import { examples } from "@jumper/lang/examples";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  cleanName,
  fileName,
  isBoardsKey,
  loadBoards,
  MAX_BOARDS,
  nameFromFile,
  type SavedBoard,
  uniqueName,
  updateBoards,
} from "./boards.ts";
import { Editor, type EditorHandle } from "./Editor.tsx";
import { Preview } from "./Preview.tsx";
import { loadSettings, MAX_SOURCE, readShareHash, saveSettings, shareHash } from "./state.ts";

type Ok = Extract<BuildResult, { ok: true }>;

const firstExample = examples[0];
const DEFAULT_SOURCE = firstExample?.source ?? '(board "Untitled")';

function plural({ count, word }: { count: number; word: string }): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

const SAVED_AT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function downloadFile({ name, type, text }: { name: string; type: string; text: string }): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
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
  const [boards, setBoards] = useState<SavedBoard[]>(loadBoards);
  const [boardId, setBoardId] = useState<string | null>(saved?.boardId ?? null);
  const importInput = useRef<HTMLInputElement>(null);
  const [story, setStory] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [fitSignal, setFitSignal] = useState(0);
  const editor = useRef<EditorHandle>(null);

  useEffect(() => {
    void readShareHash(window.location.hash).then((shared) => {
      if (shared === null) return;
      setSource(shared);
      setBoardId(null);
      setFitSignal((signal) => signal + 1);
      history.replaceState(null, "", window.location.pathname);
    });
  }, []);

  useEffect(() => {
    saveSettings({ source, fidelity, showNotes, showSource, showSide, boardId });
  }, [source, fidelity, showNotes, showSource, showSide, boardId]);

  // Another tab may save or delete a board. The storage event keeps this tab's list current.
  useEffect(() => {
    const listen = (event: StorageEvent): void => {
      if (isBoardsKey(event.key)) setBoards(loadBoards());
    };
    window.addEventListener("storage", listen);
    return () => window.removeEventListener("storage", listen);
  }, []);

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

  // A board deleted in another tab is no longer open, so its text becomes unsaved work.
  const openBoard = boards.find((board) => board.id === boardId) ?? null;
  const unsaved = openBoard === null ? !examples.some((example) => example.source === source) : openBoard.source !== source;
  const newestFirst = [...boards].sort((a, b) => b.updatedAt - a.updatedAt);

  const confirmDiscard = (): boolean => !unsaved || window.confirm("Your changes to this board are not saved. Discard them?");

  const openSource = ({ text, id }: { text: string; id: string | null }): void => {
    setSource(text);
    setBoardId(id);
    setStory(null);
    setFitSignal((signal) => signal + 1);
  };

  /** Applies a change to the saved boards. The change shows only if the browser stored it, so nothing looks saved that is not. */
  const commitBoards = ({ change, done }: { change: (list: SavedBoard[]) => SavedBoard[]; done: string }): boolean => {
    const { boards: next, stored } = updateBoards(change);
    if (!stored) {
      setToast("The browser could not save. Its storage may be full or blocked.");
      return false;
    }
    setBoards(next);
    setToast(done);
    return true;
  };

  const askName = ({ suggested, others }: { suggested: string; others: readonly SavedBoard[] }): string | null => {
    const answer = window.prompt("Name this board", uniqueName({ name: suggested, boards: others }));
    if (answer === null) return null;
    const name = cleanName(answer);
    if (name === null) setToast("A board needs a name.");
    return name === null ? null : uniqueName({ name, boards: others });
  };

  const saveAs = (text: string = source): void => {
    if (boards.length >= MAX_BOARDS) {
      setToast(`You have ${MAX_BOARDS} saved boards. Delete one to save another.`);
      return;
    }
    const name = askName({ suggested: shown?.board.title ?? "Untitled board", others: boards });
    if (name === null) return;
    const board: SavedBoard = { id: crypto.randomUUID(), name, source: text, updatedAt: Date.now() };
    if (commitBoards({ change: (list) => [...list, board], done: `Saved “${name}”.` })) setBoardId(board.id);
  };

  const save = (text: string = source): void => {
    if (openBoard === null) {
      saveAs(text);
      return;
    }
    const updatedAt = Date.now();
    commitBoards({
      change: (list) => list.map((board) => (board.id === openBoard.id ? { ...board, source: text, updatedAt } : board)),
      done: `Saved “${openBoard.name}”.`,
    });
  };

  const rename = (target: SavedBoard): void => {
    const name = askName({ suggested: target.name, others: boards.filter((board) => board.id !== target.id) });
    if (name === null || name === target.name) return;
    commitBoards({
      change: (list) => list.map((board) => (board.id === target.id ? { ...board, name } : board)),
      done: `Renamed to “${name}”.`,
    });
  };

  const remove = (target: SavedBoard): void => {
    if (!window.confirm(`Delete “${target.name}”? You cannot undo this.`)) return;
    // The editor keeps the text of an open board, so deleting it loses nothing on screen.
    if (commitBoards({ change: (list) => list.filter((board) => board.id !== target.id), done: `Deleted “${target.name}”.` })) {
      if (target.id === boardId) setBoardId(null);
    }
  };

  const openSaved = (board: SavedBoard): void => {
    if (board.id === boardId || !confirmDiscard()) return;
    openSource({ text: board.source, id: board.id });
  };

  const choose = (value: string): void => {
    const split = value.indexOf(":");
    const kind = value.slice(0, split);
    const id = value.slice(split + 1);
    if (kind === "board") {
      const board = boards.find((candidate) => candidate.id === id);
      if (board !== undefined) openSaved(board);
      return;
    }
    const example = examples.find((candidate) => candidate.id === id);
    if (example === undefined || !confirmDiscard()) return;
    openSource({ text: example.source, id: null });
  };

  const importFile = async (file: File): Promise<void> => {
    const text = file.size > MAX_SOURCE * 4 ? null : await file.text();
    if (text === null || text.length > MAX_SOURCE) {
      setToast("That file is too large for the playground.");
      return;
    }
    if (boards.length >= MAX_BOARDS) {
      setToast(`You have ${MAX_BOARDS} saved boards. Delete one to import another.`);
      return;
    }
    if (!confirmDiscard()) return;
    const board: SavedBoard = {
      id: crypto.randomUUID(),
      name: uniqueName({ name: nameFromFile(file.name), boards }),
      source: text,
      updatedAt: Date.now(),
    };
    if (commitBoards({ change: (list) => [...list, board], done: `Imported “${board.name}”.` })) openSource({ text, id: board.id });
  };

  const exportSource = (): void => {
    downloadFile({ name: fileName(openBoard?.name ?? shown?.board.title ?? "board"), type: "text/plain", text: source });
  };

  // An edited example no longer matches, so the select falls back to its placeholder.
  const selectedExample = examples.find((example) => example.source === source)?.id;
  const selected = openBoard !== null ? `board:${openBoard.id}` : selectedExample === undefined ? "" : `example:${selectedExample}`;

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

  // The editor applies the new text as one change, so one undo restores the old layout.
  const format = (text: string = source): void => {
    const formatted = formatSource(text);
    if (!formatted.ok) {
      setToast("Fix the syntax error first, then format.");
      return;
    }
    if (formatted.text === text) {
      setToast("Already formatted.");
      return;
    }
    setSource(formatted.text);
  };

  const share = async (): Promise<void> => {
    const hash = await shareHash(source);
    await copyText({ text: `${window.location.origin}${window.location.pathname}${hash}`, done: "Share link copied." });
  };

  const download = (): void => {
    if (shown === null) return;
    downloadFile({
      name: `${shown.board.title.replace(/[^\w-]+/g, "-").toLowerCase() || "board"}.svg`,
      type: "image/svg+xml",
      text: shown.svg,
    });
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
          <select value={selected} onChange={(event) => choose(event.target.value)} aria-label="Open an example or a saved board">
            <option value="" disabled>
              {unsaved ? "Unsaved board" : "Open…"}
            </option>
            {boards.length > 0 && (
              <optgroup label="My boards">
                {newestFirst.map((board) => (
                  <option key={board.id} value={`board:${board.id}`}>
                    {board.name}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Examples">
              {examples.map((example) => (
                <option key={example.id} value={`example:${example.id}`}>
                  {example.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <button
          type="button"
          className="button"
          onClick={() => save()}
          disabled={openBoard !== null && !unsaved}
          title={openBoard === null ? "Save as a new board (Ctrl+S)" : `Save “${openBoard.name}” (Ctrl+S)`}
        >
          {openBoard !== null && !unsaved ? "Saved" : "Save"}
        </button>
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
        <button type="button" className="button" onClick={() => format()} title="Format the source (Shift+Alt+F)">
          Format
        </button>
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
          <Editor
            ref={editor}
            value={source}
            onChange={setSource}
            onFormat={format}
            onSave={save}
            diagnostics={result.diagnostics}
            placeIds={placeIds}
          />
        </section>

        <section className="pane preview-pane" aria-label="Board">
          {errors.length > 0 && (
            <div className="banner" role="status">
              {shown === null ? "Fix the error to draw the board." : "Showing the last good board. Fix the error to update it."}
            </div>
          )}
          <Preview svg={shown?.svg ?? null} width={shown?.width ?? 0} height={shown?.height ?? 0} fitSignal={fitSignal} />
        </section>

        <aside className="pane side-pane" aria-label="Boards, stories and problems" hidden={!showSide}>
          <h2>My boards</h2>
          <div className="board-actions">
            <button type="button" className="button" onClick={() => saveAs()}>
              Save as new
            </button>
            <button type="button" className="button" onClick={() => importInput.current?.click()}>
              Import
            </button>
            <button type="button" className="button" onClick={exportSource}>
              Export
            </button>
            <input
              ref={importInput}
              type="file"
              accept=".jumper,.txt,text/plain"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                // Clear the input, so that choosing the same file again still fires a change.
                event.target.value = "";
                if (file !== undefined) void importFile(file);
              }}
            />
          </div>
          {boards.length === 0 ? (
            <p className="muted">Save a board to keep it here. Export it to keep a copy as a .jumper file.</p>
          ) : (
            <ul className="boards">
              {newestFirst.map((board) => (
                <li key={board.id}>
                  <button type="button" className="board-open" aria-pressed={board.id === boardId} onClick={() => openSaved(board)}>
                    <span className="story-title">{board.name}</span>
                    <span className={board.id === boardId && unsaved ? "story-meta gap" : "story-meta"}>
                      {board.id === boardId && unsaved ? "Unsaved changes" : `Saved ${SAVED_AT.format(board.updatedAt)}`}
                    </span>
                  </button>
                  <button type="button" className="button small" onClick={() => rename(board)} aria-label={`Rename ${board.name}`}>
                    Rename
                  </button>
                  <button type="button" className="button small" onClick={() => remove(board)} aria-label={`Delete ${board.name}`}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="muted note">Boards are kept in this browser only.</p>

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
                      {diagnostic.fix !== null && <span className="fix">{diagnostic.fix.message}</span>}
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
