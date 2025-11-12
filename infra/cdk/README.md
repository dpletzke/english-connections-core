# English Connections Infrastructure

This CDK workspace provisions the storage layer that backs the puzzle content CLI.

## Bucket Specification
- **Region:** `sa-east-1` (São Paulo) for both dev and prod stacks.
- **Names:** `econn-content-dev` and `econn-content-prod`.
- **Layout:** keep a single `manifest.json` object at the root; store individual puzzles under the `puzzles/` prefix.
- **Versioning:** enabled so older puzzle revisions remain available.
- **Lifecycle:** transition objects to the Standard-IA storage class after 30 days to lower costs while keeping fast retrieval.
- **Access policy:** allow public reads on the `puzzles/` prefix and `manifest.json` so `en-connect.dpletzke.dev` can fetch data directly; retain write access for project IAM principals only.
- **CORS:** wildcard origins may issue `GET`/`HEAD` requests, so any frontend (including localhost) can fetch objects with standard `fetch` calls.
- **Encryption:** rely on the default (no explicit SSE configuration).

## Frontend Consumption
1. Deploy the latest stack (`npm install && npm run build && npx cdk deploy`) using credentials that can create/update both buckets. The deploy output prints the bucket names you can copy into frontend env files.
2. Puzzle URLs follow the regional endpoint format: `https://<bucket>.s3.sa-east-1.amazonaws.com/manifest.json` and `https://<bucket>.s3.sa-east-1.amazonaws.com/puzzles/2024-01-01.json`.
3. From the browser, read the manifest and then individual puzzles:

```ts
const bucket =
  import.meta.env.MODE === "production"
    ? "econn-content-prod"
    : "econn-content-dev";
const baseUrl = `https://${bucket}.s3.sa-east-1.amazonaws.com`;

const manifest = await fetch(`${baseUrl}/manifest.json`, {
  cache: "no-cache",
}).then((response) => response.json());
```

> The CORS rule added to the stack takes care of the `Access-Control-Allow-Origin` header, so you do not need CloudFront or API Gateway for simple public reads.

## Useful commands
- `npm run build`   compile typescript to js
- `npm run watch`   watch for changes and compile
- `npm run test`    perform the jest unit tests
- `npx cdk deploy`  deploy this stack to your default AWS account/region
- `npx cdk diff`    compare deployed stack with current state
- `npx cdk synth`   emits the synthesized CloudFormation template
