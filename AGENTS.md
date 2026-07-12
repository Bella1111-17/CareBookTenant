# Repository Guidelines

## Documentation Entry Points

Read these before making non-trivial changes:

- `CLAUDE.md` — detailed engineering conventions, architecture notes, and agent-facing implementation rules
- `CONTEXT.md` — domain language, business objects, and core business constraints
- `docs/README.md` — documentation map and where each class of document belongs
- `docs/product/PRD.md` — product requirements primary entrypoint

Keep `AGENTS.md` as the lightweight repo entrypoint. Put detailed implementation and agent workflow rules in `CLAUDE.md` to avoid drift.

## Project Structure & Module Organization
This repository is a `pnpm` monorepo with three active apps under `apps/`. `apps/server` contains the NestJS API (`src/module`, `src/common`, `test`). `apps/admin-vue3` contains the Vue 3 admin UI (`src/views`, `src/api`, `src/components`). `apps/wechat-miniprogram` contains the uni-app client (`src/pages`, `src/api`, `src/store`, `src/utils`). Supporting material lives in `docs/`, deployment scripts in `deployment/`, and one-off SQL or maintenance scripts in `scripts/`.

## Build, Test, and Development Commands
Use the root scripts for common workflows:

- `pnpm dev:api` runs the NestJS server in watch mode.
- `pnpm dev:admin` starts the admin Vite app.
- `pnpm dev:mp-weixin` starts the WeChat mini-program.
- `pnpm dev` runs API + admin together.
- `pnpm build` builds `apps/server` and `apps/admin-vue3`.
- `pnpm build:mp` builds the mini-program bundle.
- `pnpm lint` runs server and mini-program linting.
- `pnpm format` runs the server Prettier formatter.

App-specific tests:

- `pnpm --dir apps/server test:e2e`
- `pnpm --dir apps/server test:cov`
- `pnpm --dir apps/wechat-miniprogram test:run`

## Coding Style & Naming Conventions
Follow `.editorconfig`: UTF-8, LF, 2-space indentation, final newline, no trailing whitespace. Use TypeScript for backend and mini-program changes where those apps already do. NestJS files follow role-based naming such as `user.controller.ts`, `user.service.ts`, and DTOs in `dto/`. Vue and uni-app pages/components use PascalCase for shared components and route folders in kebab-case such as `src/pages/order-detail/`. Run ESLint before submitting; the server uses ESLint + Prettier, and the mini-program uses `@uni-helper/eslint-config`.

## Testing Guidelines
Backend unit tests use Jest with `*.spec.ts`; e2e tests live in `apps/server/test` and use `*.e2e-spec.ts`. Mini-program tests use Vitest with `*.test.ts` beside the source file, for example `src/utils/debounce.test.ts`. Add or update tests when changing request flows, auth, payments, or shared utilities.

## Commit & Pull Request Guidelines
Recent history mixes short Chinese summaries with Conventional Commit prefixes, but `apps/wechat-miniprogram/.commitlintrc.cjs` adopts Conventional Commits. Prefer `feat:`, `fix:`, `refactor:`, and `docs:` with a focused scope. PRs should describe changed apps, note schema or config changes, link related issues, and include screenshots for UI work in `apps/admin-vue3` or `apps/wechat-miniprogram`.

## Security & Configuration Tips
Do not commit secrets, production endpoints, or filled `.env` files. Review `apps/server/src/config/*.yml` and deployment scripts before changing runtime configuration. Treat SQL in `scripts/` as environment-sensitive and document rollback steps in the PR when data migrations are involved.
