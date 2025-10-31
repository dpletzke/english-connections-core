import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";

import { runValidateScript } from "../scripts/validate.js";

const BROKEN_FIXTURE =
  "apps/content-manager/src/testing/puzzles/2024-01-01_broken.json";

describe("runValidateScript", () => {
  it("passes on production puzzles by default", () => {
    const result = runValidateScript();

    assert.ok(
      result.filesChecked.length > 0,
      "Expected at least one puzzle to be validated",
    );
    assert.equal(
      result.issues.length,
      0,
      `Expected no issues, found ${result.issues.length}`,
    );
  });

  it("flags the known broken fixture when requested explicitly", () => {
    const result = runValidateScript({ files: [BROKEN_FIXTURE] });

    assert.equal(
      result.filesChecked.length,
      1,
      "Expected only the explicit fixture to be validated",
    );
    assert.equal(
      path.normalize(result.filesChecked[0]).endsWith(
        path.normalize(BROKEN_FIXTURE),
      ),
      true,
      "Validated file should match the broken fixture",
    );
    assert.ok(
      result.issues.length > 0,
      "Expected issues to be reported for the broken fixture",
    );
    assert.ok(
      result.issues.some((issue) => issue.field === "date"),
      "Expected at least one date-related issue",
    );
  });
});
