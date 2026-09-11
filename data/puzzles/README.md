# Launch puzzle buffer

`launch-buffer.json` contains 31 generator-1.2.0 puzzles dated 2026-09-10 through 2026-10-10: 9 easy, 13 medium and 9 hard, with no substitutions from the weekly rotation. These are deployment inputs, not files served publicly by Express.

The complete batch passed deep decision-point verification and replay through the actual game engine. The generation pass took 911 seconds locally, scanning 14,683 positions. The final batch was independently reverified by `scripts/import-puzzles.js` without writing rows. Commentary was corrected to report board facts and reviewed for unsupported claims derived from numeric evaluations. Owner editorial and visual acceptance remains pending.

See `docs/puzzles.md` for import, reassignment, retry/conflict behavior and manual checks. Production has not been populated. Do not publish all future rows through a static website or expose this JSON as a public asset.

After the version-1.2.1 exact-evaluation correction, all 31 entries passed the importer's independent deep decision-point verification again on 10 September 2026. This was a dry run with no database writes. The artifact keeps its original 1.2.0 generation identity; re-verification is not a claim that it was regenerated.
