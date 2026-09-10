# Predefined bots

The source of truth is server/domain/botRegistry.js. Each entry has a permanent key, a default username, an initial rating and AI search depth. Never reuse a key for a different bot.

Both prisma/seed.js and runtime bot lookup call server/services/botAccounts.js. Challenge and Add Bot provision only the requested account, so running the seed is optional for gameplay. Seeding provisions every registry entry and does not reset existing ratings, balances or statistics.

User.botKey is nullable and unique. Account identity is independent of the display name. Existing seeded accounts are attached to a key only when their name matches and they are already bots without credentials, guest status or administrator privileges. A conflicting human or privileged account produces an error; provisioning never converts or overwrites it. Existing IDs and game history are preserved.

Creation runs in a database transaction. Unique-key/write conflicts trigger at most two retries, each in a fresh transaction. Other database errors propagate. There is no persistent account cache, so a missing account cannot remain cached as unavailable and a removed account cannot be returned from memory. Invalid keys, including prototype property names, cause no writes.

## Deployment

User.botKey and its unique index are part of the PostgreSQL migration history in prisma/migrations, which `npm run start` applies with `prisma migrate deploy` before seeding. No seed is required to play; the existing seed command remains useful for shop content and provisioning all bots ahead of time. See docs/deployment.md for the database setup.

## Verification

Tests run against PostgreSQL and cover an empty database, repeated provisioning, simultaneous requests from separate database clients, adopting seeded accounts, preserving renamed accounts and statistics, human/credential/admin/guest collisions, removed accounts, invalid keys, and database failures. Socket integration tests now start without seeded bots and verify that a bot game starts and the bot moves.
