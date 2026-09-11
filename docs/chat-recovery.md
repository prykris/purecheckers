# Chat delivery and recovery

Chat is a separate acknowledged workflow. It never changes room or game membership. `server/services/chat.js` owns validation, authorization, rate limits and persistence; the socket handler adapts requests and broadcasts committed messages. `src/lib/chat/client.js` owns reads, delivery confirmation, drafts and unread state for both global and room/game chat. Components render that state.

## Contract

- `shared/chat.js` defines the versioned send, history and message event names. Sends carry a UUID `clientMessageId`, exact channel ID and plain text of 1–300 characters. Acknowledgements explicitly accept or reject the request.
- The current session and connection authorize every request. Room subscriptions remain owned by snapshot reconciliation. Clients cannot join arbitrary chat channels.
- PostgreSQL serializes sends per sender and enforces a unique `(senderId, clientMessageId)` key. The same request returns the same persisted message, even after reconnect or a lost acknowledgement. Reusing an ID with different content is rejected. Rate limits apply only to new messages.
- Messages enter the visible conversation only with a persisted ID. While delivery is uncertain the original draft and UUID are retained. Retry resends that request. The sender's live echo, history or acknowledgement can confirm it; all are merged by message ID.
- History has an explicit loading/error/empty/has-more response. New live messages cannot be overwritten by a delayed read. Connection generations discard obsolete completions. A long absence starts a contiguous recent window, with older messages available through pagination.
- Visibility/read reports are idempotent: reporting an already-visible channel does not publish another state; read cursors are saved only when they advance, and unread counters publish only when they change. This prevents a rendering subscriber from creating a visibility/publication loop.
- Mention and spectator metadata are persisted, so history and live delivery agree. Spectators cannot notify game participants through mentions. Read markers are scoped to account and channel; denied browser storage does not break chat.
- The current UI renders plain text, never HTML. Persisted text retains escaped angle brackets for safe overlap with an older server during deployment. The migration normalizes ampersands; the service decodes once at the wire boundary. New plain-text messages use the versioned event so an old browser's HTML renderer cannot consume them. Old browser sessions need a reload after this protocol update.

## Verification

`chat.test.js` exercises real PostgreSQL concurrency, idempotency, rate limits, permissions, history pagination and persisted metadata. `chatClient.test.js` covers lost acknowledgements, reconnects, live/history ordering, pagination failure, unread deduplication, reentrant visibility publication and disposal. The 11 September local browser pass reproduced the old standard-room Creating freeze, then verified creation, joining, readiness and four moves after the fix. `gameSocket.test.js` verifies the actual socket send/echo/reconnect/history path.

Manual acceptance: send between two browsers, disconnect immediately after sending and retry; only one message should appear. Send rapidly and confirm the rejected draft remains editable. Leave a room while history loads and verify it cannot appear in the next channel. Enter literal `<b>text</b>` and `&lt;text&gt;`; both should display literally. Scroll older history, reconnect and check the read/error indicators.
