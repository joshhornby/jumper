import type { Diagnostic, Span } from "./diagnostics.ts";
import type { Board, Column, Note, Place, PlaceKind, Region, Step, Story, Widget, WireRef } from "./model.ts";
import { type Expr, read } from "./reader.ts";

export type CompileResult = { board: Board | null; diagnostics: Diagnostic[] };

type ListExpr = Extract<Expr, { kind: "list" }>;

// Maps, not object literals, so that names such as `constructor` do not match inherited keys.
const PLACE_FORMS = new Map<string, PlaceKind>([
  ["screen", "screen"],
  ["place", "screen"],
  ["slot", "slot"],
  ["system", "system"],
  ["decision", "decision"],
]);

type TextWidgetType = Extract<
  Widget["type"],
  "title" | "text" | "meta" | "image" | "field" | "button" | "primary" | "link" | "check" | "slot" | "out"
>;

const TEXT_WIDGETS = new Map<string, TextWidgetType>([
  ["title", "title"],
  ["text", "text"],
  ["info", "text"],
  ["meta", "meta"],
  ["image", "image"],
  ["field", "field"],
  ["button", "button"],
  ["primary", "primary"],
  ["link", "link"],
  ["check", "check"],
  ["slot", "slot"],
  ["out", "out"],
]);

const ALLOWED: Record<PlaceKind, (type: Widget["type"]) => string | null> = {
  screen: (type) => (type === "out" || type === "to" ? branchHint(type) : null),
  slot: (type) => (type === "out" || type === "to" ? branchHint(type) : null),
  system: (type) => (type === "out" || type === "text" ? null : "A system place holds only (out …) and (text …)."),
  decision: (type) => (type === "to" ? null : 'A decision holds only (to :id "condition") branches.'),
};

function branchHint(type: "out" | "to"): string {
  return type === "out"
    ? "Use (out …) inside a system place. On a screen, wire a button or link instead."
    : "Use (to …) inside a decision. On a screen, wire a button or link instead.";
}

function headOf(list: ListExpr): string | null {
  const head = list.items[0];
  return head?.kind === "symbol" ? head.name : null;
}

