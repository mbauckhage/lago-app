// Input is the viewer’s access-controlled feed, never another member’s private feed.
export function memberEvents(events, memberId, tab) {
  if (memberId == null) return [];
  return events.filter(event => event.host_ids?.includes(memberId) || event.host_id === memberId ||
    (tab === 'all' && event.guests.some(guest => guest.id === memberId)));
}
