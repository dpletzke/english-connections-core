import fs from "node:fs";
import path from "node:path";

import {
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type _Object,
} from "@aws-sdk/client-s3";
import type { ConnectionsPuzzle } from "@econcore/types";

import {
  runValidateScript,
  type ValidateScriptOptions,
} from "./validate.js";

const REGION = "sa-east-1";

const BUCKETS = {
  dev: "econ-content-dev",
  prod: "econ-content-prod",
} satisfies Record<UploadTarget, string>;

type UploadTarget = "dev" | "prod";

type PuzzleEntry = {
  filePath: string;
  key: string;
  date: string;
  contents: string;
};

type ManifestEntry = {
  date: string;
  path: string;
};

type ManifestFile = {
  generatedAt: string;
  latestPuzzle?: string;
  puzzles: ManifestEntry[];
};

type S3LikeClient = Pick<S3Client, "send">;

const toPuzzleEntry = (filePath: string): PuzzleEntry => {
  const contents = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(contents) as ConnectionsPuzzle;

  if (typeof parsed.date !== "string") {
    throw new Error(`Puzzle '${filePath}' is missing a valid date field.`);
  }

  return {
    filePath,
    key: `puzzles/${path.basename(filePath)}`,
    date: parsed.date,
    contents,
  };
};

const listRemoteKeys = async (
  client: S3LikeClient,
  bucket: string,
  prefix: string,
): Promise<Set<string>> => {
  const keys = new Set<string>();
  let continuationToken: string | undefined;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    (response.Contents ?? [])
      .map((_object) => _object.Key)
      .filter((key): key is NonNullable<_Object["Key"]> => Boolean(key))
      .forEach((key) => keys.add(key));

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return keys;
};

const buildManifest = (entries: PuzzleEntry[]): ManifestFile => {
  const puzzles = entries
    .map((entry) => ({ date: entry.date, path: entry.key }))
    .sort((lhs, rhs) => lhs.date.localeCompare(rhs.date));

  const manifest: ManifestFile = {
    generatedAt: new Date().toISOString(),
    puzzles,
  };

  const latest = puzzles.at(-1);
  if (latest) {
    manifest.latestPuzzle = latest.date;
  }

  return manifest;
};

export interface UploadScriptOptions extends ValidateScriptOptions {
  env?: UploadTarget;
  dryRun?: boolean;
  s3Client?: S3LikeClient;
}

export interface UploadScriptResult {
  bucket: string;
  total: number;
  uploaded: string[];
  skipped: string[];
  remoteOnly: string[];
  manifestUploaded: boolean;
  dryRun: boolean;
}

export const runUploadScript = async (
  options: UploadScriptOptions = {},
): Promise<UploadScriptResult> => {
  const target: UploadTarget = options.env ?? "dev";
  const bucket = BUCKETS[target];
  const dryRun = Boolean(options.dryRun);

  const validationResult = runValidateScript({ files: options.files });
  if (validationResult.issues.length > 0) {
    const first = validationResult.issues[0];
    const fieldLabel = first.field.trim().length > 0 ? first.field : "(root)";
    const summary = `${validationResult.issues.length} validation issue${validationResult.issues.length === 1 ? "" : "s"} detected. ${fieldLabel}: ${first.message}`;
    throw new Error(summary);
  }

  if (validationResult.filesChecked.length === 0) {
    return {
      bucket,
      total: 0,
      uploaded: [],
      skipped: [],
      remoteOnly: [],
      manifestUploaded: false,
      dryRun,
    };
  }

  const entries = validationResult.filesChecked.map(toPuzzleEntry);
  const localKeys = new Set(entries.map((entry) => entry.key));

  const client = options.s3Client ?? new S3Client({ region: REGION });
  const remoteKeys = await listRemoteKeys(client, bucket, "puzzles/");

  const missing = entries.filter((entry) => !remoteKeys.has(entry.key));
  const alreadyPresent = entries.filter((entry) => remoteKeys.has(entry.key));
  const remoteOnly = [...remoteKeys].filter((key) => !localKeys.has(key));

  const uploaded: string[] = [];
  const skipped = alreadyPresent.map((entry) => entry.key);

  if (!dryRun) {
    for (const entry of missing) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: entry.key,
          Body: entry.contents,
          ContentType: "application/json",
          CacheControl: "public, max-age=300",
        }),
      );
      uploaded.push(entry.key);
    }
  }

  const manifest = buildManifest(entries);
  const manifestBody = `${JSON.stringify(manifest, null, 2)}\n`;

  if (!dryRun) {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: "manifest.json",
        Body: manifestBody,
        ContentType: "application/json",
        CacheControl: "public, max-age=120",
      }),
    );
  }

  return {
    bucket,
    total: entries.length,
    uploaded: dryRun ? missing.map((entry) => entry.key) : uploaded,
    skipped,
    remoteOnly,
    manifestUploaded: !dryRun,
    dryRun,
  };
};
