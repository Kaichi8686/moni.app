import assert from "node:assert/strict";
import { assignShifts } from "@/lib/shift/assign";
import type { ShiftBoard, ShiftResponse } from "@/lib/shift/types";
import { cellKey } from "@/lib/shift/types";

const board: ShiftBoard = {
  id: "b1",
  code: "testcode",
  adminKey: "key",
  title: "テスト",
  note: "",
  days: [{ id: "d1", label: "1日目", date: "" }],
  slots: [
    { id: "s1", label: "午前" },
    { id: "s2", label: "午後" },
  ],
  roles: [
    { id: "r1", name: "受付", needed: 1 },
    { id: "r2", name: "販売", needed: 1 },
  ],
  createdAt: "",
  updatedAt: "",
  assignments: null,
};

const responses: ShiftResponse[] = [
  {
    id: "p1",
    boardId: "b1",
    name: "あ",
    prefs: {
      [cellKey("d1", "s1")]: "prefer",
      [cellKey("d1", "s2")]: "ng",
    },
    preferredRoleIds: ["r1"],
    note: "",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "p2",
    boardId: "b1",
    name: "い",
    prefs: {
      [cellKey("d1", "s1")]: "ok",
      [cellKey("d1", "s2")]: "prefer",
    },
    preferredRoleIds: ["r2"],
    note: "",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "p3",
    boardId: "b1",
    name: "う",
    prefs: {
      [cellKey("d1", "s1")]: "ok",
      [cellKey("d1", "s2")]: "ok",
    },
    preferredRoleIds: [],
    note: "",
    createdAt: "",
    updatedAt: "",
  },
];

const result = assignShifts(board, responses);

const morning = result.cells.filter((c) => c.slotId === "s1");
const afternoon = result.cells.filter((c) => c.slotId === "s2");

for (const cell of morning) {
  assert.equal(cell.people.some((p) => p.name === "あ" && p.pref === "ng"), false);
  assert.ok(cell.people.length <= 1);
}

// 「あ」は午後×なので午後に入っていない
assert.equal(
  afternoon.every((c) => c.people.every((p) => p.name !== "あ")),
  true,
);

// 同一時間帯に同じ人が二重に入っていない
for (const slotId of ["s1", "s2"]) {
  const names = result.cells
    .filter((c) => c.slotId === slotId)
    .flatMap((c) => c.people.map((p) => p.responseId));
  assert.equal(names.length, new Set(names).size);
}

console.log("assign.test.ts: ok");
