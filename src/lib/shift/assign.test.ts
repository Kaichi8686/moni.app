import assert from "node:assert/strict";
import { assignShifts } from "@/lib/shift/assign";
import type { ShiftBoard, ShiftResponse } from "@/lib/shift/types";
import { cellKey, DEFAULT_SCHEDULE } from "@/lib/shift/types";

const board: ShiftBoard = {
  id: "b1",
  code: "testcode",
  adminKey: "key",
  title: "テスト",
  note: "",
  days: [{ id: "d1", label: "1日目", date: "" }],
  slots: [
    { id: "s1", label: "09:00-10:00", start: "09:00", end: "10:00" },
    { id: "s2", label: "10:00-11:00", start: "10:00", end: "11:00" },
    { id: "b1", label: "昼休み", start: "12:00", end: "13:00", isBreak: true },
    { id: "s3", label: "13:00-14:00", start: "13:00", end: "14:00" },
  ],
  roles: [
    { id: "r1", name: "受付", needed: 1 },
    { id: "r2", name: "販売", needed: 1 },
  ],
  schedule: { ...DEFAULT_SCHEDULE, maxConsecutive: 1, breaks: [], buddyPairs: [] },
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
      [cellKey("d1", "s2")]: "ok",
      [cellKey("d1", "s3")]: "ng",
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
      [cellKey("d1", "s3")]: "prefer",
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
      [cellKey("d1", "s3")]: "ok",
    },
    preferredRoleIds: [],
    note: "",
    createdAt: "",
    updatedAt: "",
  },
];

const result = assignShifts(board, responses);

// 休み時間に割当がない
assert.equal(
  result.cells.every((c) => c.slotId !== "b1"),
  true,
);

// NG の人は入っていない
assert.equal(
  result.cells
    .filter((c) => c.slotId === "s3")
    .every((c) => c.people.every((p) => p.name !== "あ")),
  true,
);

// 同一時間帯に同じ人が二重に入っていない
for (const slotId of ["s1", "s2", "s3"]) {
  const names = result.cells
    .filter((c) => c.slotId === slotId)
    .flatMap((c) => c.people.map((p) => p.responseId));
  assert.equal(names.length, new Set(names).size);
}

console.log("assign.test.ts: ok");
