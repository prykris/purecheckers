# Clean setup verification

Verified locally on 11 September 2026 with Node 24.16.0, npm 11.1.0, Windows PowerShell and PostgreSQL 16 in the existing Docker Compose container. This was a separate source copy of the uncommitted workspace with no initial `node_modules`, build, Svelte cache or `.env`. It was not a selected release commit, a new Docker installation, a Linux image build or Railway acceptance.

## Problems found and corrected

- The first fresh install left Prisma Client uninitialized. Seeding and backend tests failed despite succeeding in the established workspace. The project now explicitly runs `prisma generate` during postinstall. Generation also succeeded without `.env` or `DATABASE_URL`, validating README's install-before-environment sequence. Build/migration scripts use the installed Prisma executable rather than allowing `npx` to fetch a missing CLI.
- The example environment selected production before a build existed and advertised production invitation URLs. It now leaves `NODE_ENV` unset and uses the development client URL. `server/start.js` selects production before imports, making `npm start` portable across shells without Unix-style inline assignment.
- The development proxy ignored a configured backend port, the LAN fallback used the wrong client port and Vite could silently move to another occupied port. `PORT` now drives the proxy; `CLIENT_PORT` drives Vite and the invitation fallback. Vite requires the configured port. The backend watcher now watches server/shared/environment inputs, avoiding restarts caused by frontend-generated files.
- Tests apply migrations but do not create their database. README and deployment notes now explicitly provision the separate test database once. Docker Compose creates the default development database on a new volume; custom database URLs require existing databases.
- The fresh install reported three high audit entries from one dependency chain: Prisma → `@prisma/config` → `deepmerge-ts`. A scoped override pins only the config loader's merge library to 8.0.0. npm audit reports zero known vulnerabilities after that change. This is not a comprehensive security certification.

The [upstream advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) describes recursive-object stack exhaustion and identifies 8.0.0 as patched. The [release notes](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0) also describe Map/type changes; this application uses Prisma's ordinary configuration loader, not custom Map merging. A direct compatibility check passed ordinary nested configuration merging and self-referential objects, followed by generation, migrations, tests, build and startup. Retain the scoped override until the parent dependency adopts a patched compatible release, then remove it with equivalent checks.

README recommends Node 22 or 24 LTS based on the [official release list](https://nodejs.org/en/about/previous-releases), checked on the verification date. Only 24.16.0 was executed in this original Windows pass. The later [clean Linux verification](linux-verification.md) covers Node 24.21.0 on Debian 12; Node 22 remains unverified.

## Evidence

The copy used databases `checkers_setup_20260911` and `checkers_setup_tests_20260911`, created empty in the existing local PostgreSQL container. Alternate ports 4183 and 5179 avoided the user's running clients. No primary or production database was used.

| Check | Result and local evidence |
| --- | --- |
| Fresh locked install and explicit client generation | Passed; `.generated/setup-install-patched.log` |
| Client generation before `.env` exists | Passed; `.generated/setup-generate-without-env.log` |
| All 21 migrations on empty schema | Passed; `setup-migrate-final.log`; repeated run had no pending migrations in `setup-migrate-patched.log` |
| Initial seed and repeat seed | Passed; three bot accounts and fifteen shop items remained; `setup-seed-final.log`, `setup-seed-repeat.log` |
| Complete suite with fresh dependencies and separate test database | **618 tests across 61 files passed**; `setup-tests-final.log` |
| Development startup through `npm run dev` | Passed; scoped watcher and both configured ports in `setup-dev-combined.log` |
| Development HTTP and WebSocket proxy | Home, health, bots and friends guide returned 200; a newly created guest received an idle authoritative snapshot over WebSocket; `setup-dev-smoke.log` |
| Production build through `npm run build` | Passed; `setup-build.log`; existing adapter unused-import warning remains |
| Production startup through `npm start` | Passed on Windows with unset `NODE_ENV`; migration/seed sequence and production mode in `setup-production-start.log` |
| Built HTTP and WebSocket behavior | Same four routes returned 200; a new guest received its initial snapshot; `setup-production-smoke.log` |
| Dependency audit and scoped merge compatibility | Zero known audit findings in `setup-audit-final.json`; cyclic and ordinary merges passed in `setup-dependency-smoke.log` |

All log names above are under `.generated/`. The initial failures remain in their original logs rather than being relabeled as successful. `setup-source-manifest.json` records matching hashes for 392 server/shared/client/Prisma/script/test source files. The Vite configuration used by the smoke run differs from the final file only in formatting; subsequent documentation edits do not affect those runtime checks. The helper is retained as `.generated/setup-smoke.mjs`.

Temporary processes were stopped and both disposable databases were dropped. The source/dependency copy remains at `.generated/setup-20260911`: automatic approval review rejected its recursive removal as blocked by policy, with no further reason supplied. User-running clients on port 5173 were left alone. There was no commit, production migration, deployment or outreach.

## Remaining release acceptance

This establishes local source setup, not the full launch gate. Select/review the release commit, verify the Linux/Railway build and native dependencies on that host, run actual-device gameplay/recovery checks, choose and measure host capacity, and complete the puzzle publishing and owner gates in [launch readiness](growth/launch-readiness.md). The HTTP/socket smoke is not a complete bot game or visual acceptance pass.
