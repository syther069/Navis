import assert from "node:assert/strict";
import test from "node:test";

test("release protection rejects a failed test", () => {
  assert.equal("failing candidate", "approved release");
});
