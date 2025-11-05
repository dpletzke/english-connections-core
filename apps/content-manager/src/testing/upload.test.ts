import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

import { runUploadScript } from "../scripts/upload.js";

const VALID_PUZZLE = "apps/content-manager/src/puzzles/2024-01-01.json";

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

describe("runUploadScript", () => {
  it("uploads missing puzzles and the manifest", async () => {
    const client = new MockS3Client(async (command) => {
      if (command instanceof ListObjectsV2Command) {
        return { Contents: [] };
      }
      if (command instanceof PutObjectCommand) {
        return {};
      }
      throw new Error("Unexpected command");
    });

    const result = await runUploadScript({
      files: [VALID_PUZZLE],
      env: "dev",
      s3Client: client,
    });

    assert.equal(result.bucket, "econ-content-dev");
    assert.equal(result.total, 1);
    assert.deepEqual(result.uploaded, ["puzzles/2024-01-01.json"]);
    assert.equal(result.manifestUploaded, true);
    assert.equal(result.dryRun, false);
    assert.equal(client.sent.length, 3);
  });

  it("skips puzzles that already exist remotely", async () => {
    const client = new MockS3Client(async (command) => {
      if (command instanceof ListObjectsV2Command) {
        return {
          Contents: [
            { Key: "puzzles/2024-01-01.json" },
            { Key: "puzzles/1999-12-31.json" },
          ],
        };
      }
      if (command instanceof PutObjectCommand) {
        return {};
      }
      throw new Error("Unexpected command");
    });

    const result = await runUploadScript({
      files: [VALID_PUZZLE],
      env: "prod",
      s3Client: client,
    });

    assert.equal(result.bucket, "econ-content-prod");
    assert.equal(result.total, 1);
    assert.deepEqual(result.uploaded, []);
    assert.deepEqual(result.skipped, ["puzzles/2024-01-01.json"]);
    assert.deepEqual(result.remoteOnly, ["puzzles/1999-12-31.json"]);
    assert.equal(result.manifestUploaded, true);
    assert.equal(client.sent.length, 2);
  });

  it("supports dry run mode", async () => {
    const client = new MockS3Client(async (command) => {
      if (command instanceof ListObjectsV2Command) {
        return { Contents: [] };
      }
      if (command instanceof PutObjectCommand) {
        throw new Error("PutObject should not be invoked in dry-run mode");
      }
      throw new Error("Unexpected command");
    });

    const result = await runUploadScript({
      files: [VALID_PUZZLE],
      dryRun: true,
      s3Client: client,
    });

    assert.equal(result.dryRun, true);
    assert.equal(result.manifestUploaded, false);
    assert.deepEqual(result.uploaded, ["puzzles/2024-01-01.json"]);
    assert.equal(client.sent.length, 1);
  });
});
