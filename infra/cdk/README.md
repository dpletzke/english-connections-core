# English Connections Infrastructure

This CDK workspace provisions the storage layer that backs the puzzle content CLI.

## Bucket Specification
- **Region:** `sa-east-1` (São Paulo) for both dev and prod stacks.
- **Names:** `econn-content-dev` and `econn-content-prod`.
- **Layout:** keep a single `manifest.json` object at the root; store individual puzzles under the `puzzles/` prefix.
- **Versioning:** enabled so older puzzle revisions remain available.
- **Lifecycle:** transition objects to the Standard-IA storage class after 30 days to lower costs while keeping fast retrieval.
- **Access policy:** allow public reads on the `puzzles/` prefix and `manifest.json` so `en-connect.dpletzke.dev` can fetch data directly; retain write access for project IAM principals only.
- **Encryption:** rely on the default (no explicit SSE configuration).

## Useful commands
- `npm run build`   compile typescript to js
- `npm run watch`   watch for changes and compile
- `npm run test`    perform the jest unit tests
- `npx cdk deploy`  deploy this stack to your default AWS account/region
- `npx cdk diff`    compare deployed stack with current state
- `npx cdk synth`   emits the synthesized CloudFormation template
