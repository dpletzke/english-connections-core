import {
  ListObjectsV2Command,
  S3Client,
  type _Object,
} from "@aws-sdk/client-s3";

export const REGION = "sa-east-1";

export const BUCKETS = {
  dev: "econn-content-dev",
  prod: "econn-content-prod",
} as const;

export const PUZZLE_PREFIX = "puzzles/";
export const MANIFEST_KEY = "manifest.json";

export type ContentEnv = keyof typeof BUCKETS;

export type S3LikeClient = Pick<S3Client, "send">;

export const listRemoteKeys = async (
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
