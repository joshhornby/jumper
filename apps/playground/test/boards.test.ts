import { describe, expect, test } from "bun:test";
import { cleanName, fileName, MAX_BOARDS, nameFromFile, parseBoards, type SavedBoard, uniqueName } from "../src/boards.ts";

const board = (id: string, name = id): SavedBoard => ({ id, name, source: `(board "${name}")`, updatedAt: 1 });

describe("saved boards", () => {
  test("missing, broken or non-list storage gives no boards", () => {
    expect(parseBoards(null)).toEqual([]);
    expect(parseBoards("{not json")).toEqual([]);
    expect(parseBoards(JSON.stringify({ id: "a" }))).toEqual([]);
  });

  test("a bad entry is dropped and the good ones are kept", () => {
    const raw = JSON.stringify([board("a"), { id: "b", name: "", source: "", updatedAt: 1 }, "junk", board("c")]);
    expect(parseBoards(raw).map((item) => item.id)).toEqual(["a", "c"]);
  });

  test("a repeated id keeps the first board", () => {
    expect(parseBoards(JSON.stringify([board("a", "First"), board("a", "Second")])).map((item) => item.name)).toEqual(["First"]);
  });

  test("the list is capped", () => {
    const many = Array.from({ length: MAX_BOARDS + 5 }, (_, index) => board(`id-${index}`));
    expect(parseBoards(JSON.stringify(many))).toHaveLength(MAX_BOARDS);
  });

  test("names are trimmed, and an empty name is refused", () => {
    expect(cleanName("  Real   checkout  ")).toBe("Real checkout");
    expect(cleanName("   ")).toBeNull();
  });

  test("a taken name gets the next free number", () => {
    const boards = [board("a", "Checkout"), board("b", "Checkout (2)")];
    expect(uniqueName({ name: "Checkout", boards })).toBe("Checkout (3)");
    expect(uniqueName({ name: "Refunds", boards })).toBe("Refunds");
  });

  test("exported and imported file names", () => {
    expect(fileName("Invoice autopay: v2")).toBe("invoice-autopay-v2.jumper");
    expect(fileName("!!!")).toBe("board.jumper");
    expect(nameFromFile("refund-flow.jumper")).toBe("refund-flow");
    expect(nameFromFile(".jumper")).toBe("Imported board");
  });
});
