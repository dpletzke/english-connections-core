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
- `content-manager/` – CLI workspace. Provides `validate` and `upload` commands: the validator blocks malformed puzzles locally and the uploader syncs new puzzles plus `manifest.json` to S3.
- `server/` – placeholder backend workspace with minimal config, ready for future REST API work.

### packages/
- `types/` – publishes the canonical `ConnectionsPuzzle` TypeScript definitions (`@econcore/types`). Currently type-only; emits declarations once the build script runs.

### infra/
- `cdk/` – TypeScript CDK app (generated via `cdk init`). Update the stack to provision the dedicated dev/prod S3 buckets once bucket naming/lifecycle decisions are finalized.

#### S3 Buckets (planned configuration)
- Region: `sa-east-1` (São Paulo) shared across dev and prod.
- Bucket names: `econ-content-dev` and `econ-content-prod`.
- Structure: `manifest.json` at the root plus all puzzle JSONs under `puzzles/`.
- Versioning stays enabled so historical uploads are retained.
- Lifecycle: transition objects to Standard-IA storage after 30 days; Glacier stays unused.
- Access: objects in `puzzles/` are world-readable so `en-connect.dpletzke.dev` can fetch content directly; writes remain IAM-restricted.

### puzzles/
- Located under `apps/content-manager/src/puzzles/`. One JSON per puzzle (e.g., `2024-01-01.json`) keeps history clean. A broken sample exists for validator testing.

## Working Agreements
- Maintain puzzles as per-file JSON checked into git.
- Validator must fail fast locally; no uploads of malformed data.
- Manual CLI run handles uploads; no automation or scheduling yet.
- Frontend reads directly from S3 (tiny traffic expectations).
- Secrets/credentials stay out of the repo; AWS auth supplied via environment or local profile.

## Open Tasks
- Document AWS credential expectations and example `econ-content upload` flows.
- Decide on a policy for remote-only puzzles (delete vs. keep) and encode it in the CLI.
- Add more fixtures covering edge-case manifests and multi-puzzle uploads.
