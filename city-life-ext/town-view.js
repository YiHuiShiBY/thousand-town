/* Read-only bridge from archived resident plans to map/renderer consumers.
 * Map bindings retain identities and references, never a second world position.
 * Rendering must never build a Plan or infer a resident from a street proxy. */
(function (root, factory) {
  'use strict';
  var api = factory(
    root.CityLayout || (typeof require === 'function' ? require('../city-layout.js') : null),
    root.CityFacilities || (typeof require === 'function' ? require('../city-facilities.js') : null),
    root.CityResidentState || (typeof require === 'function' ? require('./resident-state.js') : null),
    root.CityDailyClock || (typeof require === 'function' ? require('./daily-clock.js') : null)
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CityTownView = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Layout, Facilities, State, Clock) {
  'use strict';

  function bindMap(city, buildings) {
    city = city || {};
    buildings = buildings || [];
    var cells = Layout.cells(city);
    var mapBuildings = city.buildings || [];
    var byLedgerId = {}, byMapId = {};
    function sourceLot(item) {
      var nearest = cells[0];
      cells.forEach(function (cell) {
        if (Math.pow(cell.x - item.x, 2) + Math.pow(cell.z - item.z, 2) <
          Math.pow(nearest.x - item.x, 2) + Math.pow(nearest.z - item.z, 2)) nearest = cell;
      });
      return nearest.sourceLot;
    }
    // Canonical addresses, not rank among surviving geometry. A density toggle
    // may remove a body, but must never turn the next one into the missing resident
    // ledger row. These are city-model's towerLots and the two nonsports park lots.
    var towerSources = { 't-one': 3, 't-two': 5, 't-three': 6, 't-four': 9 };
    var parkSources = { 'c-park-a': 4, 'c-park-b': 11 };

    buildings.forEach(function (row) {
      var items = [];
      var annex = (city.annexes || []).find(function (a) { return a.id === row.id; });
      if (annex) {
        var host = mapBuildings.find(function (b) { return b.id === annex.host; });
        if (host) items.push({ mapId: annex.id, ref: annex, annex: annex, host: host });
      } else {
        var found = [];
        if (row.kind === 'tower') found = mapBuildings.filter(function (b) {
          return b.kind === 'glass' && sourceLot(b) === towerSources[row.id];
        });
        else if (row.kind === 'park') found = (city.parks || []).filter(function (p) {
          return sourceLot(p) === parkSources[row.id];
        });
        else if (row.kind === 'housing') found = mapBuildings.filter(function (b) { return b.housing && b.housing.type === row.type; });
        else if (row.kind === 'night-market') found = (city.waterfront && city.waterfront.stalls) || [];
        else if (row.kind === 'civic') found = city.waterfront && city.waterfront.civic ? [city.waterfront.civic] : [];
        else if (row.kind === 'station' || row.kind === 'amusement' || row.kind === 'plaza') {
          found = (city.places || []).filter(function (p) { return p.kind === row.kind; });
        } else found = mapBuildings.filter(function (b) { return b.facility === row.kind; });
        items = found.map(function (ref) {
          var mapId = ref.id || (row.kind === 'park' ? 'park-source-' + sourceLot(ref) : 'place-' + row.kind);
          return { mapId: mapId, ref: ref };
        });
      }
      byLedgerId[row.id] = { id: row.id, kind: row.kind, ledger: row, items: items,
        mapIds: items.map(function (item) { byMapId[item.mapId] = row.id; return item.mapId; }) };
    });

    function locate(id) {
      var binding = byLedgerId[id] || byLedgerId[byMapId[id]];
      if (!binding) return [];
      return binding.items.map(function (item) {
        var source = item.ref;
        var at = item.annex ? Facilities.annexAt(item.annex, item.host) : source;
        if (!at) return null;
        return { x: at.x, z: at.z, w: at.w, d: at.d, mapId: item.mapId,
          floors: source.floors || 0,
          height: source.height || (source.floors || 0) * (source.floorHeight || 6) };
      }).filter(Boolean);
    }
    return { byLedgerId: byLedgerId, byMapId: byMapId, locate: locate };
  }

  function calendarOpen(row, day) {
    var type = Clock.dayType(day);
    if (row.open === 'weekday') return type === 'weekday';
    if (row.open === 'sat-am') return type !== 'sunday';
    return true;
  }

  // Calendar policy is only the first gate. Daily means every day, not all day.
  // The two public counters and food street have explicit service hours in the
  // schedules; remaining venues read activity/incoming demand from this snapshot,
  // so staggered arrivals and evening study do not fight a second timetable.
  function publicOpen(row, value, day, minute, incoming) {
    if (row.kind === 'housing' || row.kind === 'hospital' || row.kind === 'precinct') return true;
    if (!calendarOpen(row, day)) return false;
    if (row.kind === 'bank' || row.kind === 'civic') {
      var close = row.open === 'sat-am' && Clock.dayType(day) === 'saturday' ? 840 : 1020;
      return minute >= 480 && minute < close;
    }
    if (row.kind === 'night-market') return minute >= 1080;
    if (row.kind === 'park' || row.kind === 'plaza') return true;
    return value.awake > 0 || incoming > 0;
  }

  // Doors answer the timetable, not the light policy: housing and the hospital
  // keep `open` true around the clock for ward and entry lights, yet their leaves
  // close at night. Schools swing open only across the arrival and dismissal
  // windows their students actually walk (§6 schedules: primary 07:30 and 16:00,
  // secondary 07:00 and 20:30 evening-study exit, university 10:30 and 15:00).
  // Every other venue has no timetable of its own, so its door simply follows the
  // presence-based open gate above. The value is leaf travel 0..1, eased across an
  // eight-minute margin so leaves animate at the window edge instead of snapping.
  var DOOR_WINDOWS = {
    housing: [[390, 1320]],
    hospital: [[420, 1140]],
    primary: [[435, 505], [945, 1010]],
    secondary: [[405, 480], [1215, 1300]],
    university: [[615, 690], [885, 950]]
  };
  var DOOR_FADE = 8;

  function doorTravel(kind, policy, day, minute) {
    var windows = DOOR_WINDOWS[kind];
    if (!windows) return -1; // caller falls back to the open gate
    if (policy === 'weekday' && Clock.dayType(day) !== 'weekday') return 0;
    var travel = 0;
    windows.forEach(function (window) {
      var edge = 0;
      if (minute >= window[0] && minute <= window[1]) edge = 1;
      else if (minute >= window[0] - DOOR_FADE && minute < window[0]) edge = (minute - (window[0] - DOOR_FADE)) / DOOR_FADE;
      else if (minute > window[1] && minute <= window[1] + DOOR_FADE) edge = ((window[1] + DOOR_FADE) - minute) / DOOR_FADE;
      travel = Math.max(travel, edge);
    });
    var t = Math.max(0, Math.min(1, travel));
    return t * t * (3 - 2 * t);
  }

  function nextDestination(plan, index) {
    for (var offset = 1; offset <= plan.segments.length; offset++) {
      var candidate = plan.segments[(index + offset) % plan.segments.length].location;
      if (candidate && candidate !== 'street') return candidate;
    }
    return 'street'; // A supplied all-street plan is still counted honestly.
  }

  function sample(town, snapshot, minute) {
    var m = ((minute % 1440) + 1440) % 1440;
    var day = snapshot.day;
    var night = Clock.isNight(m);
    var dark = Math.max(1 - Clock.daylight(m), night ? .15 : 0);
    var byBuilding = {}, residents = {}, staff = {}, awakeHome = {};
    var streetByDestination = {}, demandBuildings = {}, outdoor = {};
    town.buildings.forEach(function (row) {
      byBuilding[row.id] = { id: row.id, kind: row.kind, presentIds: [], homeIds: [], byState: {},
        open: false, awake: 0, working: 0, lightLevel: 0 };
      staff[row.id] = 0;
      awakeHome[row.id] = 0;
    });
    town.residents.forEach(function (resident) {
      residents[resident.id] = resident;
      if (byBuilding[resident.home]) byBuilding[resident.home].homeIds.push(resident.id);
    });
    snapshot.plans.forEach(function (plan) {
      var found = State.segmentAt(plan, m);
      if (!found) return;
      var state = found.segment;
      if (state.location === 'street') {
        var destination = nextDestination(plan, found.index);
        streetByDestination[destination] = (streetByDestination[destination] || 0) + 1;
        return;
      }
      var target = byBuilding[state.location];
      if (!target) return;
      var resident = residents[plan.owner];
      target.presentIds.push(plan.owner);
      target.byState[state.state] = (target.byState[state.state] || 0) + 1;
      if (state.state !== 'SLEEPING') {
        target.awake++;
        if (resident && resident.home === target.id) awakeHome[target.id]++;
      }
      if (state.state === 'AT_WORK') target.working++;
      // Students' WORK is their classroom and patients' WORK is their ward; neither
      // belongs to a staff proxy pool. Staff on a meal break remain onsite staff.
      if (resident && resident.workplace === target.id &&
        !/^(student-|preschooler$|patient$)/.test(resident.role || '')) staff[target.id]++;
    });
    town.buildings.forEach(function (row) {
      var value = byBuilding[row.id], total = value.presentIds.length;
      value.open = publicOpen(row, value, day, m, streetByDestination[row.id] || 0);
      var travel = doorTravel(row.kind, row.open, day, m);
      value.doorOpen = travel >= 0 ? travel : (value.open ? 1 : 0);
      var activity;
      if (row.kind === 'housing') {
        activity = awakeHome[row.id] / Math.max(1, value.homeIds.length);
      } else if (row.kind === 'hospital') {
        // Sleeping wards need a small care light; working staff carry the stronger
        // signal. This never turns the whole hospital off while patients remain.
        activity = total ? .12 + .6 * value.working / Math.max(1, total) +
          .2 * total / Math.max(1, row.capacity) : 0;
      } else if (!value.open) {
        activity = value.awake ? Math.min(.08, .025 + value.awake / Math.max(1, row.capacity) * .08) : 0;
      } else {
        activity = value.awake ? .18 + .82 * value.awake / Math.max(1, row.capacity) : 0;
      }
      value.lightLevel = Math.max(0, Math.min(1, activity * dark));
      var counts = { total: total, staff: staff[row.id], visitors: total - staff[row.id],
        kind: row.kind, open: value.open };
      demandBuildings[row.id] = counts;
      if (['park', 'plaza', 'amusement', 'station', 'night-market'].indexOf(row.kind) >= 0) {
        outdoor[row.id] = value.open ? Object.assign({}, counts) :
          { total: 0, staff: 0, visitors: 0, kind: row.kind, open: false };
      }
    });
    var occupancy = State.occupancy(snapshot.plans, m);
    return { day: day, minute: m, night: night, occupancy: occupancy, byBuilding: byBuilding,
      demand: { street: occupancy.street, streetByDestination: streetByDestination,
        outdoorByBuilding: outdoor, byBuilding: demandBuildings, night: night, maxPeople: 360 } };
  }

  return { bindMap: bindMap, sample: sample };
});
