# From stories to tests

A story says how a person moves through the interface. `jumper scenarios` turns each story into data that a test generator can use. Jumper does not write the tests. It names places, affordances and expected places, and your code maps them to routes and selectors. So Jumper works with any test framework.

## Get the scenarios

```sh
jumper scenarios board.jumper > scenarios.json
```

```jumper scenarios
(board "Password reset"
  (screen :request "Reset password"
    (field "Email")
    (primary "Send link" -> :known))
  (decision :known "Is the email on an account?"
    (to :sent "yes")
    (to :sent "no"))
  (screen :sent "Check your email"
    (text "If the address has an account, a link is on its way.")))

(story "Asks for a link"
  (step :request "Types the email" :touch "Email")
  (step :known "Account found" :via "yes")
  (step :sent "Sees the same message either way"))
```

The [JSON output](json.md#scenarios) page describes every field.

## Map a scenario to a test

Each step has an `action` that moves the story on:

- When `actor` is `"user"`, a person uses the affordance. The test fills in the field or clicks the button whose text is `affordance`.
- When `actor` is `"system"`, the system takes the branch. The test sets up the condition, for example a stub that makes the account exist. It does not click anything.
- `expect` is the place the next step is on. The test asserts that the app is now there.

A sketch with Playwright:

```ts
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

type Scenario = {
  story: string;
  runnable: boolean;
  steps: { place: string; action: { actor: "user" | "system"; affordance: string } | null }[];
};

// Your mapping from place ids to routes. Jumper does not know your URLs.
const routes: Record<string, string> = { request: "/reset", sent: "/reset/sent" };

const scenarios: Scenario[] = JSON.parse(readFileSync("scenarios.json", "utf8"));

for (const scenario of scenarios.filter((item) => item.runnable)) {
  test(scenario.story, async ({ page }) => {
    for (const step of scenario.steps) {
      const route = routes[step.place];
      if (route !== undefined) await expect(page).toHaveURL(new RegExp(`${route}$`));
      if (step.action?.actor === "user") await page.getByRole("button", { name: step.action.affordance }).click();
    }
  });
}
```

## Runnable scenarios

A scenario has `"runnable": false` when a place or a hop is missing. A test would describe a move the board cannot make. Skip it, or fail the build, and fix the board first. `jumper check` lists the gaps.

## Keep tests in step with the board

When the board changes, run [`jumper diff`](cli.md#diff). Its `affected` list names the stories whose scenarios changed, so you know which tests to look at.
