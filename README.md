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
- `content-manager/` – CLI workspace. Contains sample puzzles and scaffolding for the validator/upload commands. `package.json` and `tsconfig.json` are in place; `src/cli.ts` will host the hand-written validator that blocks malformed puzzles before S3 uploads.
- `server/` – placeholder backend workspace with minimal config, ready for future REST API work.

### packages/
- `types/` – publishes the canonical `ConnectionsPuzzle` TypeScript definitions (`@econcore/types`). Currently type-only; emits declarations once the build script runs.

### infra/
- `cdk/` – TypeScript CDK app (generated via `cdk init`). Update the stack to provision the dedicated dev/prod S3 buckets once bucket naming/lifecycle decisions are finalized.

### puzzles/
- Located under `apps/content-manager/src/puzzles/`. One JSON per puzzle (e.g., `2024-01-01.json`) keeps history clean. A broken sample exists for validator testing.

## Working Agreements
- Maintain puzzles as per-file JSON checked into git.
- Validator must fail fast locally; no uploads of malformed data.
- Manual CLI run handles uploads; no automation or scheduling yet.
- Frontend reads directly from S3 (tiny traffic expectations).
- Secrets/credentials stay out of the repo; AWS auth supplied via environment or local profile.

## Open Tasks
- Implement the runtime validator + upload logic inside `apps/content-manager/src/cli.ts`.
- Decide S3 bucket naming conventions, regions, and lifecycle rules; update the CDK stack accordingly.
- Add tests around the validator and upload dry-runs.
- Document the eventual upload command usage once the CLI is complete.
