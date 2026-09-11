// Reserve every participant's queue before awaiting any of them. Overlapping
// work then observes the same order, while unrelated sessions remain independent.
// Call at the owning boundary; nesting work on an already-held session deadlocks.
export function enqueueSessionWork(sessions, work) {
  const participants = [...new Set(sessions.filter(Boolean))];
  const task = Promise.all(participants.map(session =>
    Promise.resolve(session.commands).catch(() => {})
  )).then(work);
  const settled = task.catch(() => {});
  for (const session of participants) session.commands = settled;
  return task;
}
