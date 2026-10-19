/* Resident census, generation and allocation (§2.4, §3, §4.2, §12-risk7).
 *
 * Erratum against the design doc §4.2: its building "capacity" figures are peak
 * concurrent occupants, not resident rolls — housing slots (417) could never house
 * all 1000 people. Here every resident has a home, so default housing is sized to
 * the full 1000 minus the ward-dwelling patients, while §4.2 capacities stay as the
 * concurrency caps that resident-state.js enforces.
 *
 * Everything derives from the city seed through CityRandom: same seed ⇒ byte-same
 * roster, matching the town's replay/export convention. */
(function (root, factory) {
  'use strict';
  var api = factory(
    (typeof CityRandom === 'object' && CityRandom) ? CityRandom :
    (typeof require === 'function' ? require('../city-random.js') : null),
    (typeof CityResidentNames === 'object' && CityResidentNames) ? CityResidentNames :
    (typeof require === 'function' ? require('./resident-name.js') : null),
    (typeof CityDailyClock === 'object' && CityDailyClock) ? CityDailyClock :
    (typeof require === 'function' ? require('./daily-clock.js') : null)
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CityResidents = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (CityRandom, CityResidentNames, CityDailyClock) {
  'use strict';

  var MINUTES_PER_DAY = 1440;

  // role, headcount, inclusive age band, home kind, role→workplace kind options.
  // Census sums to exactly 1000 (§2.4 bands kept approximate for patients).
  //
  // W1.5 (§4.5): every row's work list now points at a building the town actually has.
  // Before this the blue-collar row "borrowed" towers, a station, a plaza and the
  // amusement park, and all three age groups of students shared one campus. Where the
  // split is a design decision rather than an even spread, `workQuota` states the
  // headcount per kind; rows without one keep the plain round-robin over `work`.
  //
  // W1.5c (§4.4.1) adds the three public-service trades the town was missing — police,
  // clerks (bank counter and sub-district office), sanitation — and takes their 40
  // people out of the two rows that had slack: `office` 180→150 (four towers at 90
  // seats were only 45% full) and `worker` 115→105 (the depot keeps its 12 drivers and
  // loses 10 of its 30 labourers). Nothing else in the census moves, so the town is
  // still exactly 1000 people. The three new posts are *not* new lots: they live in
  // buildings annexed to lots someone else owns (see `defaultBuildings`), which is why
  // `work` here points at kinds that never appear in the 24-lot list.
  var CENSUS = [
    { role: 'preschooler', count: 40, age: [1, 5], home: 'housing', work: null },
    { role: 'student-p', count: 80, age: [6, 12], home: 'housing', work: ['primary'] },
    { role: 'student-m', count: 50, age: [13, 17], home: 'housing', work: ['secondary'] },
    { role: 'student-u', count: 70, age: [18, 22], home: 'housing', work: ['university'] },
    { role: 'office', count: 150, age: [23, 55], home: 'housing', work: ['tower'] },
    { role: 'worker', count: 105, age: [23, 50], home: 'housing',
      work: ['workshop', 'depot', 'market'],
      workQuota: { workshop: 45, depot: 20, market: 40 } },
    { role: 'shopkeeper', count: 60, age: [25, 55], home: 'housing',
      work: ['mall', 'annex-mall', 'night-market'],
      workQuota: { mall: 35, 'annex-mall': 15, 'night-market': 10 } },
    { role: 'driver', count: 30, age: [25, 55], home: 'housing',
      work: ['station', 'depot'], workQuota: { station: 18, depot: 12 } },
    { role: 'teacher', count: 24, age: [25, 55], home: 'housing',
      work: ['primary', 'secondary', 'university'],
      workQuota: { primary: 8, secondary: 10, university: 6 } },
    { role: 'school-admin', count: 6, age: [28, 55], home: 'housing',
      work: ['primary', 'secondary', 'university'],
      workQuota: { primary: 2, secondary: 2, university: 2 } },
    { role: 'medical-doc', count: 20, age: [28, 60], home: 'housing', work: ['hospital'], shift: true },
    { role: 'medical-nurse', count: 30, age: [22, 50], home: 'housing', work: ['hospital'], shift: true },
    { role: 'hosp-admin', count: 5, age: [25, 55], home: 'housing', work: ['hospital'] },
    // Eight officers over the three shift windows (3/3/2) is the honest scale for a
    // town of 1000: a posting at the primary school gate, two patrol cars, nobody
    // answering a 999 call. `shift: true` reuses the hospital's window rotation.
    { role: 'officer', count: 8, age: [23, 45], home: 'housing', work: ['precinct'], shift: true },
    { role: 'clerk', count: 22, age: [23, 55], home: 'housing',
      work: ['bank', 'civic'], workQuota: { bank: 10, civic: 12 } },
    // Both crews are day-side: the early one leaves at 04:30 behind the market trucks,
    // the late one clears the riverfront after the night market shuts (see the
    // `sanitation` template). The third window simply folds into the early crew.
    { role: 'sanitation', count: 10, age: [25, 55], home: 'housing', work: ['waste'], shift: true },
    { role: 'unemployed', count: 10, age: [18, 22], home: 'housing', work: null },
    { role: 'patient', count: 30, age: [5, 85], home: 'hospital', work: ['hospital'] },
    { role: 'retiree', count: 190, age: [56, 70], home: 'housing', work: null },
    { role: 'senior', count: 60, age: [71, 90], home: 'housing', work: null }
  ];

  var CENSUS_TOTAL = CENSUS.reduce(function (n, row) { return n + row.count; }, 0);

  /* Default town skeleton, sized from the census it has to house — not from a
   * re-rounding of the population, which is how a hamlet ended up with more flats than
   * tenants. Housing slots add up to exactly (residents − ward beds): patients live in
   * the hospital, everyone else in one of the four §4.1 building types, keeping the
   * documented mix (courtyard 12 / slab 350 / terrace 178 / point at the remainder).
   *
   * Facility capacities are the peak-concurrency figures — §4.1 for W1's town, §4.5
   * for the W1.5 expansion — and they grow proportionally for a bigger crowd.
   *
   * `open` is the weekend policy (§4.4.2) and it is the one field the renderer will
   * want too: 'daily' never shuts, 'sat-am' trades Saturday morning only (the bank
   * counter), 'weekday' shuts for both days (schools, the sub-district office, the
   * towers, the workshop). A shut building is not an empty one — the duty roster in
   * resident-plan keeps one 运维 person in each, which is why W2's window lights read
   * the same field instead of guessing from the hour.
   *
   * W1.5 (§4.4) adds the eight new lot programmes (primary / secondary / university /
   * library / workshop / depot / market / annex-mall), the fourth tower and the two
   * non-lot functions: the riverside night market and three ground-floor clinics that
   * hang off the residential blocks through `annexClinic`. W1.5c (§4.4.1) adds four
   * more posts that still do not cost a lot — the police 警务室 and the garbage yard
   * annexed to their hosts by `annexOf`, the bank as the *podium* (low floors) of
   * t-two, and the sub-district office on the same promenade as the night market.
   * That makes 24 lots (23 ledger buildings + the sports ground, which the data layer
   * has no use for), 6 annexes, 2 waterfront functions, 31 buildings. Ids keep their
   * prefix by domain — c- civic/commercial, i- industrial, h- housing, t- office
   * tower — so W1.5b can bind them to lots without renaming anything. */
  function defaultBuildings(census) {
    var rows = census && census.length ? census : CENSUS;
    var population = rows.reduce(function (n, row) { return n + row.count; }, 0);
    var patients = rows.reduce(function (n, row) { return row.role === 'patient' ? n + row.count : n; }, 0);
    var scale = population / CENSUS_TOTAL;
    var homes = Math.max(4, population - patients);
    var courtyard = Math.min(homes, Math.max(4, Math.round(12 * homes / 970)));
    var slab = Math.min(homes, Math.max(20, Math.round(350 * homes / 970)));
    var terrace = Math.min(homes, Math.max(10, Math.round(178 * homes / 970)));
    var point = Math.max(1, homes - courtyard - slab - terrace);
    var facility = function (base) { return Math.max(1, Math.round(base * scale)); };
    return [
      { id: 'h-courtyard', kind: 'housing', type: 'courtyard', capacity: courtyard },
      { id: 'h-slab', kind: 'housing', type: 'slab', capacity: slab, annexClinic: 'i-clinic-a' },
      { id: 'h-terrace', kind: 'housing', type: 'terrace', capacity: terrace, annexClinic: 'i-clinic-b' },
      { id: 'h-point', kind: 'housing', type: 'point', capacity: point, annexClinic: 'i-clinic-c' },
      { id: 'c-hospital', kind: 'hospital', capacity: facility(100) },
      { id: 'c-primary', kind: 'primary', capacity: facility(200), annexPrecinct: 'c-precinct', open: 'weekday' },
      { id: 'c-secondary', kind: 'secondary', capacity: facility(260), open: 'weekday' },
      { id: 'c-university', kind: 'university', capacity: facility(300), open: 'weekday' },
      { id: 'c-library', kind: 'library', capacity: facility(90) },
      { id: 'i-workshop', kind: 'workshop', capacity: facility(60), open: 'weekday' },
      { id: 'i-depot', kind: 'depot', capacity: facility(55), annexWaste: 'i-waste' },
      { id: 'i-market', kind: 'market', capacity: facility(90) },
      /* The two venues whose crowd is a *habit draw* rather than a payroll — a clinic's
       * catchment is a whole residential block, the night market is what a third of the
       * night-owls pick for supper — cannot be sized from the staff count. Both numbers
       * below come from the same measurement: the peak occupancy of 40 seeds × 3 days,
       * i.e. the worst tail rather than the average town. Clinics peaked at 13 people
       * (cap 16), the night market at 129 (cap 140, which is also what W1.5b's 32 stalls
       * plus 外摆桌 physically holds). */
      { id: 'i-clinic-a', kind: 'clinic', capacity: facility(16), annexOf: 'h-slab' },
      { id: 'i-clinic-b', kind: 'clinic', capacity: facility(16), annexOf: 'h-terrace' },
      { id: 'i-clinic-c', kind: 'clinic', capacity: facility(16), annexOf: 'h-point' },
      /* W1.5c (§4.4.1): three more posts the town was missing, none of which costs a
       * lot. A 1000-person town does not have a police *station*, it has a 警务室 by the
       * school gate, and a garbage transfer yard shares its apron with the freight depot
       * it backs up. Both sit in their host's `annexOf` so W1.5b can place them without
       * re-planning the grid.
       * These four numbers are measured, not guessed, and they came down twice: the
       * first draft of the errand legs stacked the pension queue and the office lunch
       * crowd into the same 90 minutes and drew a 49-person bank, so the office band
       * moved to 14:30 (§6) before these caps were fit. Tail of 40 seeds × 3 days, with
       * headroom above the worst draw: bank 24–43 → 48, civic 18–34 → 40, and the two
       * staff-only venues are flat because a shift roster has no habit in it — precinct
       * 5 every seed (an office with 8 seats, and deliberately no citizen at the counter
       * yet: nothing in this town reports a crime), waste 7 (the dawn crew of ten). */
      { id: 'c-precinct', kind: 'precinct', capacity: facility(8), annexOf: 'c-primary' },
      { id: 'i-waste', kind: 'waste', capacity: facility(12), annexOf: 'i-depot' },
      { id: 'c-mall', kind: 'mall', capacity: facility(150) },
      { id: 'c-annex-mall', kind: 'annex-mall', capacity: facility(90) },
      { id: 'c-night-market', kind: 'night-market', capacity: facility(140) },
      // The sub-district office is on the bank too, on the hours the food street is
      // shut: counters until 17:00, stalls from 18:00. Same promenade, two shifts.
      { id: 'c-civic', kind: 'civic', capacity: facility(40), waterfront: true, open: 'weekday' },
      { id: 'c-station', kind: 'station', capacity: facility(80) },
      // The park is sized for its real public — a quarter of the 130 schoolchildren after
      // class, and the same band on a Sunday afternoon — not for the adult leisure ledger,
      // which only ever spills a handful of grandparents into it (§4.4.2).
      { id: 'c-amusement', kind: 'amusement', capacity: facility(60) },
      // §4.4.2 grew the three outdoor venues: the plaza and both parks were sitting on
      // their own 85% ceiling every weekday (§4.5 deviation 1), and their seats are what
      // keep the amusement park from becoming a retirees' hangout. Pavement, benches and
      // trees are the cheapest capacity in town, which is why the growth went here rather
      // than into the library's 90 reading seats.
      { id: 'c-plaza', kind: 'plaza', capacity: facility(100) },
      { id: 'c-park-a', kind: 'park', capacity: facility(90) },
      { id: 'c-park-b', kind: 'park', capacity: facility(90) },
      { id: 't-one', kind: 'tower', capacity: facility(90), open: 'weekday' },
      { id: 't-two', kind: 'tower', capacity: facility(90), annexBank: 'c-bank', open: 'weekday' },
      { id: 't-three', kind: 'tower', capacity: facility(90), open: 'weekday' },
      { id: 't-four', kind: 'tower', capacity: facility(90), open: 'weekday' },
      // A bank branch is not a lot, it is the low floors of one: `podium` tells W1.5b
      // to build this as storeys 1–3 of its host rather than as a pad beside it.
      { id: 'c-bank', kind: 'bank', capacity: facility(48), annexOf: 't-two', podium: true, open: 'sat-am' }
    ];
  }

  function randInt(rng, low, high) {
    return low + Math.floor(rng() * (high - low + 1));
  }

  function shuffled(rng, list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* Scale the census toward a requested size by largest remainder, so ratios hold and
   * the sum is exact. Night duty is the one floor that is not negotiable — a 50-person
   * hamlet still needs someone in the ward at 03:00 (镜头③ depends on it) — so doctors
   * and nurses are topped up from the largest row when proportional maths rounds them
   * out of existence. */
  function scaledCensus(size) {
    if (size === CENSUS_TOTAL) return CENSUS.map(function (row) { return Object.assign({}, row); });
    var exact = CENSUS.map(function (row) { return row.count * size / CENSUS_TOTAL; });
    var counts = exact.map(Math.floor);
    var rest = size - counts.reduce(function (n, v) { return n + v; }, 0);
    var order = exact.map(function (value, i) { return { i: i, frac: value - Math.floor(value) }; })
      .sort(function (a, b) { return b.frac - a.frac || a.i - b.i; });
    for (var k = 0; rest > 0 && order.length; k = (k + 1) % order.length, rest--) counts[order[k].i] += 1;
    var floor = size >= 24 ? 3 : 1;
    ['medical-doc', 'medical-nurse'].forEach(function (role) {
      var idx = CENSUS.findIndex(function (row) { return row.role === role; });
      while (counts[idx] < floor) {
        var donor = counts.indexOf(Math.max.apply(null, counts));
        if (donor === idx || counts[donor] <= 1) break;
        counts[donor] -= 1;
        counts[idx] += 1;
      }
    });
    return CENSUS.map(function (row, i) { return Object.assign({}, row, { count: counts[i] }); });
  }

  function indexBuildings(buildings) {
    var byId = {}; var byKind = {};
    buildings.forEach(function (b) {
      byId[b.id] = Object.assign({ residents: [], workers: 0 }, b);
      (byKind[b.kind] = byKind[b.kind] || []).push(byId[b.id]);
    });
    return { byId: byId, byKind: byKind };
  }

  /* Per-row workplace plan (§4.5): the ordered kind each of this row's people goes to.
   *
   * `workQuota` is written for the 1000-person town and scaled to the row's actual
   * headcount by largest remainder, so a 200-person village gets a proportionally
   * small market crew instead of a rounding artefact. Kinds with no building in this
   * town drop out and their share is redistributed; a row whose town cannot host any
   * of its kinds returns null and the caller falls back to plain round-robin. */
  function workSlots(row, index) {
    if (!row.work || !row.workQuota) return null;
    var available = row.work.filter(function (kind) { return (index.byKind[kind] || []).length > 0; });
    if (!available.length) return null;
    var total = available.reduce(function (n, kind) { return n + (row.workQuota[kind] || 0); }, 0);
    if (total <= 0) return null;
    var exact = available.map(function (kind) { return (row.workQuota[kind] || 0) * row.count / total; });
    var counts = exact.map(Math.floor);
    var rest = row.count - counts.reduce(function (n, v) { return n + v; }, 0);
    var order = exact.map(function (value, i) { return { i: i, frac: value - Math.floor(value) }; })
      .sort(function (a, b) { return b.frac - a.frac || a.i - b.i; });
    for (var k = 0; rest > 0 && order.length; k = (k + 1) % order.length, rest--) counts[order[k].i] += 1;
    var slots = [];
    available.forEach(function (kind, i) {
      for (var j = 0; j < counts[i]; j++) slots.push(kind);
    });
    return slots;
  }

  // Three-stage allocation per §12-risk7: role band → workplace quota or round-robin →
  // housing fill; nurses and doctors rotate evenly across the three shift windows.
  function create(options) {
    var opts = options || {};
    var seed = (opts.seed === undefined ? 20260818 : opts.seed) >>> 0;
    var size = opts.size || 1000;
    var rng = CityRandom.randomGenerator(seed);
    var census = opts.census ? opts.census.map(function (row) { return Object.assign({}, row); }) : scaledCensus(size);
    var buildings = opts.buildings || defaultBuildings(census);
    var index = indexBuildings(buildings);
    var rr = {}; // per-kind round robin cursors for workplace distribution

    var residents = [];
    census.forEach(function (row) {
      var shiftCursor = 0;
      var slots = workSlots(row, index);
      var pool = !slots && row.work
        ? row.work.map(function (kind) { return index.byKind[kind] || []; })
          .reduce(function (a, p) { return a.concat(p); }, [])
        : null;
      if (row.work && !slots && !pool.length) throw new Error('no building of kind for role ' + row.role);
      for (var i = 0; i < row.count; i++) {
        // Ids are namespaced by trade (`office-037`), not a town-wide counter. Every
        // downstream seed derives from the id — `dayRng(seed, id, day)` picks the day's
        // jitter, `variantOf` picks the habit — so a global counter meant one census edit
        // re-rolled everyone after it: adding these 40 posts would have silently moved
        // ~760 residents onto new schedules and invalidated every measured figure in
        // §4.5. Namespaced ids hold that blast radius to the row that changed, which is
        // also what lets step two key an LLM-authored Plan, and W3 key a fan's seat, to
        // a resident that survives the next census edit.
        var resident = {
          id: row.role + '-' + String(i + 1).padStart(3, '0'),
          ordinal: i + 1,
          role: row.role,
          age: randInt(rng, row.age[0], row.age[1]),
          gender: rng() < 0.5 ? 'M' : 'F',
          birthMonth: 1 + Math.floor(rng() * 12),
          traits: { pace: Math.round((rng() * 0.4 - 0.2) * 100) / 100, sociability: Math.round(rng() * 100) / 100 },
          home: null,
          workplace: null,
          workplaceKind: null,
          shiftIndex: null,
          state: null,
          stateSince: 0
        };
        if (row.shift) {
          resident.shiftIndex = shiftCursor++ % 3;
          resident.shiftWindow = CityDailyClock.SHIFTS[resident.shiftIndex];
        }
        if (row.work) {
          // Within a kind the round robin still spreads people over every building of
          // that kind, which is what puts 45 office workers in each of four towers.
          var building;
          if (slots) {
            var kind = slots[i];
            var candidates = index.byKind[kind];
            var pickKind = (rr[row.role + ':' + kind] || 0) % candidates.length;
            rr[row.role + ':' + kind] = pickKind + 1;
            building = candidates[pickKind];
          } else {
            var pick = (rr[row.role] || 0) % pool.length;
            rr[row.role] = pick + 1;
            building = pool[pick];
          }
          resident.workplace = building.id;
          resident.workplaceKind = building.kind;
          index.byId[building.id].workers += 1;
        }
        residents.push(resident);
      }
    });

    // Names over the whole roster so era and gender layers see every age.
    var names = CityResidentNames.generate(residents.length, rng, residents.map(function (r) {
      return { age: r.age, gender: r.gender };
    }));
    residents.forEach(function (r, i) {
      r.name = names[i].name;
      r.pinyin = names[i].pinyin;
    });

    // Housing fill: patients occupy ward beds first, everyone else is packed into
    // housing buildings in a seeded order so buildings mix ages and roles.
    var housing = shuffled(rng, index.byKind.housing || []);
    var slotCursor = 0;
    var hospital = (index.byKind.hospital || [])[0];
    var unseated = 0;
    shuffled(rng, residents).forEach(function (r) {
      if (r.role === 'patient') {
        if (!hospital) { unseated++; return; }
        r.home = hospital.id;
        index.byId[hospital.id].residents.push(r.id);
        return;
      }
      while (slotCursor < housing.length &&
             index.byId[housing[slotCursor].id].residents.length >= housing[slotCursor].capacity) slotCursor++;
      if (slotCursor >= housing.length) { unseated++; return; }
      var building = index.byId[housing[slotCursor].id];
      r.home = building.id;
      building.residents.push(r.id);
    });
    if (unseated) throw new Error('housing capacity short by ' + unseated);

    // Community clinics (§4.4): a ground-floor surgery belongs to its own block, so
    // "the clinic near home" is a property of where someone lives, not a choice.
    residents.forEach(function (r) {
      var annex = index.byId[r.home] && index.byId[r.home].annexClinic;
      r.clinic = annex && index.byId[annex] ? annex : null;
    });

    // §4.4.1: a police post exists for the school gate next door, so an officer's duty
    // place is the lot their 警务室 is annexed to — that is the 护学岗 at 15:40, the
    // biggest single-venue peak the town has (121 on the school lot). Read off the
    // `annexOf` pointer rather than a hard-coded id so W1.5b can re-bind lots freely.
    residents.forEach(function (r) {
      var venue = index.byId[r.workplace];
      var host = venue && venue.annexOf;
      r.dutyPost = r.role === 'officer' && host && index.byId[host] ? host : null;
      // §4.4.2: does this person's own building rest at the weekend? Read off the
      // building, not the role, so a pupil and their teacher at the same school always
      // agree, and so a bank teller comes out 'sat-am' without the schedule module
      // having to know what a bank is. Residents with no workplace (retirees, children,
      // patients, the idle) are 'daily' — their day never hinges on a counter opening.
      r.venuePolicy = venue && venue.open ? venue.open : 'daily';
    });

    // Leisure-venue ledger: retirees, seniors, students and idlers each get one
    // hangout venue (PLAZA token resolution target), greedily filling headroom
    // (85% of capacity minus that building's workers). Everyone past the ledger
    // stays HOME, and resident-plan rewrites their outing as home leisure — the
    // town honestly reports "half the grans took the day indoors".
    // W1.5 adds the library as the overflow absorber: a reading room is a legitimate
    // all-day venue, and its 90 seats are what took the stay-at-home count down to zero.
    //
    // §4.4.2 and the amusement park. Two facts collide: the ledger hands out
    // floor(cap × 0.85) seats in this order, so **changing any venue's capacity re-seats
    // the whole town**; and the park is a children's venue that no adult's habit really
    // explains. Enlarging it for the weekend children pulled 25 retirees out of the
    // library (peak 67 → 50); putting it last instead seated 101 retirees *in* it, which
    // reads as ninety old people on the ferris wheel on a Tuesday; dropping it left 101
    // residents with no seat anywhere, which is the one outcome the ledger exists to
    // prevent. The way out is to grow the outdoor venues — the plaza and the two parks
    // were pinned at their own 85% ceiling on weekdays anyway (§4.5 deviation 1) — so the
    // park sits last and takes only the overflow: a handful of grandparents with a
    // grandchild, and the 240 children the ledger has never seated (§6).
    var VENUE_ORDER = ['plaza', 'park', 'library', 'amusement'];
    var venues = VENUE_ORDER
      .reduce(function (a, kind) { return a.concat(index.byKind[kind] || []); }, []);
    var venueCursor = 0;
    residents.forEach(function (r) {
      if (['retiree', 'senior', 'student-u', 'unemployed'].indexOf(r.role) < 0) return;
      while (venueCursor < venues.length) {
        var venue = venues[venueCursor];
        var headroom = Math.floor(venue.capacity * 0.85) - venue.workers - (venue.venueUse || 0);
        if (headroom > 0) {
          r.leisureVenue = venue.id;
          venue.venueUse = (venue.venueUse || 0) + 1;
          break;
        }
        venueCursor++;
      }
      if (!r.leisureVenue) r.leisureVenue = 'HOME';
    });

    var rosterResult = CityResidentNames.applyRoster(residents, opts.roster);

    // Token dictionary for resident-plan.js: symbolic outing sites map to the
    // first building of their kind in this town.
    var kinds = {};
    ['mall', 'annex-mall', 'hospital', 'clinic', 'plaza', 'park', 'station', 'amusement',
      'library', 'workshop', 'depot', 'market', 'night-market', 'tower',
      'primary', 'secondary', 'university',
      // W1.5c (§4.4.1): the four new posts. `bank` and `civic` are both targets of the
      // one ADMIN token — a resident picks a counter by habit, not by which town hall is
      // closer, because the data layer has no coordinates to compare.
      'precinct', 'waste', 'bank', 'civic'].forEach(function (kind) {
      var first = (index.byKind[kind] || [])[0];
      if (first) kinds[kind] = first.id;
    });
    // Legacy token kept for templates that still say SCHOOL (the grandparent pick-up
    // run): with the campus split three ways, that errand belongs at the primary school.
    if (!kinds.school) kinds.school = kinds.primary || kinds.secondary || kinds.university;
    var buildingsOut = Object.keys(index.byId).map(function (id) { return index.byId[id]; });

    return {
      seed: seed,
      residents: residents,
      buildings: buildingsOut,
      town: { kinds: kinds, byId: index.byId, byKind: index.byKind, buildings: buildingsOut },
      stats: {
        total: residents.length,
        fans: rosterResult.applied,
        unseatedFans: rosterResult.unseated.length,
        byRole: census.reduce(function (m, row) { m[row.role] = row.count; return m; }, {}),
        byAgeBand: ageBands(residents)
      }
    };
  }

  function ageBands(residents) {
    var bands = { '0-5': 0, '6-12': 0, '13-17': 0, '18-22': 0, '23-35': 0, '36-55': 0, '56-70': 0, '71-90': 0 };
    residents.forEach(function (r) {
      var a = r.age;
      var key = a <= 5 ? '0-5' : a <= 12 ? '6-12' : a <= 17 ? '13-17' : a <= 22 ? '18-22'
        : a <= 35 ? '23-35' : a <= 55 ? '36-55' : a <= 70 ? '56-70' : '71-90';
      bands[key] += 1;
    });
    return bands;
  }

  return {
    CENSUS: CENSUS,
    CENSUS_TOTAL: CENSUS_TOTAL,
    MINUTES_PER_DAY: MINUTES_PER_DAY,
    create: create,
    defaultBuildings: defaultBuildings,
    ageBands: ageBands
  };
});
