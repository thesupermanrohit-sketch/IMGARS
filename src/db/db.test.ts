import { describe, expect, it } from 'vitest';
import { getStaleImageIds, getStaleOwnedImageIds } from './db';

describe('getStaleImageIds', () => {
  it('keeps records belonging to active queue items', () => {
    expect(getStaleImageIds(['active', 'orphan', 42], ['active', '42'])).toEqual(['orphan']);
  });

  it('returns all records when there are no active queue items', () => {
    expect(getStaleImageIds(['one', 'two'], [])).toEqual(['one', 'two']);
  });
});

describe('getStaleOwnedImageIds', () => {
  it('only returns stale records owned by the current session', () => {
    expect(
      getStaleOwnedImageIds(
        [
          { id: 'mine-stale', ownerId: 'current' },
          { id: 'mine-active', ownerId: 'current' },
          { id: 'other-stale', ownerId: 'other' },
          { id: 'legacy', ownerId: undefined },
        ],
        ['mine-active'],
        'current'
      )
    ).toEqual(['mine-stale']);
  });
});
