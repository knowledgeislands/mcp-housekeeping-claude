# Developer guides

These guides are for anyone changing this repository: adding a tool, fixing a defect, or working out why a gate fails. They assume a checkout rather than an installed package, and they describe this repository's own working practice rather than general TypeScript advice.

The conventions themselves live elsewhere and are not repeated here. [`CONTRIBUTING.md`](../../../CONTRIBUTING.md) holds contributor setup, the commit convention, the testing convention, and the pre-PR checklist. [`CLAUDE.md`](../../../CLAUDE.md) holds the architecture invariants and the seven security requirements every tool must preserve, and [`AGENTS.md`](../../../AGENTS.md) states them runtime-neutrally. These guides cover the procedures those conventions imply.

## Work on the server locally

[Local development](local-development.md) covers running the server from source under `--watch`, how `.env.development` and `.env.local` are loaded and which value wins, driving the server through the MCP Inspector, running the test suite and its coverage thresholds, and the complete gate to run before handing a change over.

## Add or change a tool

[Adding a tool](adding-a-tool.md) covers the registration pattern — a thin definition in `src/tools/<group>/index.ts`, the real work in `src/main/<group>/`, the config slice as the first argument — the annotation preset that decides the tool's access level, the schema and path-containment requirements for anything that becomes a path segment, and the four places that track the tool surface and must all move in the same commit.
