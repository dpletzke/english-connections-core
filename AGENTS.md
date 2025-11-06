# Agents Log

## Mission
- Maintain the backend/content infrastructure for English Learning Connections.
- Keep puzzle JSONs validated locally before any upload to S3.
- Support a pnpm-based monorepo with shared TypeScript types and room for a future server.

## Current Pillars
1. **Data pipeline** – Puzzle content lives outside of version control. Shared `@econncore/types` definitions exist; runtime validator still WIP.
2. **Upload flow** – CLI scaffolded under `apps/content-manager` with sample puzzles. Needs validator + S3 push implementation.
3. **Infrastructure** – AWS CDK project (`infra/cdk`) bootstrapped; stack must be tailored for final bucket names & lifecycle rules. No credentials or secrets in source.

## Out of Scope (for now)
- Game server/User accounts.
- Authentication/authorization.
- Automated CI/CD or GitHub Actions.

## Next Questions to Answer
- Finalize JSON validation logic inside the CLI (hand-written checks vs. lightweight helper).
- Decide S3 bucket names/regions plus retention/versioning rules, then encode them in the CDK stack.
- Define how the CLI selects dev vs prod buckets (flags/env) and how the frontend chooses the corresponding host.
