# Bot search workers

Live search is owned by `server/services/searchService.js`. Both bot moves and optional move grading use its worker pool; neither minimax runs in a timer on the socket thread. Bot account provisioning remains in `botPlayer.js` and the registry.

## Resource limits

- One worker by default. `BOT_WORKERS` accepts 1–4; begin with one on a small Railway host and increase only after observing CPU and memory.
- At most 32 queued jobs; bot moves take priority over queued grading. Running grading has a 150 ms search budget. Bot search has a 350 ms budget.
- End-to-end deadlines include queueing and worker startup: two seconds for moves, one second for grading. A watchdog terminates stuck workers. Retiring workers continue counting against the thread limit until termination finishes.
- Each worker has a 128 MB old-generation heap limit. Idle workers are unreferenced so they do not keep Node alive. `closeSearchPool()` rejects outstanding jobs and terminates workers for explicit shutdown or test cleanup.
- A worker failure, queue overflow or expired deadline gives the bot a legal fallback; grading is omitted when unavailable. Grading never holds up an authoritative move.

The underlying thread lifecycle follows Node's [worker_threads documentation](https://nodejs.org/api/worker_threads.html). `workerPool.js` only schedules and transports tasks; it has no game rules.

## Game ownership

Each search receives a copied position, including capture-chain and draw history. Search uses iterative deepening with the registry's depth as a maximum; completed depth can be lower under budget pressure. It evaluates every legal capture continuation and changes the search side only when the engine changes turns.

The domain captures game identity, side to move and ply before scheduling. It checks these again before submitting work and after the worker replies, advances the authoritative clock, then applies the proposal through the engine. Resignation and other terminal events abort outstanding search and grading. A reply from an obsolete game or turn cannot apply a move.

This changes bot evaluation from the older search that followed only the first capture continuation. Strength and timing are therefore not guaranteed identical to the old implementation.

Evaluation accumulates integer twentieths (man 20, king 100, advancement 2, centre 1) before converting to the existing public score scale. Move-grading differences use those same units. This preserves true ties and the 0.1 grading boundary instead of allowing floating-point accumulation order to decide them. The source-hashed article experiment must be regenerated when evaluation changes.

## Verification

`tests/workerPool.test.js` exercises queue limits, priority, queued/running cancellation, crash and timeout replacement, shutdown and main-thread responsiveness during CPU work. `tests/botSearch.test.js` covers copied state, exhausted budgets, capture branches and real worker move/grading results. `tests/gameSocket.test.js` verifies actual bot turns and rejects a delayed proposal after resignation.

Manual acceptance: play Hard with several games open, reconnect during the bot's turn, and resign while it thinks. These are owner browser checks; local automated success is not a production load-test result.


## Strategy diagram search

Scheduling now lives in `shared/workerPool.js`. The Node adapter retains AsyncResource diagnostics and Node worker limits. Strategy diagrams use the same scheduler with a browser Worker adapter, one worker and at most four queued requests. Each search has a 350 ms search budget and a two-second queue/execution deadline. Both environments use `shared/botSearch.js`; the article bot no longer runs ColonelBot synchronously on the browser UI thread.

Diagram reset/navigation cancels the queued or running search and pending reply/animation timers. Replies are bound to the diagram generation and position instance. Failure leaves an explicit reset/retry message. Browser adapter tests cover cancellation, stale replies, replacement and errors; the existing Node pool, game/socket and preview tests passed after extraction. Manual acceptance still needs fast reset/navigation during a bot reply, multi-jumps and reduced motion in article diagrams.
