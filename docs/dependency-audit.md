# Dependency audit — 10 September 2026

This is a local dependency assessment, not a production security certification. The original `npm audit --json` reported 25 affected dependency entries: two critical, fifteen high, six moderate and two low. Counts include transitive propagation; they are not counts of independent exploitable application defects.

## Updates applied

Updated within the project's existing major-version lines and refreshed the lockfile. Key installed versions are SvelteKit 2.70.3, Svelte 5.57.0, Vite 6.4.3, Vitest 4.1.11, concurrently 9.2.4, Prisma/client 6.19.3 and Engine.IO 6.6.10. Direct dependency minimums now match the repaired versions. Socket.IO remains on 4.8.3 with patched transitive packages.

The [SvelteKit content-negotiation advisory](https://github.com/sveltejs/kit/security/advisories/GHSA-29g2-3rmr-qm68) and [Engine.IO connection-exhaustion advisory](https://github.com/advisories/GHSA-r635-g3xr-vw7x) were among the reported server-facing issues. The refreshed tree no longer reports those advisories or the original critical shell-quote chain.

SvelteKit still declared cookie 0.6.0. A narrow `@sveltejs/kit` override selects cookie 0.7.2, whose existing parse/serialize API is used by Kit. It adds the validation described in the [cookie maintainer advisory](https://github.com/jshttp/cookie/security/advisories/GHSA-pxg6-pf52-xh8x). Express and Engine.IO already use 0.7.2. Remove this override when Kit's own dependency no longer needs it; do not override future cookie major versions indefinitely.

The machine's npm 11.1.0 crashed while building its dependency tree during `audit fix`, before applying the update. A temporary `npx npm@12.0.2` invocation completed the non-forced update and install. No global npm installation was changed. Install scripts were disabled during resolution; Prisma Client was explicitly regenerated afterward.

## Remaining advisory and exposure

The final audit reports three high entries, all from one chain: `prisma → @prisma/config → deepmerge-ts@7.1.5`. There are zero reported critical, moderate or low entries. The unresolved issue is [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx): recursively linked object graphs can exhaust the merge stack. Ordinary JSON cannot represent that recursive input by itself.

In the installed Prisma version, this library is imported by `loadConfigFromFile` and passed as the merger for local Prisma configuration. The application does not import `@prisma/config` or `deepmerge-ts` in its server, client, seed or publishing code. Prisma CLI runs during generation and migration; repository/configuration files must remain trusted. This source inspection found no route from an unauthenticated HTTP or socket payload to that merge operation. It does not prove the library is safe for arbitrary configuration supplied by an untrusted party.

The current [8.0.0 fix](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0) also changes Map merging and mutation semantics. No broad major-version override or downgrade of Prisma to npm audit's suggested 6.12.0 was applied. A supported Prisma dependency update, or a separately justified and tested narrow override, remains follow-up work. The advisory is documented, not hidden or marked fixed.

## Verification

- Prisma Client generation completed with matching CLI/client 6.19.3.
- All 330 tests across 39 files passed against isolated PostgreSQL after the dependency changes, including HTTP/socket, search, persistence, puzzle reward and recovery tests.
- The production build completed. The nine built article pages retained their checked metadata/schema and article links; a fresh browser load of the comparison passed the desktop/phone check without captured warnings/errors.
- Local evidence: `.generated/dependency-audit.json`, `dependency-audit-after.json`, `dependency-fixes-npm12.log`, `tests-dependency-updates.log` and `build-dependency-updates.log`.

Before deployment, rerun the audit for the final lockfile and complete the separate application/production checks. A lower advisory count does not establish restart recovery, correct reverse-proxy configuration, settlement atomicity or production load capacity.
