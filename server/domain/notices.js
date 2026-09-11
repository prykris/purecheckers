import { dismissSessionNotice, readSessionNotice } from '../services/sessionNotices.js';
import { runGameplayWork } from '../services/gameplayWork.js';
import { getSession, applySessionNotice } from './sessions.js';

export function createNoticeActions(session) {
  return { 'notice:dismiss': ({ noticeId }) => runGameplayWork(async work => {
    const connection = session.connectionId;
    const guard = () => work.isCurrent() && getSession(session.userId) === session && session.connectionId === connection;
    let record;
    try { record = await dismissSessionNotice(session.userId, noticeId, work.owner, guard); }
    catch (error) {
      // Retrying the same event dismissal confirms a lost response safely.
      try { record = await dismissSessionNotice(session.userId, noticeId, work.owner, guard); } catch { throw error; }
    }
    work.assertCurrent(); applySessionNotice(session.userId, record);
  }) };
}

export function restoreSessionNotice(userId) {
  return runGameplayWork(async work => {
    const record = await readSessionNotice(userId, work.owner);
    work.assertCurrent(); applySessionNotice(userId, record);
  });
}
