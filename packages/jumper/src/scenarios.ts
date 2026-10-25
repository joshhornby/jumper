import type { Analysed } from "./check.ts";
import { isAffordance, type PlaceKind, type WidgetType } from "./model.ts";

/**
 * user: a person uses the affordance on a screen or slot.
 * system: a system place or decision takes the branch. A test stubs or checks it, it does not click it.
 */
export type Actor = "user" | "system";

export type ScenarioStep = {
  place: string;
  /** Null when the place does not exist. The scenario is then not runnable. */
  kind: PlaceKind | null;
  title: string | null;
  caption: string;
  /** The widget the step works with, such as the field the user fills in. */
  touch: { text: string; widget: WidgetType; interactive: boolean } | null;
  /** How the story moves to the next step. Null on the last step and on a hop with no wire. */
  action: { actor: Actor; affordance: string; wire: string; inferred: boolean } | null;
  /** The place the next step expects, or null on the last step. */
  expect: string | null;
};

export type Scenario = {
  story: string;
  /** False when a place or hop is missing, because a test would describe a move the board cannot make. */
  runnable: boolean;
  steps: ScenarioStep[];
};

/**
 * Turns each story into a scenario for a test generator. The scenario names places, affordances and
 * expected places only. A consumer maps them to routes and selectors, so the language stays free of any test framework.
 */
export function scenarios({ board, analysis }: Analysed): Scenario[] {
  const places = new Map(board.places.map((place) => [place.id, place]));
  return board.stories.map((story, storyIndex) => {
    const path = analysis.stories[storyIndex];
    let runnable = path !== undefined;
    const steps = story.steps.map((step, index): ScenarioStep => {
      const place = places.get(step.place);
      if (place === undefined) runnable = false;
      const highlight = path?.highlights[index] ?? null;
      const touched = step.touch === null || highlight === null ? undefined : place?.widgets[highlight];
      const hop = path?.hops[index];
      const next = story.steps[index + 1];
      if (next !== undefined && (hop === undefined || hop.kind === "missing")) runnable = false;
      const wire = hop === undefined || hop.kind === "missing" ? undefined : analysis.wires[hop.wire];
      return {
        place: step.place,
        kind: place?.kind ?? null,
        title: place?.title ?? null,
        caption: step.caption,
        touch:
          step.touch === null || touched === undefined
            ? null
            : { text: step.touch.text, widget: touched.type, interactive: isAffordance(touched) },
        action:
          wire === undefined || hop === undefined || hop.kind === "missing"
            ? null
            : {
                actor: place?.kind === "system" || place?.kind === "decision" ? "system" : "user",
                affordance: wire.affordance,
                wire: wire.key,
                inferred: hop.kind === "inferred",
              },
        expect: next?.place ?? null,
      };
    });
    return { story: story.title, runnable, steps };
  });
}