export function compile(source: string): CompileResult {
  const { exprs, diagnostics } = read(source);
  if (diagnostics.length > 0) return { board: null, diagnostics };

  const errors: Diagnostic[] = [];
  const fail = ({ message, span }: { message: string; span: Span }): void => {
    errors.push({ severity: "error", message, span });
  };

  const expectList = (expr: Expr, context: string): ListExpr | null => {
    if (expr.kind === "list") return expr;
    fail({ message: `Expected a (form …) ${context}.`, span: expr.span });
    return null;
  };

  const expectString = ({ expr, what, form }: { expr: Expr | undefined; what: string; form: ListExpr }): string | null => {
    if (expr?.kind === "string") return expr.value;
    fail({ message: `Expected ${what} as a "string".`, span: expr?.span ?? form.span });
    return null;
  };

  const readWire = ({ rest, form }: { rest: Expr[]; form: ListExpr }): WireRef | null => {
    const [target, label, ...extra] = rest;
    if (target?.kind !== "keyword") {
      fail({ message: "Expected a :place-id after ->.", span: target?.span ?? form.span });
      return null;
    }
    if (label !== undefined && label.kind !== "string") {
      fail({ message: 'A wire label must be a "string".', span: label.span });
      return null;
    }
    const first = extra[0];
    if (first !== undefined) {
      fail({ message: "Unexpected value after the wire.", span: first.span });
    }
    return {
      target: target.name,
      label: label?.kind === "string" ? label.value : null,
      span: { start: target.span.start, end: (label ?? target).span.end },
    };
  };

  /** Splits `(name "a" "b" -> :target "label")` into strings before the arrow and the wire after it. */
  const splitArrow = (form: ListExpr): { args: Expr[]; wire: WireRef | null; ok: boolean } => {
    const items = form.items.slice(1);
    const arrow = items.findIndex((item) => item.kind === "symbol" && item.name === "->");
    if (arrow === -1) return { args: items, wire: null, ok: true };
    const wire = readWire({ rest: items.slice(arrow + 1), form });
    return { args: items.slice(0, arrow), wire, ok: wire !== null };
  };

  const stringsOf = ({ args, form, min, max }: { args: Expr[]; form: ListExpr; min: number; max: number }): string[] | null => {
    const name = headOf(form) ?? "form";
    const strings: string[] = [];
    for (const arg of args) {
      if (arg.kind !== "string") {
        fail({ message: `(${name} …) takes only "strings" here.`, span: arg.span });
        return null;
      }
      strings.push(arg.value);
    }
    if (strings.length < min || strings.length > max) {
      const count = min === max ? `${min}` : max === Number.POSITIVE_INFINITY ? `at least ${min}` : `${min} to ${max}`;
      fail({ message: `(${name} …) takes ${count} string${min === 1 && max === 1 ? "" : "s"}.`, span: form.span });
      return null;
    }
    return strings;
  };

  const readColumns = (form: ListExpr): Column[] | null => {
    const columns: Column[] = [];
    for (const item of form.items.slice(1)) {
      const col = expectList(item, "inside a board widget");
      if (col === null) return null;
      if (headOf(col) !== "col") {
        fail({ message: 'A board widget holds only (col "Title" "card" …) forms.', span: col.span });
        return null;
      }
      const strings = stringsOf({ args: col.items.slice(1), form: col, min: 1, max: Number.POSITIVE_INFINITY });
      if (strings === null) return null;
      const [title = "", ...items] = strings;
      columns.push({ title, items });
    }
    return columns;
  };

  const readWidget = (form: ListExpr): Widget | null => {
    const name = headOf(form);
    if (name === null) {
      fail({ message: 'A widget form starts with its name, such as (button "Save").', span: form.span });
      return null;
    }

    if (name === "to") {
      const [first, second, ...rest] = form.items.slice(1);
      if (first?.kind === "keyword") {
        if (second?.kind !== "string") {
          fail({ message: '(to :id "condition") needs a condition string.', span: second?.span ?? form.span });
          return null;
        }
        const extra = rest[0];
        if (extra !== undefined) fail({ message: "Unexpected value in (to …).", span: extra.span });
        return {
          type: "to",
          text: second.value,
          wire: { target: first.name, label: null, span: first.span },
          span: form.span,
        };
      }
      const { args, wire, ok } = splitArrow(form);
      if (!ok) return null;
      const strings = stringsOf({ args, form, min: 1, max: 1 });
      if (strings === null) return null;
      if (wire === null) {
        fail({ message: '(to …) needs a target: (to :id "condition").', span: form.span });
        return null;
      }
      return { type: "to", text: strings[0] ?? "", wire, span: form.span };
    }

    if (name === "board" || name === "columns") {
      const columns = readColumns(form);
      return columns === null ? null : { type: "columns", columns, wire: null, span: form.span };
    }

    const { args, wire, ok } = splitArrow(form);
    if (!ok) return null;

    if (name === "divider") {
      if (stringsOf({ args, form, min: 0, max: 0 }) === null) return null;
      return { type: "divider", wire, span: form.span };
    }
    if (name === "list") {
      const items = stringsOf({ args, form, min: 1, max: Number.POSITIVE_INFINITY });
      return items === null ? null : { type: "list", items, wire, span: form.span };
    }
    if (name === "post") {
      const strings = stringsOf({ args, form, min: 1, max: 2 });
      if (strings === null) return null;
      const [author, text] = strings.length === 2 ? strings : [null, strings[0]];
      return { type: "post", author: author ?? null, text: text ?? "", wire, span: form.span };
    }
    const type = TEXT_WIDGETS.get(name);
    if (type !== undefined) {
      const strings = stringsOf({ args, form, min: 1, max: 1 });
      if (strings === null) return null;
      if (type === "out" && wire === null) {
        fail({ message: '(out …) needs a target: (out "label" -> :id).', span: form.span });
        return null;
      }
      return { type, text: strings[0] ?? "", wire, span: form.span };
    }

    fail({ message: `Unknown widget (${name} …).`, span: form.items[0]?.span ?? form.span });
    return null;
  };

  const readNote = (form: ListExpr): Note | null => {
    const kind = headOf(form) === "question" ? "question" : "note";
    const strings = stringsOf({ args: form.items.slice(1), form, min: 1, max: 1 });
    return strings === null ? null : { kind, text: strings[0] ?? "", span: form.span };
  };

  const readPlace = ({ form, kind, region }: { form: ListExpr; kind: PlaceKind; region: number }): Place | null => {
    const [, idExpr, titleExpr, ...body] = form.items;
    if (idExpr?.kind !== "keyword") {
      fail({
        message: `(${headOf(form)} …) needs an id first, such as (${headOf(form)} :checkout "Checkout").`,
        span: idExpr?.span ?? form.span,
      });
      return null;
    }
    const title = expectString({ expr: titleExpr, what: "a title", form });
    if (title === null) return null;

    const place: Place = { kind, id: idExpr.name, title, region, widgets: [], notes: [], span: form.span };
    for (const item of body) {
      const child = expectList(item, `inside ${title}`);
      if (child === null) continue;
      const head = headOf(child);
      if (head === "note" || head === "question") {
        const note = readNote(child);
        if (note !== null) place.notes.push(note);
        continue;
      }
      const widget = readWidget(child);
      if (widget === null) continue;
      const problem = ALLOWED[kind](widget.type);
      if (problem !== null) {
        fail({ message: problem, span: child.span });
        continue;
      }
      place.widgets.push(widget);
    }
    return place;
  };

  const readStep = (form: ListExpr): Step | null => {
    const [, placeExpr, ...rest] = form.items;
    if (placeExpr?.kind !== "keyword") {
      fail({ message: '(step …) needs a place id first, such as (step :checkout "Pays").', span: placeExpr?.span ?? form.span });
      return null;
    }
    const step: Step = { place: placeExpr.name, caption: "", via: null, touch: null, span: form.span };
    let index = 0;
    if (rest[0]?.kind === "string") {
      step.caption = rest[0].value;
      index = 1;
    }
    while (index < rest.length) {
      const key = rest[index];
      const value = rest[index + 1];
      if (key?.kind !== "keyword" || (key.name !== "via" && key.name !== "touch")) {
        fail({ message: 'A step takes a caption, then :via "Affordance" and :touch "Widget".', span: key?.span ?? form.span });
        return null;
      }
      if (value?.kind !== "string") {
        fail({ message: `:${key.name} needs a "string".`, span: value?.span ?? key.span });
        return null;
      }
      step[key.name] = value.value;
      index += 2;
    }
    return step;
  };

  const readStory = (form: ListExpr): Story | null => {
    const title = expectString({ expr: form.items[1], what: "a story title", form });
    if (title === null) return null;
    const steps: Step[] = [];
    for (const item of form.items.slice(2)) {
      const child = expectList(item, "inside a story");
      if (child === null) continue;
      if (headOf(child) !== "step") {
        fail({ message: "A story holds only (step …) forms.", span: child.span });
        continue;
      }
      const step = readStep(child);
      if (step !== null) steps.push(step);
    }
    return { title, steps, span: form.span };
  };

  let board: Board | null = null;
  const stories: Story[] = [];
  const seen = new Map<string, Span>();

  const addPlace = ({ place, target }: { place: Place; target: Board }): void => {
    if (seen.has(place.id)) {
      fail({ message: `The id :${place.id} is used twice.`, span: place.span });
      return;
    }
    seen.set(place.id, place.span);
    target.places.push(place);
  };

  const readBoard = (form: ListExpr): Board | null => {
    const title = expectString({ expr: form.items[1], what: "a board title", form });
    if (title === null) return null;
    const result: Board = { title, regions: [], places: [], stories: [] };
    const loose: Region = { number: 0, title: "", question: null, placeIds: [], span: form.span };

    for (const item of form.items.slice(2)) {
      const child = expectList(item, "inside the board");
      if (child === null) continue;
      const head = headOf(child) ?? "";

      if (head === "region") {
        const regionTitle = expectString({ expr: child.items[1], what: "a region title", form: child });
        if (regionTitle === null) continue;
        let bodyStart = 2;
        let question: string | null = null;
        const maybeQuestion = child.items[2];
        if (maybeQuestion?.kind === "string") {
          question = maybeQuestion.value;
          bodyStart = 3;
        }
        const region: Region = {
          number: result.regions.length + 1,
          title: regionTitle,
          question,
          placeIds: [],
          span: child.span,
        };
        result.regions.push(region);
        for (const inner of child.items.slice(bodyStart)) {
          const placeForm = expectList(inner, "inside the region");
          if (placeForm === null) continue;
          const kind = PLACE_FORMS.get(headOf(placeForm) ?? "");
          if (kind === undefined) {
            fail({ message: "A region holds only screen, slot, system and decision forms.", span: placeForm.span });
            continue;
          }
          const place = readPlace({ form: placeForm, kind, region: region.number });
          if (place === null) continue;
          addPlace({ place, target: result });
          region.placeIds.push(place.id);
        }
        continue;
      }

      const kind = PLACE_FORMS.get(head);
      if (kind === undefined) {
        fail({
          message:
            head === "story"
              ? "Write (story …) after the board, not inside it."
              : `Unknown form (${head} …) in the board. Use region, screen, slot, system or decision.`,
          span: child.span,
        });
        continue;
      }
      const place = readPlace({ form: child, kind, region: 0 });
      if (place === null) continue;
      addPlace({ place, target: result });
      loose.placeIds.push(place.id);
    }
    if (loose.placeIds.length > 0) result.regions.unshift(loose);
    return result;
  };

  for (const expr of exprs) {
    const form = expectList(expr, "at the top level");
    if (form === null) continue;
    const head = headOf(form);
    if (head === "board") {
      if (board !== null) {
        fail({ message: "A file holds one board.", span: form.span });
        continue;
      }
      board = readBoard(form);
    } else if (head === "story") {
      const story = readStory(form);
      if (story !== null) stories.push(story);
    } else {
      fail({ message: `Unknown top-level form (${head ?? "…"} …). Use (board …) or (story …).`, span: form.span });
    }
  }

  if (board === null && errors.length === 0) {
    fail({ message: 'Add a (board "Title" …) form to draw something.', span: { start: 0, end: 0 } });
  }
  if (errors.length > 0 || board === null) return { board: null, diagnostics: errors };
  board.stories = stories;
  return { board, diagnostics: [] };
}
