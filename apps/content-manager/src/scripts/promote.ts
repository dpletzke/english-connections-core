import { CopyObjectCommand, S3Client } from "@aws-sdk/client-s3";

import {
  BUCKETS,
  MANIFEST_KEY,
  PUZZLE_PREFIX,
  REGION,
  type ContentEnv,
  type S3LikeClient,
  listRemoteKeys,
} from "./s3.js";

const encodeKeyForCopySource = (key: string): string =>
  key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const buildCopySource = (bucket: string, key: string): string =>
  `${bucket}/${encodeKeyForCopySource(key)}`;

export interface PromoteScriptOptions {
  source?: ContentEnv;
  target?: ContentEnv;
  dryRun?: boolean;
  overwrite?: boolean;
  s3Client?: S3LikeClient;
}

export interface PromoteScriptResult {
  sourceBucket: string;
  targetBucket: string;
  copied: string[];
  skipped: string[];
  remoteOnly: string[];
  manifestCopied: boolean;
  dryRun: boolean;
  overwrite: boolean;
}

export const runPromoteScript = async (
  options: PromoteScriptOptions = {},
): Promise<PromoteScriptResult> => {
  const sourceEnv: ContentEnv = options.source ?? "dev";
  const targetEnv: ContentEnv = options.target ?? "prod";

  if (sourceEnv === targetEnv) {
    throw new Error("Source and target environments must be different.");
  }

  const sourceBucket = BUCKETS[sourceEnv];
  const targetBucket = BUCKETS[targetEnv];
  const dryRun = Boolean(options.dryRun);
  const overwrite = Boolean(options.overwrite);

  const client = options.s3Client ?? new S3Client({ region: REGION });

  const [sourceKeys, targetKeys] = await Promise.all([
    listRemoteKeys(client, sourceBucket, PUZZLE_PREFIX),
    listRemoteKeys(client, targetBucket, PUZZLE_PREFIX),
  ]);

  if (sourceKeys.size === 0) {
    throw new Error(
      `No puzzles found in ${sourceBucket}. Upload to the source bucket first.`,
    );
  }

  const sourceList = [...sourceKeys].sort();
  const targetSet = new Set(targetKeys);

  const puzzlesToCopy = overwrite
    ? sourceList
    : sourceList.filter((key) => !targetSet.has(key));

  const skipped = overwrite
    ? []
    : sourceList.filter((key) => targetSet.has(key));

  const remoteOnly = [...targetSet]
    .filter((key) => !sourceKeys.has(key))
    .sort();

  const copied: string[] = [...puzzlesToCopy];

  if (!dryRun) {
    for (const key of puzzlesToCopy) {
      await client.send(
        new CopyObjectCommand({
          Bucket: targetBucket,
          Key: key,
          CopySource: buildCopySource(sourceBucket, key),
          MetadataDirective: "COPY",
        }),
      );
    }

    await client.send(
      new CopyObjectCommand({
        Bucket: targetBucket,
        Key: MANIFEST_KEY,
        CopySource: buildCopySource(sourceBucket, MANIFEST_KEY),
        MetadataDirective: "COPY",
      }),
    );
  }

  return {
    sourceBucket,
    targetBucket,
    copied,
    skipped,
    remoteOnly,
    manifestCopied: !dryRun,
    dryRun,
    overwrite,
  };
};
