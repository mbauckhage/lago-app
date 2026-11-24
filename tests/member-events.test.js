import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memberEvents } from '../src/member-events.js';

const events = [
  { id: 3, host_id: 7, guests: [{ id: 7 }], cancelled: true },
  { id: 2, host_id: 8, guests: [{ id: 7, status: 'Declined' }] },
  { id: 1, host_id: 8, guests: [{ id: 7, status: null }] },
  { id: 0, host_id: 9, guests: [] }
];
test('own events use stable member IDs and retain cancelled events', () => {
  assert.deepEqual(memberEvents(events, 7, 'own').map(e => e.id), [3]);
});
test('all events include invitations regardless of response without duplicating hosted events', () => {
  assert.deepEqual(memberEvents(events, 7, 'all').map(e => e.id), [3, 2, 1]);
});
test('unknown and unselected members have no visible events', () => {
  assert.deepEqual(memberEvents(events, 10, 'all'), []);
  assert.deepEqual(memberEvents(events, null, 'own'), []);
});
