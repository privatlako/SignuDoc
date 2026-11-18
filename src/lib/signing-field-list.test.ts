import assert from "node:assert/strict";
import test from "node:test";

import {
  canHaveFieldName,
  fieldDisplayName,
  findNextOpenRow,
} from "./signing-field-list.ts";

test("only fields the signer fills with a value can be named", () => {
  for (const type of ["text", "number", "dropdown", "checkbox"]) {
    assert.equal(canHaveFieldName(type), true, type);
  }

  for (const type of ["signature", "initials", "date", "radio"]) {
    assert.equal(canHaveFieldName(type), false, type);
  }
});

test("a field is called by its own name, or else by its kind", () => {
  assert.equal(fieldDisplayName("Adószám", "Szövegmező"), "Adószám");
  assert.equal(fieldDisplayName("  Név ", "Szövegmező"), "Név");
  assert.equal(fieldDisplayName("   ", "Szövegmező"), "Szövegmező");
  assert.equal(fieldDisplayName(undefined, "Szám"), "Szám");
  assert.equal(fieldDisplayName(null, "Szám"), "Szám");
});

test("the next field is the next one not done, going round the list", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const done =
    (...ids: string[]) =>
    (row: { id: string }) =>
      ids.includes(row.id);

  // With nothing chosen yet: the first not done.
  assert.equal(findNextOpenRow(rows, null, done())?.id, "a");
  assert.equal(findNextOpenRow(rows, null, done("a", "b"))?.id, "c");
  // After this one, skipping what is done.
  assert.equal(findNextOpenRow(rows, "a", done())?.id, "b");
  assert.equal(findNextOpenRow(rows, "a", done("b", "c"))?.id, "d");
  // Round to the start for one that was skipped.
  assert.equal(findNextOpenRow(rows, "c", done("d"))?.id, "a");
  // Never the one the signer is leaving, even when it is not done.
  assert.equal(findNextOpenRow(rows, "b", done("a", "c", "d")), null);
  // Nothing left.
  assert.equal(findNextOpenRow(rows, "b", done("a", "b", "c", "d")), null);
  // A field no longer in the list counts as no field.
  assert.equal(findNextOpenRow(rows, "gone", done("a"))?.id, "b");
  assert.equal(findNextOpenRow([], null, done()), null);
});
