import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CopyObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

import { runPromoteScript } from "../scripts/promote.js";

class MockS3Client {
  public readonly sent: unknown[] = [];

  constructor(
    private readonly handler: (command: unknown) => Promise<unknown>,
  ) {}

  async send(command: unknown): Promise<unknown> {
    this.sent.push(command);
    return this.handler(command);
  }
}

const sourceObjects = [
  { Key: "puzzles/2024-01-01.json" },
  { Key: "puzzles/2024-01-02.json" },
];

describe("runPromoteScript", () => {
  it("copies missing puzzles and manifest.json", async () => {
    const client = new MockS3Client(async (command) => {
      if (command instanceof ListObjectsV2Command) {
        if (command.input.Bucket === "econn-content-dev") {
          return { Contents: sourceObjects };
        }
        return {
          Contents: [
            { Key: "puzzles/2024-01-01.json" },
            { Key: "puzzles/1999-12-31.json" },
          ],
        };
      }

      if (command instanceof CopyObjectCommand) {
        return {};
      }

      throw new Error("Unexpected command");
    });

    const result = await runPromoteScript({ s3Client: client });

    assert.equal(result.sourceBucket, "econn-content-dev");
    assert.equal(result.targetBucket, "econn-content-prod");
    assert.deepEqual(result.copied, ["puzzles/2024-01-02.json"]);
    assert.deepEqual(result.skipped, ["puzzles/2024-01-01.json"]);
    assert.deepEqual(result.remoteOnly, ["puzzles/1999-12-31.json"]);
    assert.equal(result.manifestCopied, true);
    assert.equal(result.dryRun, false);
    assert.equal(result.overwrite, false);

    const copyCommands = client.sent.filter(
      (command) => command instanceof CopyObjectCommand,
    );
    assert.equal(copyCommands.length, 2);
  });

  it("overwrites existing puzzles when requested", async () => {
    const client = new MockS3Client(async (command) => {
      if (command instanceof ListObjectsV2Command) {
        return { Contents: sourceObjects };
      }
      if (command instanceof CopyObjectCommand) {
        return {};
      }
      throw new Error("Unexpected command");
    });

    const result = await runPromoteScript({
      overwrite: true,
      s3Client: client,
    });

    assert.deepEqual(result.copied, [
      "puzzles/2024-01-01.json",
      "puzzles/2024-01-02.json",
    ]);
    assert.deepEqual(result.skipped, []);
    assert.equal(result.manifestCopied, true);

    const copyCommands = client.sent.filter(
      (command) => command instanceof CopyObjectCommand,
    );
    assert.equal(copyCommands.length, 3);
  });

  it("supports dry run mode", async () => {
    const client = new MockS3Client(async (command) => {
      if (command instanceof ListObjectsV2Command) {
        if (command.input.Bucket === "econn-content-dev") {
          return { Contents: sourceObjects };
        }
        return { Contents: [] };
      }

      if (command instanceof CopyObjectCommand) {
        throw new Error("CopyObject should not run in dry-run mode");
      }

      throw new Error("Unexpected command");
    });

    const result = await runPromoteScript({
      dryRun: true,
      s3Client: client,
    });

    assert.equal(result.dryRun, true);
    assert.equal(result.manifestCopied, false);
    assert.deepEqual(result.copied, [
      "puzzles/2024-01-01.json",
      "puzzles/2024-01-02.json",
    ]);
  });
});
