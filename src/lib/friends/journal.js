import { ActionJournal } from '../actions/journal.js';
import { validFriendshipIntent, validFriendshipReceipt } from '../../../shared/friendshipActions.js';

export class FriendshipJournal extends ActionJournal {
  constructor(options) {
    super({ ...options, namespace: 'friendships', label: 'Friendship action',
      validIntent: validFriendshipIntent, validReceipt: validFriendshipReceipt });
  }
}
