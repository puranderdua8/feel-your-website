# Contributing

## Workflow

- Branch off `main`, open a PR. CI (`.github/workflows/ci.yml`) must be green:
  `format:check`, `lint`, `typecheck`, `build`, `test`, `test:contracts`, plus the
  migration and Terraform checks.
- Every PR that changes a package ships a Changeset: `pnpm changeset`.
- Keep PRs small and individually meaningful — a new package or a new optional
  API lands inert (nothing consumes it yet) before the PR that wires it in.

## Local setup

Node `22.23.2`+ (see `.nvmrc`), pnpm `11`.

```bash
pnpm install --frozen-lockfile
pnpm dev            # all apps
pnpm test           # unit tests
pnpm test:contracts # cross-adapter contract suites (skip without SUPABASE_* env)
```

A fresh clone runs with no credentials — the memory content adapter and mock auth
are the defaults.

## Deployment

Deploys are **manual** and decoupled from PRs. See [`docs/deployment.md`](docs/deployment.md).
Merging a PR does **not** deploy anything.

## Architecture rules

- **No app imports `supabase-js`.** Apps depend on the `*-core` interfaces; the
  one file allowed to name a concrete backend is `apps/*/src/server/adapters.ts`,
  enforced by `seam.test.ts`.
- Backend capabilities are interface-first: a `*-core` package (interface +
  exported contract-test suite + in-memory impl), a concrete `*-<vendor>`
  package, bound at the single DI seam.

See [`README.md`](README.md) for the full picture.
