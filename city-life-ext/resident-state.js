/* Resident state queries (§7) — read-only views over Plans. Because plans fully
 * cover the day, "simulation" is a lookup: stateAt(plan, minute) is a pure
 * function, which keeps pause/seek/export consistent exactly like the
 * construction timeline does. The FSM surface (transitions, triggers) lives in the
 * validator here and the segment ordering in resident-plan.js. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CityResidentState = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var MINUTES_PER_DAY = 1440;

  function segmentAt(plan, minute) {
    var m = ((minute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    var segments = plan.segments;
    for (var i = 0; i < segments.length; i++) {
      if (m >= segments[i].start && m < segments[i].end) return { segment: segments[i], index: i };
    }
    return null; // only possible if the plan lost coverage; validate() catches it
  }

  // Merged midnight-crossing sleep: when the day starts and ends with SLEEPING,
  // report one span (stateSince goes negative before 00:00, until runs past 1440)
  // so the UI can say "asleep since 22:15" at 01:30.
  function stateAt(plan, minute) {
    var found = segmentAt(plan, minute);
    if (!found) return null;
    var segments = plan.segments;
    var head = segments[0];
    var tail = segments[segments.length - 1];
    var wrapSleep = head.state === 'SLEEPING' && tail.state === 'SLEEPING';
    var s = found.segment;
    var stateSince = s.start;
    var untilMinute = s.end;
    if (wrapSleep && s === head && s.state === 'SLEEPING') stateSince = tail.start - MINUTES_PER_DAY;
    if (wrapSleep && s === tail && s.state === 'SLEEPING') untilMinute = head.end + MINUTES_PER_DAY;
    return {
      state: s.state,
      substate: s.substate,
      location: s.location,
      stateSince: stateSince,
      untilMinute: untilMinute
    };
  }

  // Number of state changes inside one day. The midnight seam is deliberately not
  // counted: a plan that both starts and ends asleep repeats as one continuous
  // span, and wake-up plus bedtime are already two changes in the list walk.
  function stateChanges(plan) {
    var changes = 0;
    for (var i = 1; i < plan.segments.length; i++) {
      if (plan.segments[i].state !== plan.segments[i - 1].state) changes++;
    }
    return changes;
  }

  /* Town-wide occupancy at one minute.
   * - street counts COMMUTE segments (they resolve to 'street')
   * - perBuilding tallies every concrete location id
   * - byState tallies the eight §7.1 states */
  function occupancy(plans, minute) {
    var perBuilding = {};
    var byState = {};
    var street = 0;
    var missing = 0;
    plans.forEach(function (plan) {
      var view = stateAt(plan, minute);
      if (!view) { missing++; return; }
      byState[view.state] = (byState[view.state] || 0) + 1;
      if (view.location === 'street') street++;
      else if (view.location) perBuilding[view.location] = (perBuilding[view.location] || 0) + 1;
    });
    return { minute: minute, street: street, perBuilding: perBuilding, byState: byState, missing: missing };
  }

  // Peak concurrent occupants per location over a whole day — the capacity ledger
  // that §4.1 numbers are checked against. 'street' carries the walking peak.
  function peakOccupancy(plans, step) {
    var stride = step || 5;
    var peaks = {};
    for (var m = 0; m < MINUTES_PER_DAY; m += stride) {
      var occ = occupancy(plans, m);
      var seen = Object.keys(occ.perBuilding);
      for (var i = 0; i < seen.length; i++) {
        var id = seen[i];
        peaks[id] = Math.max(peaks[id] || 0, occ.perBuilding[id]);
      }
      peaks.street = Math.max(peaks.street || 0, occ.street);
    }
    return peaks;
  }

  return {
    segmentAt: segmentAt,
    stateAt: stateAt,
    stateChanges: stateChanges,
    occupancy: occupancy,
    peakOccupancy: peakOccupancy
  };
});
