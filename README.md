# English Connections Core Backend

Monorepo backing the English Learning Connections puzzles. Content stays in version control, a CLI validates each puzzle JSON before upload, and AWS CDK manages the S3 buckets that host published content.

## Prerequisites
- Node.js 18+ (currently using v23.8.0 locally)
- pnpm ≥8 (currently using v10.20.0 via Homebrew)

## Getting Started
```bash
pnpm install          # hydrate workspace and link packages
pnpm -r build         # compile workspaces once CLI code exists
pnpm test             # reserved for validator/unit tests
```

## Workspace Layout (current)
- `package.json` – root scripts and shared dev dependencies (`tsc`, `eslint`, etc.).
- `pnpm-workspace.yaml` – tracks `apps/*`, `packages/*`, and `infra/*` as workspaces.
- `tsconfig.base.json` – Node16-style ESM config shared across packages.

### apps/
- `content-manager/` – CLI workspace. Provides `validate`, `upload`, and `promote` commands: the validator blocks malformed puzzles locally, the uploader syncs new puzzles plus `manifest.json` to a chosen bucket, and the promoter copies the latest dev bucket state into prod. Copy `.example.env` to `.env` to set your AWS profile or tweak default CLI flags.
- `server/` – placeholder backend workspace with minimal config, ready for future REST API work.

### packages/
- `types/` – publishes the canonical `ConnectionsPuzzle` TypeScript definitions (`@econncore/types`). Currently type-only; emits declarations once the build script runs.

### infra/
- `cdk/` – TypeScript CDK app (generated via `cdk init`). Update the stack to provision the dedicated dev/prod S3 buckets once bucket naming/lifecycle decisions are finalized.

#### S3 Buckets (planned configuration)
- Region: `sa-east-1` (São Paulo) shared across dev and prod.
- Bucket names: `econn-content-dev` and `econn-content-prod`.
- Structure: `manifest.json` at the root plus all puzzle JSONs under `puzzles/`.
- Versioning stays enabled so historical uploads are retained.
- Lifecycle: transition objects to Standard-IA storage after 30 days; Glacier stays unused.
- Access: objects in `puzzles/` plus `manifest.json` are world-readable so `en-connect.dpletzke.dev` can fetch content directly; writes remain IAM-restricted.

### Dev → Prod promotion
Once puzzles are validated and uploaded to the dev bucket, run the promote command to mirror S3 state into prod without re-reading local files:

```bash
pnpm --filter @econncore/content-manager run promote \
  --source dev \
  --target prod
```

- Add `--dry-run` to preview which puzzle keys would be copied and verify manifest changes.
- Source defaults to `dev` and target to `prod`, so you can omit the flags unless you are testing alternative flows.
- Pass `--overwrite` if you need to force-copy puzzles that already exist in prod (versioning will keep older revisions).
- The command always rewrites `manifest.json` in the target bucket so the frontend stays aligned with the latest dev manifest.

Promotion uses intra-S3 `CopyObject` calls, so it only requires bucket-level read/write permissions—no temporary files are written locally.

### puzzles/
- Located under `apps/content-manager/src/puzzles/`. One JSON per puzzle (e.g., `2024-01-01.json`) keeps history clean. A broken sample exists for validator testing.

#### `manifest.json` format
The uploader (`apps/content-manager/src/scripts/upload.ts`) regenerates `manifest.json` on every publish so S3 stays authoritative. The document is a simple index of puzzles:

```json
{
  "generatedAt": "2024-10-15T12:34:56.000Z",
  "latestPuzzle": "2024-01-01",
  "puzzles": [
    {
      "date": "2024-01-01",
      "path": "puzzles/2024-01-01.json"
    }
  ]
}
```

- `generatedAt` – ISO8601 timestamp representing when the CLI built the manifest.
- `latestPuzzle` – optional convenience field containing the final entry’s `date`.
- `puzzles` – chronologically sorted array of `{ date, path }` pairs; `path` always matches the object key under `puzzles/`.

Because the file is derived, we don’t keep a checked-in copy in sync—pull it from S3 (`aws s3 cp s3://econn-content-<env>/manifest.json -`) when needed.

## Working Agreements
- Maintain puzzles as per-file JSON checked into git.
- Validator must fail fast locally; no uploads of malformed data.
- Manual CLI run handles uploads; no automation or scheduling yet.
- Frontend reads directly from S3 (tiny traffic expectations).
- Secrets/credentials stay out of the repo; AWS auth supplied via environment or local profile.

## Open Tasks
- Document AWS credential expectations and example `econn-content upload` flows.
- Decide on a policy for remote-only puzzles (delete vs. keep) and encode it in the CLI.
- Add more fixtures covering edge-case manifests and multi-puzzle uploads.
