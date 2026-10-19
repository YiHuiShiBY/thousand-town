/* The town's programme blocks: three civic landmarks (V2) plus the seven W1.5b
 * programmes the 1000-person ledger still had no geometry for — the eighth new lot
 * of §4.4 is the fourth office tower, and that one is a towerLots entry in
 * city-model.js, not a body here — and the six shared functions that ride on top of
 * somebody else's lot (§4.4/§4.4.1). All of it shares the city's deterministic
 * floor construction clock and the V2 solid-material batches. The thirteen new
 * civic identities share one additional Chinese sign atlas draw call. */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CityFacilities = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  // Night lettering uses restrained identities; architecture keeps its warm wash.
  // Shared with Canvas and waterfront signs so neutral emission preserves the ink.
  function nightSignInk(name) {
    if (/医院|诊所|鲜榨|果饮|环卫/.test(name)) return '#9bddc9';
    if (/警务|物流|卤味/.test(name)) return '#a6c9f5';
    if (/图书|大学|冰粉/.test(name)) return '#bedde9';
    if (/商业|咖啡|烘焙/.test(name)) return '#eebbc7';
    if (/轻工|汽修|炭火|麻辣/.test(name)) return '#e7b29e';
    if (/银行|煎饼/.test(name)) return '#f0d3a0';
    return '#edf4fa';
  }
  // Lot geometry of the 4x6 board. `index = row*4 + col`, row 0 is the north row
  // (z = -200) and row 5 the south one; these are the same numbers city-model.js
  // publishes, repeated here because every site below is addressed by cell.
  var XS = [-132, -60, 60, 132], ZS = [-200, -120, -40, 40, 120, 200];
  function lotCentre(index) { return { x: XS[index % 4], z: ZS[Math.floor(index / 4)] }; }
  // Gate side of a footprint, as the unit vector pointing out of that face.
  var GATE = { 'x-': { x: -1, z: 0 }, 'x+': { x: 1, z: 0 }, 'z-': { x: 0, z: -1 }, 'z+': { x: 0, z: 1 } };
  function entranceOf(site) {
    var g = GATE[site.gate];
    return { x: site.x + g.x * ((g.x ? site.w : site.d) / 2 + 2.2), z: site.z + g.z * ((g.x ? site.w : site.d) / 2 + 2.2) };
  }
  // The drawn mass of a lot facility, and the yard left in front of it. `record`
  // (`w`/`d`, centred on the lot) is the envelope the plot frontage wraps with its
  // compound wall; `mass` is what actually stands there, pushed back by `mz` so the
  // strip between the two belongs to the building and not to the street.
  function massOf(spec) { return { w: spec.mw || spec.w, d: spec.md || spec.d, z: spec.mz || 0 }; }
  /* The strip of plot between a mass's gate-facing facade and the record envelope,
   * which is where a programme does everything it does outdoors. */
  function yardDepth(site, mass) {
    var g = GATE[site.gate], onZ = g.z !== 0;
    var reach = onZ ? g.z * mass.z + mass.d / 2 : mass.w / 2;
    return (onZ ? site.d : site.w) / 2 - 1.5 - reach;
  }
  /* Load-time guard on the table below, because every one of these numbers is a
   * promise to two systems that run after this file: the drawn mass has to stand
   * inside its record (plot frontage wraps a compound wall around the record, and a
   * facade on top of that wall is the 楼前被挤掉 symptom Stage 0 just fixed), and the
   * gate side has to keep a yard deep enough for its own porch, drop-off or apron.
   * A site that breaks either is a typo, so it fails here rather than on camera. */
  function checkSites() {
    SITES.forEach(function (site) {
      if (site.mw === undefined && site.mz === undefined) return;  // the three V2 landmarks
      var mass = massOf(site), g = GATE[site.gate], onZ = g.z !== 0;
      var cross = (onZ ? site.w : site.d) - (onZ ? mass.w : mass.d);
      var back = (onZ ? site.d : site.w) / 2 + (onZ ? g.z * mass.z : 0) - (onZ ? mass.d : mass.w) / 2;
      if (cross < .9 || back < .9) throw new Error(site.facility + ': mass escapes its record envelope');
      if (yardDepth(site, mass) < 6) throw new Error(site.facility + ': yard too shallow to build in');
    });
  }

  var SITES = [
    // The three V2 landmarks: record and mass are equal, which is the V2 shape, so
    // these lots keep their old footprints and their old geometry. The school is the
    // same building under §4.4's name: the ledger split 学校 720 into 小学部 200 /
    // 中学部 260 / 大学 300, and this lot is the middle one ("现 c-school 改名，缩为
    // 中学部"). Only the *kind* moved — `PALETTES.school` and the `facility-school-*`
    // batch names stay, because those are colour-family and batch identities that other
    // kinds borrow and tests read by string. The name keeps V2's 未来 so the campus
    // reads as the same school grown up, not as a new building on the lot.
    { facility: 'mall', label: '商场', name: '星河商场', lot: 14, w: 44, d: 48, floors: 4, gate: 'z-' },
    { facility: 'hospital', label: '医院', name: '城市医院', lot: 7, w: 44, d: 48, floors: 6, gate: 'z-' },
    { facility: 'secondary', label: '中学部', name: '未来中学', lot: 17, w: 44, d: 48, floors: 3, gate: 'x-' },
    /* W1.5b (§4.4): the new programmes, two rows' worth of them. Row 0 is the north
     * row (z = -200) and row 5 the south one, so the gates face the only street each
     * row has: row 0 looks south, row 5 looks north. The eighth block of §4.4 is the
     * fourth office tower, which is a `towerLots` entry in city-model.js (cell 3)
     * rather than a programme of mine. */
    { facility: 'primary', label: '小学部', name: '镇东小学', lot: 0, w: 40, d: 44, mw: 34, md: 32, mz: -5, floors: 3, gate: 'z+' },
    { facility: 'workshop', label: '轻工坊', name: '工匠轻工坊 · 汽修', lot: 1, w: 42, d: 40, mw: 34, md: 28, mz: -4, floors: 2, gate: 'z+' },
    { facility: 'depot', label: '物流场站', name: '镇北物流场站', lot: 2, w: 46, d: 42, mw: 40, md: 30, mz: -5, floors: 2, gate: 'z+' },
    { facility: 'university', label: '大学', name: '千镇大学 · 职校', lot: 20, w: 40, d: 44, mw: 34, md: 32, mz: 3, floors: 4, gate: 'z-' },
    { facility: 'market', label: '农贸批发市场', name: '清晨农贸批发市场', lot: 21, w: 46, d: 42, mw: 40, md: 28, mz: 5, floors: 2, gate: 'z-' },
    { facility: 'library', label: '图书馆文化馆', name: '镇图书馆 · 文化馆', lot: 22, w: 42, d: 42, mw: 34, md: 30, mz: 4, floors: 3, gate: 'z-' },
    { facility: 'annex-mall', label: '小型商业体', name: '南巷商业小体', lot: 23, w: 40, d: 40, mw: 34, md: 30, mz: 3, floors: 3, gate: 'z-' }
  ];
  var BASE_Y = 1.4;
  var PALETTES = {
    mall: { wall: '#c98775', glass: '#886e59', frame: '#e4c99b' },
    hospital: { wall: '#9ac5af', glass: '#557f69', frame: '#f1ecdb' },
    school: { wall: '#e6c47c', glass: '#92734d', frame: '#a55f48' },
    // The B5 sample gets its own restrained palette. Keeping this separate from the
    // school family prevents the sample pass from recolouring the primary school,
    // university or library before their later expansion round.
    secondary: { wall: '#eee8d9', glass: '#829b94', frame: '#d7cbb7' }
  };
  /* Retain the three legacy landmark identities in their named window batches.
   * New programme surfaces reuse the solid batches with resolved civicPalette
   * instance tints, so adding a fourth glass batch is unnecessary. */
  function paletteFor(kind) {
    if (!PALETTES[kind]) PALETTES[kind] = PALETTES[{
      // `secondary` is spelled out even though the `|| 'school'` default would land in
      // the same place: this file's whole colour argument is "nobody gets a fourth
      // palette", and an alias that works only by falling through a default is a claim
      // nobody can read off the page.
      secondary: 'school',
      primary: 'school', university: 'school', library: 'school',
      workshop: 'mall', market: 'mall', 'annex-mall': 'mall', depot: 'hospital',
      clinic: 'hospital', precinct: 'hospital', waste: 'hospital', bank: 'mall'
    }[kind] || 'school'];
    return PALETTES[kind];
  }
  /* §4.4.1's shared functions plus §4.4's three ground-floor surgeries.
   * An annex is never a city.buildings entry: as a building the plot frontage would
   * hand it its own compound wall, and a police kiosk behind a fence is a joke.
   * What it does instead is stand *on its host*: the clinic serves that one block,
   * the kiosk hugs the school's flank, the bank is the tower's low floors. So an
   * `dx`/`dz` here is a **host-local** offset, and the record's place is not its own
   * property: `annexAt()` below is the only formula that turns (host, offset) into a
   * position, so `x`, `z` and `footprint` are values it wrote and anything that wants
   * the answer elsewhere re-runs it. Every reader — the record, the renderer, the
   * reserved ground, the camera — goes through that one formula. Storing an absolute x
   * beside a second expression that recomputed it was the bug this replaces: the
   * recorded number and the drawn number disagreed, and when a layout swap moved the
   * host the record stayed behind, which is how a clinic ended up standing in the night
   * market (§4.4.1 换地). `hostLot` is only an authoring address — where the host was
   * seeded — never a position.
   * The bank is the one genuinely new placement mode the stage needed: `podium`
   * storeys that share part of their host's footprint rather than standing beside
   * it, which is what "银行在写字楼的低楼层" actually looks like. */
  var ANNEXES = [
    // Offsets are measured against the 46x50 envelope city-housing-plan.js gives a
    // block, and clear of its wings by the 2.4 units those wings spend on balconies
    // and cornices, so no surgery clips a staircase and none stands in a courtyard.
    // `checkAnnexes` keeps both halves of that promise, because the corridor mirror
    // moves an annex to the *mirrored* offset and it has to be as well sited there.
    { id: 'i-clinic-a', facility: 'clinic', label: '社区诊所', name: '花园板楼诊所', hostLot: 10, hostKind: 'housing',
      dx: 19.4, dz: -20, w: 7, d: 9, floors: 1, gate: 'x+' },
    { id: 'i-clinic-b', facility: 'clinic', label: '社区诊所', name: '退台公寓诊所', hostLot: 13, hostKind: 'housing',
      dx: 17.6, dz: -13.4, w: 8, d: 10, floors: 1, gate: 'x+' },
    { id: 'i-clinic-c', facility: 'clinic', label: '社区诊所', name: '双塔住区诊所', hostLot: 15, hostKind: 'housing',
      dx: -8, dz: 15, w: 8, d: 10, floors: 1, gate: 'x-' },
    { id: 'c-precinct', facility: 'precinct', label: '警务室', name: '镇东小学警务室', hostLot: 0, hostKind: 'facility',
      dx: 14, dz: 16, w: 10, d: 9, floors: 1, gate: 'z+' },
    { id: 'i-waste', facility: 'waste', label: '垃圾站', name: '货站转运垃圾站', hostLot: 2, hostKind: 'facility',
      dx: -17, dz: 16, w: 11, d: 8, floors: 1, gate: 'x+' },
    // The branch is the low floors of the tower it belongs to. Its footprint is
    // derived from the host at decorate time (towers are seeded), and it is the one
    // annex that reaches past its host's envelope, so it reserves that ground away
    // from the tower's shop ring (see city-places.js).
    //
    // `t-two` is a ledger id and the map has no `t-*`, so the binding needs a written
    // convention: **t-one…t-four follow the declaration order of `towerLots` in
    // city-model.js**, which since the fourth tower took lot 3 is [3, 5, 6, 9] — so
    // t-two is lot 5 (B2, x=-60 / z=-120). `tests/tools/audit-map-ledger.cjs` sorts
    // towers by lot index for the same reason; if `towerLots` is ever reordered, this
    // number is the one to re-check, because §4.5's "1–3 层是银行裙房" is a promise
    // about t-two specifically, not about whichever tower happens to be second.
    { id: 'c-bank', facility: 'bank', label: '银行', name: '镇北银行 · 写字楼支行', hostLot: 5, hostKind: 'tower',
      floors: 3, podium: true, depth: 4, gate: 'z-', reserve: true }
  ];
  // Every kind in both tables resolves to one of the three landmark palettes, so a
  // tinted instance of any new block reuses a colour the V2 batches already carried.
  SITES.concat(ANNEXES).forEach(function (entry) { paletteFor(entry.facility); });
  checkSites();

  /* Which generated building an annex is bolted to, by id:
   * - a tower host is the lot's glass building, which nothing replaces later;
   * - a facility host is the landmark this file just made, which the filter below
   *   cannot see yet (it runs on the undecorated buildings);
   * - a housing host is the same first building city-housing-plan.js turns into the
   *   block, and the id survives that step.
   * The host is found *only* to be attached to: an annex is nailed to whichever
   * building its id resolves to, wherever that building stands. Measured, not assumed
   * — the claim this replaces was that all three host kinds end up on their lot
   * centre, and they do not: a housing lot that city-housing-plan.js never rebuilt
   * keeps its two seeded halves at ±15 off the centre (b-15-0 at x=117 in the
   * layout-spatial fixture), and that is where an annex of its own has to be drawn. */
  function hostOf(city, annex, placed) {
    var centre = lotCentre(annex.hostLot);
    var inLot = function (building) { return Math.abs(building.x - centre.x) < 28 && Math.abs(building.z - centre.z) < 31; };
    if (annex.hostKind === 'tower') return city.buildings.filter(function (b) { return b.kind === 'glass' && inLot(b); })[0];
    if (annex.hostKind === 'facility') return placed[annex.hostLot];
    return city.buildings.filter(function (b) {
      return inLot(b) && !b.facility && b.kind !== 'glass';
    })[0];
  }

  /* The canal and its riverside market own a band down the middle of the board: the
   * water is |x| < 15 (city-model.js), the market stalls stand at |x| = 31.2 and are
   * 5.4 wide (city-waterfront.js), so their outer face is |x| = 33.9, and the
   * protected river walk — |x| = 23, half-width 1.4 — lies inside that. An annex is a
   * building, not a stall, so nothing of it may stand inboard of 34: a clinic sitting
   * in the night market is five test conflicts and one unreadable corner. */
  var MARKET_BAND = 34;
  /* How far an annex's drawn parts reach past its own mass, taken from the builders
   * below rather than guessed: a gate facing x sends out a yard, three bins and a hood
   * (3 out), a gate facing z only spends its cornice sideways (.8). Applied to *both*
   * faces, so the corridor test is the pessimistic one. */
  var ANNEX_REACH = { gate: 3, flank: .8 };

  function corridorHits(x, half) { return Math.abs(x) - half < MARKET_BAND; }
  // The drawn half-width of an annex across x, which is the axis the band cuts.
  function annexHalfSpan(annex) {
    return annex.w / 2 + (GATE[annex.gate].x ? ANNEX_REACH.gate : ANNEX_REACH.flank);
  }

  /* The ground an annex really holds, including what projects from its own front —
   * the colonnade, the cornice, the top step. `forecourt` is that projection, and it
   * goes only in front: the reservation is what keeps the host's own shop ring and
   * the street furniture out of the bank's forecourt, so getting it wrong by half the
   * depth either swallows a kerb or leaves a shop bay inside the building. */
  function footprintOf(annex, x, z) {
    var g = GATE[annex.gate], forecourt = 4, shoulder = .4, onZ = g.z !== 0;
    var gateAxis = onZ ? annex.d : annex.w, cross = onZ ? annex.w : annex.d;
    return { x: x + g.x * forecourt / 2, z: z + g.z * forecourt / 2,
      w: onZ ? cross + shoulder : gateAxis + forecourt,
      d: onZ ? gateAxis + forecourt : cross + shoulder };
  }

  /* THE one place an annex's position is computed — the single source the record, the
   * renderer, the reserved ground and the camera all read, which is the whole point of
   * the record holding no coordinates. Give it the host as it stands *now*, so it
   * answers correctly before and after `CityLayout.apply` alike: an annex follows its
   * host into whatever cell the layout gave it, because there is no other number to
   * be stale. The mirror is the market-band rule, and it has to live here rather than
   * at decorate time because "is this inboard of 34" is a question about the host's
   * current x, and a swap is exactly when that changes. */
  function annexAt(annex, host) {
    if (!annex || !host) return null;
    var half = annexHalfSpan(annex), dx = annex.dx, dz = annex.dz;
    // Prefer the side the table names; fall back to the other flank of the host.
    if (corridorHits(host.x + dx, half) && !corridorHits(host.x - dx, half)) dx = -dx;
    var x = host.x + dx, z = host.z + dz;
    return { x: x, z: z, dx: dx, dz: dz, w: annex.w, d: annex.d, host: host.id,
      footprint: annex.podium ? footprintOf(annex, x, z) : { x: x, z: z, w: annex.w, d: annex.d } };
  }

  /* Every annex of a city, resolved to where it actually stands in that city. This is
   * what anything outside this file should read — `city.annexes` alone is a table of
   * hosts and offsets, not a table of places. */
  function annexSites(city) {
    return ((city && city.annexes) || []).map(function (annex) {
      var host = ((city && city.buildings) || []).find(function (b) { return b.id === annex.host; });
      var site = annexAt(annex, host);
      return site ? Object.assign({}, annex, site) : null;
    }).filter(Boolean);
  }

  /* Load-time guard on the annex table, the sibling of `checkSites` above. Two
   * promises, both of which the mirror in `annexAt` depends on:
   * ① an offset is tuned to the 46 × 50 block envelope city-housing-plan.js gives a
   *   housing host, so it has to fit at *both* signs — the corridor rule can pick
   *   either flank, and the mirrored one cannot clip a staircase either;
   * ② for every x a host can ever stand at, at least one flank clears the market band.
   *   A host is a lot centre (±60, ±132) or one of the two halves of a split lot (±15
   *   off a centre, city-model.js), so those twelve numbers are the whole population:
   *   testing them all is what makes the band hold in *any* layout rather than only in
   *   the identity one — the bug this file had was a rule that happened to hold there. */
  var HOST_XS = [45, 60, 75, 117, 132, 147];
  /* A podium is the one annex whose width is only known at run time — it wraps a seeded
   * tower — so its guard is written against the widest tower city-model.js can seed
   * (27 + 5 across), plus the .8 wrap and the cornice reach. Towers are never split
   * candidates, so ±60 / ±132 are the only columns it can ever be swapped into. */
  var PODIUM_MAX_HALF = (32 + .8) / 2 + ANNEX_REACH.flank;
  var TOWER_XS = [60, 132];
  function checkAnnexes() {
    ANNEXES.forEach(function (annex) {
      if (annex.podium) {
        TOWER_XS.forEach(function (edge) {
          [-1, 1].forEach(function (sign) {
            if (corridorHits(edge * sign, PODIUM_MAX_HALF)) {
              throw new Error(annex.id + ': no tower column keeps its podium out of the market band');
            }
          });
        });
        return;
      }
      var half = annexHalfSpan(annex);
      if (Math.abs(annex.dx) + annex.w / 2 > 23 || Math.abs(annex.dz) + annex.d / 2 > 25) {
        throw new Error(annex.id + ': leaves the 46x50 block its offsets are tuned to');
      }
      HOST_XS.forEach(function (edge) {
        [-1, 1].forEach(function (sign) {
          var x = edge * sign;
          if (corridorHits(x + annex.dx, half) && corridorHits(x - annex.dx, half)) {
            throw new Error(annex.id + ': neither flank of a host at x=' + x + ' clears the market band');
          }
        });
      });
    });
  }
  // Called here rather than beside `checkSites()`: `checkAnnexes` reads the
  // `PODIUM_MAX_HALF` constant below, and a var that has not been assigned yet is
  // `undefined`, which would turn the podium's band test into `NaN < 34` — a check that
  // passes by never asking.
  checkAnnexes();

  function inLot(building, site) {
    return Math.abs(building.x - site.x) < 28 && Math.abs(building.z - site.z) < 31;
  }

  /* The source building's landing instant is the promise: a landmark always finishes
   * exactly when the block it replaced would have. Compressing twenty storeys of
   * dropping slabs into a three-storey school can, at low skyline and low density,
   * ask for a floor interval shorter than the fall itself — the floors then all
   * touch down at once (楼层瞬开), and an interval that lands on zero or below makes
   * the sample NaN, so the building never caps (永不封顶). §4.4 代价 3 names this and
   * points at city-housing-plan.js:63-70, which has carried the guard since V2:
   * scale interval and fall together, which keeps the landing instant. */
  function landing(first, floors, end, keepsClock) {
    if (keepsClock) return { step: first.step, fallDuration: first.fallDuration };
    var span = end - first.start;
    var step = (span - first.fallDuration) / Math.max(1, floors - 1);
    var fall = first.fallDuration;
    if (!(step > fall / 2)) {
      var ratio = Math.min(2, first.step > 0 ? fall / first.step : 1.6);
      step = span / (floors - 1 + ratio);
      fall = step * ratio;
    }
    return { step: step, fallDuration: fall };
  }

  function decorate(city) {
    if (!city || !Array.isArray(city.buildings)) throw new Error('CityFacilities.decorate requires a city with buildings.');
    var replacements = new Map(), removed = new Set(), facilities = [], placed = {};
    SITES.forEach(function (entry) {
      var site = Object.assign({}, entry, lotCentre(entry.lot));
      var selected = city.buildings.filter(function (building) { return inLot(building, site); });
      if (!selected.length) return;
      var first = selected[0];
      var previousEnd = first.start + (first.floors - 1) * first.step + first.fallDuration;
      var end = Math.min(Number.isFinite(city.duration) ? city.duration : previousEnd, previousEnd);
      var clock = landing(first, site.floors, end,
        first.facility === site.facility && first.floors === site.floors);
      var building = Object.assign({}, first, {
        x: site.x, z: site.z, w: site.w, d: site.d, floors: site.floors, floorHeight: 6,
        kind: 'stone', roof: 'facility', facility: site.facility, label: site.label,
        // Preserve the source building's start, landing duration and final landing.
        step: clock.step, fallDuration: clock.fallDuration
      });
      replacements.set(first, building);
      placed[site.lot] = building;
      selected.slice(1).forEach(function (other) { removed.add(other); });
      var previous = (city.facilities || []).find(function (entry2) { return entry2.id === first.id; });
      facilities.push({
        id: building.id, facility: site.facility, label: site.label, name: site.name,
        x: site.x, z: site.z, w: site.w, d: site.d, floors: site.floors, floorHeight: 6,
        entrance: entranceOf(site),
        sourceIds: previous && previous.sourceIds ? previous.sourceIds.slice() : selected.map(function (other) { return other.id; })
      });
    });
    /* Where each annex actually stands in *this* city, resolved from its host at the
     * same instant the record was built. Only the pre-layout tree clearing reads these;
     * anything living downstream has to re-run `annexAt`, because a layout swap moves
     * the host and an annex has no position of its own to be moved with it. */
    var grounds = [];
    var annexes = ANNEXES.map(function (entry) {
      var annex = Object.assign({}, entry);
      var host = hostOf(city, annex, placed);
      if (!host) return null;
      annex.host = host.id;
      if (annex.podium) {
        /* The base is 0.4 wider than the shaft it wraps. Measured, not eyeballed:
         * the tower's own shop ring keeps 1.35 off its facade and `partClear` wants
         * 0.3 more, so a flank can only be built 0.95 out — 1.2 (the first attempt)
         * took all four bands away from the host and 0.4 leaves three of them while
         * still standing clear of the glass, which would z-fight a coplanar face.
         * What the base really claims is the street side: it covers the tower's near
         * half and projects `depth` past its facade, the one place an annex reaches
         * outside its host. That ground is reserved in city-places.js, so the bank
         * owns its own frontage and the tower keeps shops on the other three sides. */
        annex.w = host.w + 0.8; annex.d = host.d / 2 + annex.depth;
        annex.dx = 0; annex.dz = -(host.d / 4 + annex.depth / 2);
      }
      /* The host, not the lot centre, is the anchor, and `annexAt` is the only formula
       * that turns (host, offset) into ground — so the record holds the host and the
       * offset and nothing else. Anchoring to the host rather than to
       * `lotCentre(hostLot)` is the measured half of the fix: a housing lot
       * city-housing-plan.js never rebuilt still holds its two seeded halves ±15 off
       * the centre, and an annex of that block belongs beside the wall it serves, not
       * in the empty courtyard the centre would have put it in. Writing the position
       * into the record as well was the other half: `CityLayout.apply` translates
       * buildings and never annexes, so a stored x was correct until the first swap and
       * wrong afterwards, which is how a clinic's record ended up in the night market
       * while its body stood elsewhere. What is kept is `footprint` — the ground as it
       * is *before* any layout, which is exactly what the reservation in
       * city-places.js needs, because that list does get translated. */
      var at = annexAt(annex, host);
      annex.dx = at.dx; annex.dz = at.dz;
      annex.floorHeight = 6;
      /* The ground an annex really holds, including what projects from its front:
       * the colonnade, the cornice, the top step. This is what gets reserved. */
      annex.footprint = at.footprint;
      grounds.push(at);
      return annex;
    }).filter(Boolean);
    return Object.assign({}, city, {
      buildings: city.buildings.filter(function (building) { return !removed.has(building); }).map(function (building) {
        return replacements.get(building) || building;
      }),
      trees: (city.trees || []).filter(function (tree) {
        // Include shallow door canopies and the projecting cornices as well as the walls.
        var clear = facilities.concat(grounds);
        return !clear.some(function (site) {
          return Math.abs(tree.x - site.x) < site.w / 2 + tree.r + 3 &&
            Math.abs(tree.z - site.z) < site.d / 2 + tree.r + 3;
        });
      }),
      facilities: facilities,
      annexes: annexes
    });
  }

  // The same local boxes feed Three.js and Canvas. No positions, clocks or ledger
  // identities are stored here: the caller resolves the building and its host.
  function civicPalette(kind) {
    var walls={secondary:'#eee8d9',primary:'#eee3d2',university:'#e5dfd2',library:'#eee8d9','annex-mall':'#d7b5a0',
      bank:'#e5decc',clinic:'#e3e7dc',precinct:'#e6e7dc',waste:'#d7dfcf',
      workshop:'#ddd6c9',depot:'#dfded4',market:'#e7dccb'};
    return walls[kind]?{wall:walls[kind],glass:'#829b94',frame:kind==='secondary'?'#d7cbb7':'#f0ebdf'}:null;
  }
  function architectureParts(building, spec) {
    spec = spec || SITES.find(function(s){return s.facility === building.facility;}) || building;
    var kind=building.facility, styles={
      'annex-mall':'neighborhood-arcade',bank:'stone-banking-hall',precinct:'blue-white-police',
      waste:'sorted-service-station',clinic:'community-care',market:'covered-produce-market',
      depot:'loading-terminal',workshop:'sawtooth-workshop',library:'reading-gallery',
      university:'college-colonnade',primary:'brick-primary-campus',secondary:'warm-secondary-campus'
    };
    var parts=[],features=[],signs=[],style=styles[kind],palette=civicPalette(kind);
    if(!style)return {style:null,features:features,parts:parts,signs:signs,palette:palette};
    var mass=massOf(spec),g=GATE[spec.gate||'z-'],onZ=!!g.z,dir=onZ?g.z:g.x;
    var facade=onZ?mass.z+dir*mass.d/2:dir*mass.w/2;
    var across=onZ?mass.w:mass.d,floors=building.floors||spec.floors||1;
    var cream='#eee8d9',sand='#d7cbb7',sage='#789181',dark='#50675f',brick='#b17658',blue='#355d7c';
    function add(feature,floor,x,y,z,w,h,d,material,tint,tilt){
      if(features.indexOf(feature)<0)features.push(feature);
      var p={feature:feature,floor:floor,x:x,y:y,z:z,w:w,h:h,d:d,material:material||'white'};
      p.color=tint||({glass:palette.glass,cross:'#c9493c',gold:'#d5ba83',green:'#347b5d',
        paving:'#d9e4e8',ivory:PALETTES.school.wall,silver:PALETTES.mall.wall,white:PALETTES.hospital.wall}[p.material]);
      if(tint)p.tint=tint;if(tilt)p.tilt=tilt;parts.push(p);return p;
    }
    function front(feature,floor,out,along,y,w,h,d,material,tint){
      return add(feature,floor,onZ?along:facade+dir*out,y,onZ?facade+dir*out:mass.z+along,
        onZ?w:d,h,onZ?d:w,material,tint);
    }
    function sign(text,floor,out,along,y,w,h,ink,background){
      signs.push({text:text,floor:floor,x:onZ?along:facade+dir*out,y:y,z:onZ?facade+dir*out:mass.z+along,
        w:w,h:h,rotationY:Math.atan2(g.x,g.z),ink:ink||'#38524b',background:background||cream});
    }
    function window(feature,floor,along,y,w,h){
      front(feature+'-frame',floor,.27,along,y,w+.38,h+.35,.24,'white',cream);
      front(feature+'-glass',floor,.43,along,y,w,h,.065,'glass');
      front(feature+'-mullion',floor,.48,along,y,.1,h,.12,'white',sand);
    }
    // Door leaf metadata for both renderers. The frame and mullion stay on the
    // wall; the glass pane carries `door` and swings outward around the hinge.
    // Coordinates are the same local frame every other part uses, so a swapped
    // layout carries them unchanged. Slide doors (secondary lobby) carry a
    // full-open offset along the facade instead of a hinge.
    function leafDoor(along,y,out,wide){
      return onZ
        ? {hinge:[along-wide/2,y,facade+dir*out],angle:-dir*1.45}
        : {hinge:[facade+dir*out,y,mass.z+along-wide/2],angle:dir*1.45};
    }
    function doorway(feature,floor,along,y,w,h){
      front(feature+'-frame',floor,.27,along,y,w+.38,h+.35,.24,'white',cream);
      var leaf=front(feature+'-glass',floor,.43,along,y,w,h,.065,'glass');
      front(feature+'-mullion',floor,.48,along,y,.1,h,.12,'white',sand);
      leaf.door=leafDoor(along,y,.43,w);
    }
    function canopy(feature,out,y,width,depth,tint){
      front(feature,0,out,0,y,width,.28,depth,'white',tint||sage);
      [-1,1].forEach(function(s){front(feature+'-post',0,out+depth/2-.28,s*(width/2-.45),y/2,.3,y,.3,'white',cream);});
    }
    function vent(feature,x,z){
      add(feature,'roof',x,.5,z,1.7,1,1.7,'white',sand);
      add(feature,'roof',x,1.6,z,.85,1.6,.85,'white',dark);
      add(feature+'-cap','roof',x,2.5,z,2.5,.28,2.5,'white',cream);
    }
    if(kind==='annex-mall'){
      [-1,1].forEach(function(s){
        window('shop-display',0,s*10.2,2.55,7.8,4.15);
        front('shop-fascia',0,.66,s*10.2,5.15,9.1,.66,.32,'white',s<0?sage:brick);
        for(var stripe=0;stripe<5;stripe++)front('striped-shop-awning',0,1.55,s*10.2+(stripe-2)*1.72,4.66,1.64,.22,2.55,'white',stripe%2?cream:sand);
      });
      canopy('covered-arcade',1.9,4.75,30.2,3.2,sage);
      [-5,5].forEach(function(x){front('arcade-pier',0,3.05,x,2.3,.4,4.6,.4,'white',cream);});
      for(var level=1;level<floors;level++)for(var bay=-2;bay<=2;bay++){
        window('upper-shop-window',level,bay*5.6,3.25,4.5,3.3);
        front('terrace-rail',level,.75,bay*5.6,1.35,4.8,.2,.2,'white',sage);
      }
    }else if(kind==='bank'){
      for(var level=0;level<floors;level++){
        [-1,1].forEach(function(s){front('stone-entrance-pier',level,.67,s*3.65,2.95,1.05,5.9,.95,'white',cream);});
        for(var joint=0;joint<4;joint++)[-1,1].forEach(function(s){front('stone-joint',level,1.17,s*3.65,.65+joint*1.35,1.04,.035,.035,'white',sand);});
      }
      doorway('bank-vestibule',0,0,2.55,5.8,4.5);canopy('bank-porch',1.3,5.48,9.5,2.3,cream);
      front('bank-name-fascia','roof',2.86,0,-.3,across*.76,1.4,.12,'white',cream);
      [-1,1].forEach(function(s){
        var a=s*Math.min(across/2-2.4,7.2);
        front('atm-cabinet',0,.96,a,1.63,1.85,3.26,1.05,'white',sage);
        front('atm-screen',0,1.51,a,2.12,1.16,.92,.08,'white',blue);
        front('atm-keypad',0,1.52,a,1.33,1.15,.3,.09,'white',cream);
        front('atm-slot',0,1.53,a,.93,.65,.1,.1,'white',dark);
      });
    }else if(kind==='precinct'){
      front('police-blue-band',0,.3,0,4.9,across-.7,1.3,.28,'white',blue);
      canopy('police-canopy',1.25,4.36,across-.3,2.1,cream);
      window('duty-window',0,-2.7,2.6,2.5,2.5);
      // A rectangular crest and a tapered three-step tip keep the shield box-batched.
      front('police-shield',0,.58,-3.4,5.08,1.2,1.45,.1,'white',cream);
      for(var tip=0;tip<3;tip++)front('police-shield',0,.59,-3.4,4.34-tip*.15,1.05-tip*.28,.18,.11,'white',cream);
      front('shield-star',0,.66,-3.4,5.23,.23,.6,.05,'white',goldColor());
      front('shield-star',0,.67,-3.4,5.23,.58,.2,.06,'white',goldColor());
    }else if(kind==='waste'){
      front('service-header',0,.29,0,5.22,across-.45,.8,.35,'white',sage);
      for(var louver=0;louver<7;louver++)front('ventilation-louver',0,.38,0,3.45+louver*.18,across-1.5,.065,.18,'white',dark);
      for(var bin=0;bin<4;bin++){
        var a=(bin-1.5)*(across-1)/4,w=(across-1)/4-.14;
        front('sorting-cabinet',0,1.75,a,1.07,w,2.1,1.65,'white',[sage,blue,brick,dark][bin]);
        front('sorting-lid',0,1.78,a,2.18,w+.08,.19,1.73,'white',cream);
        front('sorting-symbol',0,2.61,a,1.4,.44,.44,.045,'white',cream);
      }
      vent('service-exhaust',0,0);
    }else if(kind==='clinic'){
      var a=across/2-1.85;window('waiting-room',0,-a,2.36,2.55,2.75);
      front('medical-header',0,.44,0,5.12,across-.6,.9,.25,'white',cream);
      canopy('accessible-entry',1.3,4.48,Math.min(across-.2,7.8),2.25,sage);
      front('medical-cross',0,.64,a,5.12,.37,.77,.1,'cross');
      front('medical-cross',0,.65,a,5.12,.77,.3,.1,'cross');
      front('clinic-door-frame',0,.5,.35,2.25,2.25,4.2,.22,'white',cream);
      var clinicLeaf=front('clinic-door',0,.64,.35,2.2,1.8,3.7,.06,'glass');
      clinicLeaf.door=leafDoor(.35,2.2,.64,1.8);
      for(var rail=0;rail<2;rail++){
        front('entry-handrail',0,1.4,rail?2.5:-2.5,.98,.12,.12,2.2,'white',sage);
        [0.55,2.25].forEach(function(out){front('entry-handrail',0,out,rail?2.5:-2.5,.48,.1,.96,.1,'white',sage);});
      }
    }else if(kind==='market'){
      canopy('produce-hall-canopy',3.7,5.42,35.8,5.8,sage);
      [-12,0,12].forEach(function(a){doorway('market-door',0,a,2.3,6.4,4.15);});
      [-11,11].forEach(function(a){
        front('produce-counter',0,5.15,a,1.3,7.4,2.6,3.1,'white',sand);
        front('produce-counter-top',0,5.15,a,2.72,7.8,.24,3.4,'white',brick);
        front('stall-signboard',0,6.55,a,4.7,8.1,.7,.18,'white',brick);
        for(var row=0;row<2;row++)for(var crate=0;crate<3;crate++){
          var along=a+(crate-1)*1.8,out=4.4+row*1.5;
          front('produce-crate',0,out,along,3.12,1.6,.58,1.35,'white',row?sage:sand);
          front('produce-goods',0,out,along,3.55,1.32,.24,1.05,'white',crate===1?'#cb974f':'#779a5e');
        }
      });
      [-1,1].forEach(function(s){add('roof-monitor','roof',s*12,2.15,mass.z,5.5,1.15,mass.d-6,'white',cream);});
    }else if(kind==='depot'){
      [-10,0,10].forEach(function(a){
        front('warehouse-door-frame',0,.24,a,2.66,8.25,5.18,.25,'white',cream);
        front('warehouse-roller-door',0,.43,a,2.53,7.65,4.75,.08,'white',dark);
        for(var rib=0;rib<8;rib++)front('roller-door-slat',0,.5,a,.52+rib*.56,7.5,.065,.12,'white',sand);
        front('bay-number',0,.55,a,5.18,1.1,.48,.14,'white',sage);
      });
      canopy('loading-canopy',2.1,5.7,35.2,3.7,sage);
      // The left yard belongs to the attached waste station, so docks stay right.
      [0,10].forEach(function(a){
        front('loading-dock',0,1.8,a,.45,8.3,.9,2.7,'white',sand);
        for(var stripe=0;stripe<6;stripe++)front('dock-safety-mark',0,3.17,a+(stripe-2.5)*1.2,.47,.65,.45,.08,'white',stripe%2?dark:'#d4ab55');
      });
      [-10,0,10].forEach(function(x){add('warehouse-ridge-cap','roof',x,1.9,mass.z,8.8,.35,mass.d-4,'white',cream);});
    }else if(kind==='workshop'){
      for(var level=0;level<floors;level++)for(var bay=-2;bay<=2;bay++){
        window('production-high-window',level,bay*5.6,4.31,4.6,1.6);
        front('factory-pier',level,.37,bay*5.6-2.62,2.9,.42,5.8,.42,'white',sand);
      }
      doorway('workshop-door',0,0,2.05,5.4,3.65);
      canopy('workshop-loading-hood',1.3,4.35,12.8,2.2,sage);
      for(var tooth=0;tooth<5;tooth++){
        var x=(tooth-2)*mass.w/5;
        add('sawtooth-cap','roof',x,2.27,mass.z,mass.w/5-.6,.22,mass.d-1,'white',sage,{z:-.4});
        add('northlight-frame','roof',x+2.45,3.12,mass.z,.14,2.1,mass.d-3,'white',cream);
      }
      [-9,0,9].forEach(function(x){vent('workshop-exhaust',x,mass.z-mass.d/2+3.5);});
    }else if(kind==='library'){
      for(var level=0;level<floors;level++)[-1,1].forEach(function(s){window('reading-room',level,s*9,3.05,11.2,4.35);});
      [-5.8,-4.1,4.1,5.8].forEach(function(a){
        for(var level=0;level<floors;level++)front('book-page-fin',level,.78,a,3,.22,5.75,.86,'white',sand);
      });
      doorway('reading-entry',0,0,2.3,5.4,4.2);
      [-1,1].forEach(function(s){add('open-book-canopy',0,s*3.5,5.35,facade+dir*2.1,7.3,.25,3.5,'white',sage,{z:s*.12});});
      front('reading-bench',0,3.4,10,.66,7.8,.38,1.1,'white',sand);
    }else if(kind==='university'){
      for(var level=0;level<floors;level++){
        [-1,1].forEach(function(s){window('college-band-window',level,s*9.5,3.25,10.2,3.55);});
        front('academic-portal',level,.48,-3.6,3,1.15,5.8,.75,'white',cream);
        front('academic-portal',level,.48,3.6,3,1.15,5.8,.75,'white',cream);
        window('atrium-window',level,0,3.12,5.1,4.8);
      }
      [-12,-8,8,12].forEach(function(a){front('college-colonnade',0,2.35,a,2.9,.75,5.8,.75,'white',cream);});
      front('college-entrance-lintel',0,2.35,0,5.78,29.5,.42,2.3,'white',sand);
      add('college-roof-crown','roof',0,2.1,mass.z,10.4,1.1,7.2,'white',sand);
    }else if(kind==='secondary'){
      // Broad classroom groups replace the old picket-fence rhythm. They sit just
      // inside the existing west facade, so both renderers read two calm teaching
      // wings while the actual gate, footprint and route clearance remain unchanged.
      for(var schoolLevel=0;schoolLevel<floors;schoolLevel++)[-1,1].forEach(function(side){
        var centre=side*10.8;
        front('classroom-group-frame',schoolLevel,-.12,centre,5.5,17.4,.28,.22,'white',sand);
        [-1,1].forEach(function(edge){
          front('classroom-group-frame',schoolLevel,-.12,centre+edge*8.55,2.95,.32,5.1,.22,'white',sand);
        });
      });
      // A recessed blue-grey lobby and a compact timber-coloured porch make the
      // entrance the first read without introducing another door or moving the gate.
      // Two centre-parting leaves instead of one fixed sheet: the lobby door
      // reads as a door at last, and both renderers slide the halves apart.
      [-1,1].forEach(function(side){
        var lobbyLeaf=front('school-entry-glass',0,-.3,side*2.125,2.35,4.25,4.1,.08,'glass');
        lobbyLeaf.door={slide:onZ?[side*4,0]:[0,side*4]};
      });
      [-1,1].forEach(function(side){
        front('school-entry-frame',0,-.1,side*4.45,2.35,.34,4.7,.16,'white',sand);
      });
      front('school-entry-frame',0,-.1,0,4.62,9.25,.34,.16,'white',sand);
      front('school-entry-mullion',0,-.18,0,2.28,.18,4.05,.08,'white',brick);
      front('school-entry-canopy',0,-.62,0,5.04,11.8,.32,1.18,'white',brick);
      front('school-name-board',0,-.18,0,5.43,9.8,1.2,.12,'white',cream);
      sign(spec.name||building.name||'未来中学',0,-.1,0,5.43,9.5,1.02,'#7f5948',cream);

      // The roof reads as a small daylight pavilion rather than another storey. The
      // flag remains a school cue but is deliberately smaller than the former red slab.
      add('school-roof-clerestory','roof',4,1.1,6,16,2.2,9,'white',cream);
      [-1,1].forEach(function(side){
        add('school-roof-window','roof',4+side*8.03,1.1,6,.08,1.25,7,'glass');
      });
      add('school-roof-cap','roof',4,2.32,6,17,.28,10,'white',sand);
      add('school-flag-mast','roof',16.5,3,-16.5,.16,6,.16,'white',dark);
      add('school-flag','roof',18,5.28,-16.5,3,1.15,.08,'white',brick);
      front('school-eave','roof',-.12,0,.24,43.5,.48,.22,'white',sand);
    }else if(kind==='primary'){
      for(var level=0;level<floors;level++){
        for(var bay=-2;bay<=2;bay++)if(level||bay)window('classroom-window',level,bay*5.6,3.25,4.45,3.3);
        [-14,-8.4,-2.8,2.8,8.4,14].forEach(function(a){
          front('brick-classroom-pier',level,.34,a,2.94,.42,5.86,.32,'white',sand);
        });
      }
      doorway('school-door',0,0,2.3,5.4,4.2);
      // The centre entrance stays clear of the police annex.
      [-1,1].forEach(function(s){front('school-gate-pier',0,6.2,s*6.4,2.45,1.15,4.9,1.3,'white',brick);});
      front('school-gate-lintel',0,6.2,0,5.1,14.1,.65,1.5,'white',cream);
      front('school-gate-sign',0,7.01,0,5.1,8.4,.47,.1,'white',brick);
      canopy('school-entry-porch',1.2,4.75,9.8,2,sage);
    }
    // Names are display copy, not a second identity/ledger table. All coordinates
    // remain local to the same resolved mass used by the facade above.
    if(kind==='annex-mall'){
      sign('邻里商业','roof',.08,0,2.05,21.8,1.95);
      sign('邻里便利',0,.84,-10.2,5.15,7.8,.62,cream,sage);
      sign('早餐食堂',0,.84,10.2,5.15,7.8,.62,cream,brick);
    }else if(kind==='bank')sign('社区银行','roof',2.93,0,-.3,across*.71,1.2);
    else if(kind==='precinct')sign('警务室',0,.46,1,4.95,5.3,1.05,cream,blue);
    else if(kind==='waste')sign('环卫站',0,.48,0,5.22,across-1.6,.71,cream,sage);
    else if(kind==='clinic')sign(spec.name||building.name||'社区诊所',0,.58,-.65,5.12,across-2.3,.72);
    else if(kind==='library'||kind==='university')sign(kind==='library'?'社区图书馆':'城市大学','roof',2.83,0,1.5,23,1.95);
    else if(kind!=='secondary'){
      var title={primary:'镇东小学',market:'农贸批发市场',depot:'物流场站',workshop:'工匠轻工坊'}[kind];
      front('civic-name-board','roof',.38,0,1.85,19,2.45,.3,'white',cream);
      sign(title,'roof',.545,0,1.85,18.6,2.1);
    }
    function goldColor(){return '#d9b36b';}
    return {style:style,features:features,parts:parts,palette:palette,signs:signs};
  }

  // These limits are the actual old component envelopes, including the tilted
  // mall skylight bars. Validate the complete pack before removing any fallback.
  var CIVIC_MODULES = [
    { name:'MallEntry', facility:'mall', floor:0, min:[-11,0,-27.2], max:[11,5.2,-22] },
    { name:'MallSkylightFrame', facility:'mall', floor:'roof', min:[-10,.3,-11.5], max:[10,4.2379933,13.5] },
    { name:'HospitalEntry', facility:'hospital', floor:0, min:[-9,0,-27.2], max:[9,5.2,-22] },
    { name:'HospitalServiceScreen', facility:'hospital', floor:'roof', min:[-2.1,.4,-4.6], max:[16.1,4.09,16.6] },
    { name:'SchoolEntry', facility:'secondary', floor:0, min:[-24,0,-6.65], max:[-20.79,5.2,6.65] },
    { name:'SchoolClerestoryFrame', facility:'secondary', floor:'roof', min:[-4.5,0,1], max:[12.5,2.46,11] }
  ];
  function civicAsset() {
    var asset = root.CityCivicAsset;
    if (!asset || !asset.meta || asset.meta.assetId !== 'civic-miniature-v1' || asset.meta.schemaVersion !== 1 ||
        !asset.modules || !Array.isArray(asset.meta.modules) || asset.meta.modules.length !== CIVIC_MODULES.length ||
        Object.keys(asset.modules).length !== CIVIC_MODULES.length) return null;
    function numbers(a, check) {
      if (!(Array.isArray(a) || ArrayBuffer.isView(a)) || !(a.length > 0)) return false;
      // Array#every skips holes; reading every slot rejects them before a
      // Float32Array conversion can silently turn missing vertices into NaN.
      for (var i = 0; i < a.length; i++) if (!Number.isFinite(a[i]) || (check && !check(a[i]))) return false;
      return true;
    }
    var total = 0;
    for (var spec of CIVIC_MODULES) {
      var data = asset.modules[spec.name], definitions = asset.meta.modules.filter(function(m){return m && m.name === spec.name;});
      if (!data || definitions.length !== 1) return null;
      var def = definitions[0], p = data.position, n = data.normal, c = data.color, index = data.index;
      if (def.facility !== spec.facility || def.floor !== spec.floor || !numbers(p) || p.length % 3 ||
          !numbers(n) || n.length !== p.length || !numbers(c,function(v){return v >= 0 && v <= 1;}) || c.length !== p.length ||
          !def.bounds || !numbers(def.bounds.min) || !numbers(def.bounds.max) || def.bounds.min.length !== 3 || def.bounds.max.length !== 3) return null;
      if (index !== undefined && (!numbers(index,function(v){return Number.isInteger(v) && v >= 0 && v < p.length / 3;}) || index.length % 3)) return null;
      var triangles = index === undefined ? p.length / 9 : index.length / 3;
      if (!Number.isInteger(triangles) || triangles < 1 || triangles !== def.triangles || (total += triangles) > 6000) return null;
      var min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
      for (var i = 0; i < p.length; i += 3) {
        var length = n[i]*n[i] + n[i+1]*n[i+1] + n[i+2]*n[i+2];
        if (Math.abs(length - 1) > .02) return null;
        for (var axis = 0; axis < 3; axis++) {
          min[axis] = Math.min(min[axis],p[i+axis]); max[axis] = Math.max(max[axis],p[i+axis]);
        }
      }
      for (var a = 0; a < 3; a++) if (min[a] < spec.min[a] - .0001 || max[a] > spec.max[a] + .0001 ||
          Math.abs(min[a] - def.bounds.min[a]) > .0001 || Math.abs(max[a] - def.bounds.max[a]) > .0001) return null;
    }
    return asset;
  }

  // This independent pack cuts one real room only after every buffer and role
  // range has passed validation. An invalid room must leave the old wall intact.
  function hospitalRoomAsset() {
    var asset = root.CityHospitalRoomAsset, min = [-8.2,.46,-23.55], max = [8.2,5.58,-17.4];
    if (!asset || !asset.meta || asset.meta.assetId !== 'hospital-ward-v1' || asset.meta.schemaVersion !== 1 ||
        asset.meta.facility !== 'hospital' || asset.meta.floor !== 3 || !asset.modules ||
        Object.keys(asset.modules).length !== 1 || !asset.modules.HospitalWard ||
        !Array.isArray(asset.meta.modules) || asset.meta.modules.length !== 1 || !Array.isArray(asset.meta.features)) return null;
    function numbers(a, check) {
      if (!(Array.isArray(a) || ArrayBuffer.isView(a)) || !(a.length > 0)) return false;
      for (var i=0;i<a.length;i++) if (!Number.isFinite(a[i]) || (check && !check(a[i]))) return false;
      return true;
    }
    var data=asset.modules.HospitalWard, p=data.position, n=data.normal, c=data.color, indices=data.index, def=asset.meta.modules[0];
    if (!def || def.name !== 'HospitalWard' || def.facility !== 'hospital' || def.floor !== 3 ||
        !numbers(p) || p.length%3 || !numbers(n) || n.length!==p.length ||
        !numbers(c,function(v){return v>=0&&v<=1;}) || c.length!==p.length ||
        !numbers(indices,function(v){return Number.isInteger(v)&&v>=0&&v<p.length/3;}) || indices.length%3 ||
        indices.length/3!==def.triangles || def.triangles>2500) return null;
    for (var v=0;v<p.length;v+=3) {
      if (Math.abs(n[v]*n[v]+n[v+1]*n[v+1]+n[v+2]*n[v+2]-1)>.02) return null;
      // BufferGeometry bounds include unused vertices too. Check every uploaded
      // coordinate before Float32 conversion, independently of index/metadata.
      for (var axis=0;axis<3;axis++) if (p[v+axis]<min[axis]-.0001 || p[v+axis]>max[axis]+.0001 ||
          !Number.isFinite(Math.fround(p[v+axis]))) return null;
    }
    function boundsMatch(bounds,start,count) {
      if (!bounds || !numbers(bounds.min) || !numbers(bounds.max) || bounds.min.length!==3 || bounds.max.length!==3) return false;
      var lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
      for (var i=start;i<start+count;i++) for (var axis=0;axis<3;axis++) {
        var value=p[indices[i]*3+axis];lo[axis]=Math.min(lo[axis],value);hi[axis]=Math.max(hi[axis],value);
      }
      for (var a=0;a<3;a++) if (lo[a]<min[a]-.0001 || hi[a]>max[a]+.0001 ||
          Math.abs(lo[a]-bounds.min[a])>.0001 || Math.abs(hi[a]-bounds.max[a])>.0001) return false;
      return true;
    }
    if (!boundsMatch(def.bounds,0,indices.length)) return null;
    var end=0,names=new Set(),roles=new Set();
    for (var feature of asset.meta.features) {
      if (!feature || typeof feature.name!=='string' || names.has(feature.name) || typeof feature.role!=='string' ||
          !Number.isInteger(feature.start) || feature.start!==end || !Number.isInteger(feature.count) || feature.count<3 ||
          feature.count%3 || feature.start+feature.count>indices.length || !boundsMatch(feature.bounds,feature.start,feature.count)) return null;
      names.add(feature.name);roles.add(feature.role);end+=feature.count;
    }
    if (end!==indices.length || !['shell','bed','cabinet','curtain'].every(function(role){return roles.has(role);}) ||
        !asset.meta.features.some(function(f){return f.name==='BedLeft'&&f.role==='bed';}) ||
        !asset.meta.features.some(function(f){return f.name==='BedRight'&&f.role==='bed';})) return null;
    return asset;
  }

  function create(THREE, kit, city) {
    if (!root.CityModel || typeof root.CityModel.sampleBuilding !== 'function') throw new Error('CityFacilities requires CityModel.sampleBuilding.');
    if (!city || !Array.isArray(city.buildings)) throw new Error('CityFacilities.create requires a decorated city.');
    kit = kit || {};
    var group = new THREE.Group(); group.name = 'city-facilities';
    var ownedMaterials = [], ownedTextures = [], ownedGeometries = [], meshes = [], labels = [], signMaterials = [], signSurfaces = [], signMode = 'day';
    var batches = new Map(), records = [], annexRecords = [], disposed = false, lastTime = null;
    var lightAnchors = [], capturingWindow=false, capturingEntry=false;
    var townView = null, townBindings = null, lightPanes = [], lightMesh = null, lightsKey = null;
    var doorLeaves = [];
    var doorMatrix = new THREE.Matrix4(), doorRotation = new THREE.Matrix4(),
        doorTranslation = new THREE.Matrix4(), doorLocal = new THREE.Matrix4();
    var civicSignMesh = null, civicSigns = [];
    var refinedAsset = civicAsset(), refinedMaterial = null, refinedGeometries = {};
    var refinedActive = [], refinedTriangles = 0;
    var roomAsset=hospitalRoomAsset(), roomGeometry=null, roomMaterial=null, roomGlass=null, roomPane=null;
    var roomLevels=[0,0,0], roomDaylight=1, roomActive=false, roomTriangles=0;
    var statistics = { buildings: 0, floorInstances: 0, fallingInstances: 0, roofInstances: 0, drawCalls: 0, triangles: 0 };
    var unitBox = new THREE.BoxGeometry(1, 1, 1); ownedGeometries.push(unitBox);
    var matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3(1, 1, 1);
    var rotation = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);

    function material(name, color, base, parameters) {
      var result = base ? base.clone() : new THREE.MeshStandardMaterial();
      result.name = 'facility-' + name; result.color.set(color);
      Object.assign(result, { roughness: .68, metalness: .06 }, parameters || {});
      ownedMaterials.push(result); return result;
    }
    // Stable batch names keep existing integrations intact; each landmark now
    // has its own warm/green palette, including tinted window and frame instances.
    var silver = material('mall-silver', PALETTES.mall.wall, kit.stone, { roughness: .69, metalness: .09 });
    var white = material('hospital-white', PALETTES.hospital.wall, kit.stone, { roughness: .76 });
    var ivory = material('school-ivory', PALETTES.school.wall, kit.stone, { roughness: .84 });
    var trim = material('white-frames', '#ffffff', kit.metal, { roughness: .52, metalness: .2 });
    var glass = material('blue-glass', '#ffffff', kit.glass, { roughness: .23, metalness: .13 });
    var gold = material('mall-gold', '#d5ba83', kit.metal, { roughness: .41, metalness: .48 });
    var green = material('medical-green', '#347b5d', null, { roughness: .6 });
    // The medical cross is red, which is what a hospital sign reads as; the rest of
    // the hospital stays mint and ivory. Colours go through setValues here, so no
    // emissive string is passed: this helper assigns parameters directly.
    var cross = material('medical-cross', '#c9493c', null, { roughness: .56, metalness: .04 });
    var terracotta = material('school-terracotta', '#a95f47', null, { roughness: .88 });
    var instanceColors = {};
    Object.keys(PALETTES).forEach(function (kind) {
      instanceColors[kind] = { glass: new THREE.Color(PALETTES[kind].glass), frame: new THREE.Color(PALETTES[kind].frame) };
    });
    var windowGlow = material('town-windows', '#ffdea6', null, { emissive:new THREE.Color('#ffd69a'), emissiveIntensity:1.4, roughness:.72, metalness:0 });
    var paving = kit.pavement || material('paving', '#d9e4e8');
    if (refinedAsset) {
      refinedMaterial = material('refined-civic', '#ffffff', null,
        { roughness:.78, metalness:.04, vertexColors:true, transparent:false, opacity:1, depthWrite:true });
      CIVIC_MODULES.forEach(function(spec) {
        var data = refinedAsset.modules[spec.name], geometry = new THREE.BufferGeometry();
        ownedGeometries.push(geometry);
        ['position','normal','color'].forEach(function(key) {
          geometry.setAttribute(key,new THREE.BufferAttribute(new Float32Array(data[key]),3));
        });
        if (data.index !== undefined) geometry.setIndex(Array.from(data.index));
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        refinedGeometries[spec.name] = geometry;
      });
    }
    if (roomAsset) {
      roomMaterial=material('hospital-interior','#ffffff',null,{roughness:.87,metalness:0,vertexColors:true,
        emissive:new THREE.Color('#ffffff'),emissiveIntensity:.18});
      // Interior fill follows the existing light selection. Multiplying by the
      // authored vertex colour preserves bed/curtain colours instead of white glow.
      roomMaterial.onBeforeCompile=function(shader){
        shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif');
      };
      roomMaterial.customProgramCacheKey=function(){return 'hospital-ward-vertex-fill-v1';};
      roomGlass=material('hospital-interior-glass','#d7e9e4',null,
        {roughness:.18,metalness:.02,transparent:true,opacity:.13,depthWrite:false});
      roomPane=new THREE.PlaneGeometry(1,1);ownedGeometries.push(roomPane);
      roomGeometry=new THREE.BufferGeometry();ownedGeometries.push(roomGeometry);
      var roomData=roomAsset.modules.HospitalWard;
      ['position','normal','color'].forEach(function(key){roomGeometry.setAttribute(key,new THREE.BufferAttribute(new Float32Array(roomData[key]),3));});
      roomGeometry.setIndex(Array.from(roomData.index));roomGeometry.computeBoundingBox();roomGeometry.computeBoundingSphere();
    }
    function hasRoom(record,floor) {
      var b=record.building;
      return !!roomAsset&&b.facility==='hospital'&&floor===3&&b.floors>3&&b.w===44&&b.d===48&&b.floorHeight===6;
    }
    function addHospitalRoom(record) {
      if(!hasRoom(record,3))return;
      if(!batches.has('hospital-ward'))batches.set('hospital-ward',{material:roomMaterial,geometry:roomGeometry,
        triangles:roomGeometry.index.count/3,room:true,parts:[],mesh:null});
      batches.get('hospital-ward').parts.push({record:record,floor:3,local:new THREE.Matrix4()});
    }
    function setInteriorLights(levels) {
      if(disposed||!roomAsset)return;
      for(var i=0;i<3;i++)roomLevels[i]=Math.max(0,Math.min(1,Number(levels&&levels[i])||0));
      roomMaterial.emissiveIntensity=.18*roomDaylight+.62*Math.max.apply(Math,roomLevels);
    }
    function setInteriorDaylight(daylight) {
      if(disposed||!roomAsset||!Number.isFinite(daylight))return;
      roomDaylight=Math.max(0,Math.min(1,daylight));setInteriorLights(roomLevels);
    }
    function addRefined(record) {
      if (!refinedAsset) return;
      CIVIC_MODULES.forEach(function(spec) {
        if (spec.facility !== record.building.facility) return;
        var key = 'civic-' + spec.name, geometry = refinedGeometries[spec.name];
        if (!batches.has(key)) batches.set(key,{material:refinedMaterial,geometry:geometry,
          triangles:(geometry.index ? geometry.index.count : geometry.attributes.position.count)/3,
          module:spec.name,parts:[],mesh:null});
        batches.get(key).parts.push({record:record,floor:spec.floor,local:new THREE.Matrix4()});
      });
    }

    // A box's transform is local to one floor (or the completed roof). All boxes
    // of a material share one InstancedMesh across all landmarks and annexes.
    function lightPane(record, floor, x, y, z, w, h, d) {
      if (record.building.facility === 'hospital' || typeof floor !== 'number') return;
      var thinX = w < d, dx = thinX ? Math.sign(x) * (w / 2 + .025) : 0;
      var dz = thinX ? 0 : Math.sign(z) * (d / 2 + .025);
      var local = new THREE.Matrix4().compose(new THREE.Vector3(x + dx, y, z + dz), new THREE.Quaternion(),
        new THREE.Vector3(thinX ? .018 : w * .94, h * .94, thinX ? d * .94 : .018));
      var pane = { record:record, floor:floor, local:local, ordinal:record.lightPanes ? record.lightPanes.length : 0 };
      if (!record.lightPanes) record.lightPanes = [];
      record.lightPanes.push(pane); lightPanes.push(pane);
    }
    function box(record, floor, x, y, z, w, h, d, mat, tilt) {
      if((mat===glass||mat===roomGlass||capturingWindow||capturingEntry)&&typeof floor==='number'&&Math.min(w,d)<.8){
        var anchor={building:record.building,host:record.host||record.building,ledgerId:record.annex?record.annex.id:record.building.ledgerId,
          floor:floor,layer:capturingEntry?'entry':null,local:[x,y,z,w+(w<d?.05:0),h,d+(d<w?.05:0)]};
        if(mat===roomGlass)anchor.interior={id:'hospital-ward',bay:Math.round(x/5.7)+1};
        lightAnchors.push(anchor);
      }
      if (mat === glass) lightPane(record, floor, x, y, z, w, h, d);
      var key = mat.uuid;
      if (!batches.has(key)) batches.set(key, { material: mat, geometry:mat===roomGlass?roomPane:unitBox,
        triangles:mat===roomGlass?2:12, parts: [], mesh: null });
      var quaternion = new THREE.Quaternion();
      if (tilt) quaternion.setFromEuler(new THREE.Euler(tilt.x || 0, tilt.y || 0, tilt.z || 0));
      if(mat===roomGlass)quaternion.setFromAxisAngle(up,Math.PI);
      var local = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), quaternion, new THREE.Vector3(w, h, mat===roomGlass?1:d));
      var part = { record: record, floor: floor, local: local,
        tint: mat === glass ? instanceColors[record.building.facility].glass :
          mat === trim ? instanceColors[record.building.facility].frame : null };
      var palette=civicPalette(record.building.facility);
      if(palette){
        var target=mat===green?palette.glass:mat===gold?palette.frame:
          mat===silver||mat===white||mat===ivory?palette.wall:null;
        if(target)tintPart(part,mat,target);
      }
      if(mat===roomGlass)part.hospitalWindow={id:'hospital-ward',bay:Math.round(x/5.7)+1};
      batches.get(key).parts.push(part); return part;
    }
    function tintPart(part,mat,color){
      part.tint=new THREE.Color(color);
      part.tint.r/=mat.color.r||1;part.tint.g/=mat.color.g||1;part.tint.b/=mat.color.b||1;
    }
    // A marked leaf keeps its own part inside the solid-material batch it already
    // belongs to; refreshDoors only overwrites that one instance matrix, so door
    // motion costs no batch and no draw call. Hinge/angle and slide offsets stay
    // in the record's local frame, carried untouched by any layout swap.
    function markDoor(part, batch, meta) {
      if (!part || !batch) return part;
      part.door = meta;
      meta.batch = batch; meta.record = part.record; meta.floor = part.floor;
      meta.ledger = part.record.annex ? part.record.annex.id : part.record.building.id;
      meta.index = -1; meta.travel = 0;
      doorLeaves.push(part);
      return part;
    }
    function doorTravelOf(meta) {
      if (!townView || !townView.byBuilding) return 0;
      var ledger = townBindings && townBindings.byMapId && townBindings.byMapId[meta.ledger] || meta.ledger;
      var entry = townView.byBuilding[ledger];
      return entry ? Math.max(0, Math.min(1, Number(entry.doorOpen) || 0)) : 0;
    }
    // Runs from update() — the full instance rewrite would otherwise park every
    // leaf shut — and again from setTownView() once construction has settled and
    // update() early-outs, so minute ticks keep moving the leaves.
    function refreshDoors() {
      if (disposed || !doorLeaves.length) return;
      doorLeaves.forEach(function (part) {
        var meta = part.door;
        if (meta.index < 0 || !meta.batch.mesh) return;
        var travel = doorTravelOf(meta);
        meta.travel = travel;
        if (meta.slide) doorMatrix.makeTranslation(meta.slide[0] * travel, 0, meta.slide[1] * travel);
        else {
          doorMatrix.makeTranslation(-meta.hinge[0], -meta.hinge[1], -meta.hinge[2]);
          doorRotation.makeRotationAxis(up, meta.angle * travel);
          doorMatrix.premultiply(doorRotation);
          doorTranslation.makeTranslation(meta.hinge[0], meta.hinge[1], meta.hinge[2]);
          doorMatrix.premultiply(doorTranslation);
        }
        doorLocal.multiplyMatrices(doorMatrix, part.local);
        matrix.multiplyMatrices(meta.floor === 'roof' ? meta.record.roofMatrix : meta.record.transforms[meta.floor], doorLocal);
        meta.batch.mesh.setMatrixAt(meta.index, matrix);
        meta.batch.mesh.instanceMatrix.needsUpdate = true;
      });
    }
    function buildArchitecture(record,spec) {
      var plan=architectureParts(record.building,spec),roles={white:white,glass:silver,gold:gold,
        cross:cross,green:green,terracotta:terracotta,paving:paving,ivory:ivory,silver:silver};
      record.architecture=plan; record.architecturePieces=0;
      plan.parts.forEach(function(p){
        // Canvas retains the full procedural plan. Only the WebGL draw list drops
        // the opaque entry/frame pieces supplied by the complete Blender pack.
        if (refinedAsset && record.building.facility === 'secondary' &&
            /^(school-entry-frame|school-entry-mullion|school-entry-canopy|school-roof-clerestory|school-roof-cap)$/.test(p.feature)) return;
        var mat=roles[p.material],part=box(record,p.floor,p.x,p.y,p.z,p.w,p.h,p.d,mat,p.tilt);
        part.architecture={id:record.building.id,feature:p.feature,floor:p.floor};
        if(p.door)markDoor(part,batches.get(mat.uuid),p.door);
        record.architecturePieces++;
        // The legacy glass batch belongs to the three landmarks. New shop and
        // civic glazing borrows the existing silver batch, tinted to the
        // same palette, and registers once in the shared snapshot light pool.
        if(p.material==='glass')lightPane(record,p.floor,p.x,p.y,p.z,p.w,p.h,p.d);
        // Resolve final colour for both renderers, compensating the shared base.
        tintPart(part,mat,p.color);
      });
    }
    function corners(record, floor, mat, width) {
      [-1, 1].forEach(function (x) { [-1, 1].forEach(function (z) {
        box(record, floor, x * 21.45, 3, z * 23.45, width, 5.9, width, mat);
      }); });
    }
    function windowRows(record, floor, wall, accent, hospital, recessedWest) {
      // The secondary sample's west face carries a shallow, real recess. Its
      // entrance and grouped trim therefore sit in front of masonry instead of
      // being swallowed by the old full-width box, while the east edge and the
      // building's existing record envelope stay fixed.
      if (hasRoom(record,floor)) {
        // Preserve the floor's exterior mass, cutting a 16.4-wide pocket only
        // behind the three existing windows. The asset supplies the inner shell.
        [-1,1].forEach(function(side){box(record,floor,side*15.1,3,0,13.8,5.82,48,wall);});
        box(record,floor,0,3,3.3,16.4,5.82,41.4,wall);
        box(record,floor,0,5.745,-20.475,16.4,.33,6.15,wall);
        box(record,floor,0,.8825,-23.775,16.4,1.585,.45,wall);
        box(record,floor,0,5.3675,-23.775,16.4,1.085,.45,wall);
        [[-8,.4],[-2.85,1.5],[2.85,1.5],[8,.4]].forEach(function(pier){
          box(record,floor,pier[0],3.25,-23.775,pier[1],3.15,.45,wall);
        });
      } else box(record, floor, recessedWest ? .15 : 0, 3, 0, recessedWest ? 43.7 : 44, 5.82, 48, wall);
      box(record, floor, 0, .23, 0, 44.65, .46, 48.65, accent);
      [-1, 1].forEach(function (side) {
        for (var i = 0; i < 7; i++) {
          var x = (i - 3) * 5.7;
          box(record, floor, x, 3.25, side * 24.08, 4.2, 3.15, .18,
            hasRoom(record,floor)&&side<0&&i>=2&&i<=4?roomGlass:glass);
          box(record, floor, x, 3.25, side * 24.22, .14, 3.19, .14, trim);
          box(record, floor, x, 1.63, side * 24.3, 4.65, .22, .65, wall);
        }
        for (var j = 0; j < 8; j++) {
          if (recessedWest && floor === 0 && side < 0 && (j === 3 || j === 4)) continue;
          var z = (j - 3.5) * 5.6;
          var west=recessedWest&&side<0;
          box(record, floor, west?-21.78:side*22.08, 3.25, z, .18, 3.15, 4.05, glass);
          box(record, floor, west?-21.85:side*22.22, 3.25, z, .14, 3.19, .14, trim);
          if (!hospital) box(record, floor, side * 22.32, 1.63, z, .65, .22, 4.5, wall);
        }
      });
      if (hospital) {
        box(record, floor, -19.1, 3, -24.34, 1.15, 5.85, .42, green);
        box(record, floor, 19.1, 3, 24.34, 1.15, 5.85, .42, green);
      }
      corners(record, floor, wall, .95);
    }
    function parapet(record, mat) {
      box(record, 'roof', 0, .2, 0, 44.9, .4, 48.9, mat);
      [-1, 1].forEach(function (side) {
        box(record, 'roof', 0, .95, side * 24.15, 44.8, 1.1, .48, mat);
        box(record, 'roof', side * 22.15, .95, 0, .48, 1.1, 48.8, mat);
      });
    }
    function frontPorch(record, mat, wide) {
      // One fixed sheet of glazing becomes two centre-parting leaves. They stay
      // in the shared glass batch; the entry light pane it spawns is the lobby
      // light and deliberately keeps its place in the doorway.
      var leafWide = (wide - 2) / 2;
      [-1, 1].forEach(function (side) {
        var leaf = box(record, 0, side * leafWide / 2, 2.2, -24.18, leafWide, 4.35, .35, glass);
        markDoor(leaf, batches.get(glass.uuid), { slide: [side * leafWide * .92, 0] });
      });
      box(record, 0, 0, 2.2, -24.42, .24, 4.4, .16, trim);
      if (!refinedAsset) {
        box(record, 0, 0, 4.95, -24.6, wide, .5, 5.2, mat);
        [-1, 1].forEach(function (side) { box(record, 0, side * (wide / 2 - .6), 2.3, -26.25, .55, 4.6, .55, trim); });
      }
      box(record, 0, 0, -.24, -25.05, wide + 1, .48, 4, paving);
    }
    function paintSign(ctx, name, ink, background, y, height, font, maxWidth, night, lightbox) {
      // Textures repaint only at the day/night boundary. This keeps the original
      // daytime board, and gives the nighttime letters a pale face on a dark board
      // without compiling another shader or adding another draw call.
      ctx.fillStyle = night && !lightbox ? '#071820' : background;
      ctx.fillRect(0, y, 1024, height);
      ctx.fillStyle = night && !lightbox ? nightSignInk(name) : ink;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = font; ctx.fillText(name, 512, y + height / 2, maxWidth);
    }
    function signMaterial(name, texture, roughness) {
      var mat = new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, roughness: roughness, metalness: .02,
        emissive: '#ffffff', emissiveIntensity: 0 });
      mat.name = name;
      ownedMaterials.push(mat); signMaterials.push(mat); return mat;
    }
    function label(record, name, ink, background) {
      if (!root.document || typeof root.document.createElement !== 'function') return;
      var canvas = root.document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
      var context = canvas.getContext('2d'); if (!context) return;
      var mall = record.building.facility === 'mall';
      if (mall) {
        var tubes = context.createLinearGradient(0, 0, 0, 256);
        [[0,'#ded6c4'],[.25,'#fff9ed'],[.5,'#eee4d0'],[.75,'#fff9ed'],[1,'#ded6c4']]
          .forEach(function(stop) { tubes.addColorStop(stop[0], stop[1]); });
        context.fillStyle = tubes; context.fillRect(0, 0, 1024, 256);
        context.fillStyle = ink; context.textAlign = 'center'; context.textBaseline = 'middle';
        context.font = '600 138px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';
        context.fillText(name, 512, 133);
      } else {
        var repaint = function(night) { paintSign(context, name, ink, background, 0, 256,
          '600 138px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif', 960, night, false); };
        repaint(false);
      }
      var texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      texture.name = 'facility-sign-' + record.building.facility; ownedTextures.push(texture);
      if (!mall) signSurfaces.push({texture:texture,repaint:repaint});
      var mat = mall ? new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.94,depthWrite:false,toneMapped:false})
        : signMaterial(texture.name, texture, .74);
      if (mall) { mat.name = texture.name; ownedMaterials.push(mat); }
      var geometry = new THREE.PlaneGeometry(22, 5.5); ownedGeometries.push(geometry);
      [{ x: 0, z: -24.51, ry: Math.PI }, { x: -22.51, z: 0, ry: -Math.PI / 2 }].forEach(function(face) {
        var mesh = new THREE.InstancedMesh(geometry, mat, 1);
        mesh.setMatrixAt(0, new THREE.Matrix4()); mesh.setColorAt(0, new THREE.Color('#ffffff'));
        mesh.name = texture.name;
        mesh.position.set(record.building.x + face.x, BASE_Y + record.building.floors * 6 + 3.45, record.building.z + face.z);
        mesh.rotation.y = face.ry; mesh.visible = false; mesh.userData.buildingId = record.building.id;
        mesh.userData.buildingIds = [record.building.id];
        group.add(mesh); meshes.push(mesh);
        labels.push({record:record,mesh:mesh,local:new THREE.Vector3(face.x,3.45,face.z),lightbox:mall});
      });
    }
    function createCivicSigns(){
      if(!root.document||typeof root.document.createElement!=='function')return;
      allRecords().forEach(function(record){
        if(record.architecture)record.architecture.signs.forEach(function(sign){civicSigns.push({record:record,sign:sign});});
      });
      if(!civicSigns.length)return;
      var canvas=root.document.createElement('canvas'),rows=Math.pow(2,Math.ceil(Math.log2(civicSigns.length)));
      canvas.width=1024;canvas.height=rows*128;
      var ctx=canvas.getContext('2d');if(!ctx){civicSigns.length=0;return;}
      var positions=new Float32Array(civicSigns.length*12),normals=new Float32Array(positions.length);
      var uvs=new Float32Array(civicSigns.length*8),indices=[];
      civicSigns.forEach(function(entry,index){
        var s=entry.sign,y=index*128;
        var top=1-(y+2)/canvas.height,bottom=1-(y+126)/canvas.height;
        uvs.set([.002,top,.998,top,.002,bottom,.998,bottom],index*8);
        var q=new THREE.Quaternion().setFromAxisAngle(up,s.rotationY),n=new THREE.Vector3(0,0,1).applyQuaternion(q);
        entry.vertices=[[-.5,.5],[.5,.5],[-.5,-.5],[.5,-.5]].map(function(p){
          return new THREE.Vector3(p[0]*s.w,p[1]*s.h,0).applyQuaternion(q).add(new THREE.Vector3(s.x,s.y,s.z));
        });
        for(var v=0;v<4;v++)normals.set([n.x,n.y,n.z],index*12+v*3);
        var i=index*4;indices.push(i,i+2,i+1,i+2,i+3,i+1);
      });
      function repaint(night){civicSigns.forEach(function(entry,index){
        var s=entry.sign;
        paintSign(ctx,s.text,s.ink,s.background,index*128,128,
          '600 104px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif',960,night,false);
      });}
      repaint(false);
      var texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
      texture.name='facility-civic-name-atlas';ownedTextures.push(texture);
      signSurfaces.push({texture:texture,repaint:repaint});
      var mat=signMaterial('facility-civic-name-atlas',texture,.84);
      var geometry=new THREE.BufferGeometry();ownedGeometries.push(geometry);
      geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
      geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));geometry.setIndex(indices);
      civicSignMesh=new THREE.InstancedMesh(geometry,mat,1);civicSignMesh.setMatrixAt(0,new THREE.Matrix4());civicSignMesh.name='facilities-civic-sign-atlas';
      civicSignMesh.frustumCulled=false;civicSignMesh.visible=false;
      civicSignMesh.userData.signs=civicSigns.map(function(e){return {id:e.record.building.id,text:e.sign.text};});
      group.add(civicSignMesh);meshes.push(civicSignMesh);
    }
    function updateCivicSigns(){
      if(!civicSignMesh)return;
      var attribute=civicSignMesh.geometry.attributes.position,point=new THREE.Vector3(),visible=0;
      civicSigns.forEach(function(e,index){
        var r=e.record,s=e.sign,roof=s.floor==='roof',shown=roof?r.sample.complete:s.floor<r.sample.builtFloors;
        if(shown)visible++;
        e.vertices.forEach(function(v,i){
          if(shown)point.copy(v).applyMatrix4(roof?r.roofMatrix:r.transforms[s.floor]);else point.set(0,0,0);
          attribute.setXYZ(index*4+i,point.x,point.y,point.z);
        });
      });
      attribute.needsUpdate=true;civicSignMesh.visible=visible>0;
      // Raycaster may have cached the empty construction geometry; keep its broad
      // phase bounds in step with the rebuilt vertices as the city is replayed.
      civicSignMesh.geometry.computeBoundingSphere();civicSignMesh.geometry.computeBoundingBox();civicSignMesh.computeBoundingSphere();civicSignMesh.computeBoundingBox();
      if(visible){statistics.drawCalls++;statistics.triangles+=civicSigns.length*2;}
    }

    /* ---- the shared vocabulary of the W1.5b blocks ----------------------------
     * Nothing below this line adds a material, a geometry or a mesh. The whole
     * budget argument of 拍板 ⑧ is that a new programme is built out of boxes the
     * town already owns, so the eight new blocks are drawn with the six V2 surfaces
     * plus paving, and each one's identity comes from massing, roof kit and yard. */
    function storey(record, level, mass, body, course) {
      box(record, level, 0, 3, mass.z, mass.w, 5.86, mass.d, body);
      box(record, level, 0, .34, mass.z, mass.w + .55, .68, mass.d + .55, course);
    }
    // Recessed shutters on all four faces, never the landmark glass: the tinted
    // batches keep exactly the three colours they had in V2.
    function shutters(record, level, mass, pane) {
      // One shared 18-triangle trim replaces three closed boxes. Wall-facing
      // surfaces are hidden; omitting them also saves the river reflection pass.
      var trimKey='ordinary-window-trim';
      if(!batches.has(trimKey)) {
        var vertices=[],normals=[],uvs=[],indices=[];
        function faces(w,h,d,y,z,keep) {
          var offset=vertices.length/3,a=unitBox.attributes;
          for(var v=0;v<a.position.count;v++) {
            vertices.push(a.position.getX(v)*w,a.position.getY(v)*h+y,a.position.getZ(v)*d+z);
            normals.push(a.normal.getX(v),a.normal.getY(v),a.normal.getZ(v));
            uvs.push(a.uv.getX(v),a.uv.getY(v));
          }
          keep.forEach(function(face){for(var k=0;k<6;k++)indices.push(offset+unitBox.index.getX(face*6+k));});
        }
        faces(3.86,3.86,.22,0,-.05,[4]);
        faces(3.94,.18,.56,-1.79,.09,[0,1,2,3,4]);
        faces(.12,3.48,.12,0,.21,[0,1,4]);
        var geometry=new THREE.BufferGeometry();ownedGeometries.push(geometry);
        geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
        geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
        geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
        geometry.computeBoundingBox();geometry.computeBoundingSphere();
        batches.set(trimKey,{name:'facilities-window-trim',material:gold,geometry:geometry,triangles:18,parts:[],mesh:null});
      }
      function window(x,z,w,d) {
        var thinX=w<d,nx=thinX?Math.sign(x):0,nz=thinX?0:Math.sign(z-mass.z);
        capturingWindow=true;
        box(record,level,x,3.2,z,w,3.5,d,pane);
        capturingWindow=false;
        lightPane(record,level,x,3.2,z,w,3.5,d);
        var local=new THREE.Matrix4().compose(new THREE.Vector3(x,3.2,z),
          new THREE.Quaternion().setFromAxisAngle(up,Math.atan2(nx,nz)),new THREE.Vector3(1,1,1));
        var part={record:record,floor:level,local:local};
        tintPart(part,gold,civicPalette(record.building.facility).frame);batches.get(trimKey).parts.push(part);
      }
      var cols = Math.max(2, Math.round(mass.w / 8)), rows = Math.max(2, Math.round(mass.d / 8));
      var kind=record.building.facility,gate=/^(primary|university|library|workshop|depot|market)$/.test(kind)?SITES.find(function(s){return s.facility===kind;}).gate:null;
      for (var i = 0; i < cols; i++) {
        var x = (i - (cols - 1) / 2) * (mass.w - 4) / cols;
        if(gate!=='z+'){
          window(x, mass.z + mass.d / 2 + .09, 3.5, .2);
        }
        if(gate!=='z-'){
          window(x, mass.z - mass.d / 2 - .09, 3.5, .2);
        }
      }
      for (var j = 0; j < rows; j++) {
        var z = mass.z + (j - (rows - 1) / 2) * (mass.d - 4) / rows;
        window(mass.w / 2 + .09, z, .2, 3.5);
        window(-mass.w / 2 - .09, z, .2, 3.5);
      }
    }
    function column(record, floor, x, z, size, height, mat) {
      box(record, floor, x, height / 2, z, size, height, size, mat);
    }
    function parapetFor(record, mat, w, d, z) {
      z=z||0;
      box(record, 'roof', 0, .2, z, w + .9, .4, d + .9, mat);
      [-1, 1].forEach(function (side) {
        box(record, 'roof', 0, .95, z+side * (d / 2 + .3), w + .8, 1.1, .48, mat);
        box(record, 'roof', side * (w / 2 + .3), .95, z, .48, 1.1, d + .8, mat);
      });
    }
    /* The yard frame: the strip of plot between a mass's gate-facing facade and the
     * record envelope, which is a school's drop-off, a depot's apron and a market's
     * stall yard all at once. `out` is measured from that facade toward the street,
     * `along` across it. Everything a programme does outdoors does it inside this
     * strip, so no yard object can reach a carriageway, a kerb route or a
     * neighbour's compound — which is what §4.4 代价 2 asks of the front band. */
    function frameOf(spec, mass) {
      var g = GATE[spec.gate], onZ = g.z !== 0;
      var facade = onZ ? mass.z + g.z * mass.d / 2 : g.x * mass.w / 2;
      var edge = ((onZ ? g.z * spec.d : g.x * spec.w) / 2) - (onZ ? g.z : g.x) * 1.5;
      return { g: g, onZ: onZ, facade: facade, dir: edge > facade ? 1 : -1,
        span: Math.abs(edge - facade), mass: mass, lateral: onZ ? spec.w : spec.d };
    }
    // An annex's own footprint is its mass, so its frame runs outward from the face.
    function annexFrame(annex) {
      var g = GATE[annex.gate], onZ = g.z !== 0, mass = { w: annex.w, d: annex.d, z: 0 };
      return { g: g, onZ: onZ, facade: onZ ? g.z * annex.d / 2 : g.x * annex.w / 2,
        dir: onZ ? g.z : g.x, span: 3, mass: mass, lateral: onZ ? annex.w : annex.d };
    }
    function at(frame, out, along) {
      var line = frame.facade + frame.dir * out;
      return frame.onZ ? { x: along, z: line } : { x: line, z: frame.mass.z + along };
    }
    function pad(record, frame, o0, o1, a0, a1, mat, height) {
      var spot = at(frame, (o0 + o1) / 2, (a0 + a1) / 2);
      var depth = Math.abs(o1 - o0), wide = Math.abs(a1 - a0);
      box(record, 0, spot.x, height === undefined ? -.24 : height / 2, spot.z,
        frame.onZ ? wide : depth, height === undefined ? .48 : height, frame.onZ ? depth : wide, mat);
    }
    function yardOf(record, frame) {
      pad(record, frame, 0, frame.span, -frame.lateral / 2 + 2.5, frame.lateral / 2 - 2.5, paving);
    }
    // A doorway set into the gate-facing facade with a hood on two posts. Nothing
    // stands in front of it on a lot facility: the compound wall already owns the
    // strip between the plot and the street, and its gate is the entrance.
    function portal(record, frame, mat) {
      var door = at(frame, -.1, 0);capturingEntry=true;
      var leaf = box(record, 0, door.x, 2, door.z, frame.onZ ? 5.4 : .3, 4, frame.onZ ? .3 : 5.4, green);
      capturingEntry=false;
      // The leaf swings outward around its street-side stile; the hood and posts
      // are wall furniture and stay put.
      markDoor(leaf, batches.get(green.uuid), frame.onZ
        ? { hinge: [door.x - 2.7, 2, door.z], angle: -frame.dir * 1.45 }
        : { hinge: [door.x, 2, door.z - 2.7], angle: frame.dir * 1.45 });
      var hood = at(frame, .6, 0);
      box(record, 0, hood.x, 4.5, hood.z, frame.onZ ? 7.6 : 1.2, .5, frame.onZ ? 1.2 : 7.6, mat);
      [-1, 1].forEach(function (side) {
        var post = at(frame, .55, side * 4.3);
        box(record, 0, post.x, 2.2, post.z, .5, 4.4, .5, mat);
      });
    }
    function flagpole(record, x, z) {
      box(record, 'roof', x, .3, z, 1.2, .6, 1.2, paving);
      box(record, 'roof', x, 4.4, z, .22, 8.2, .22, gold);
      box(record, 'roof', x + 1.4, 7.1, z, 2.6, 1.6, .14, cross);
    }

    // A teaching block: an even storey count, a bell-cote or a colonnade over the
    // gate, and a drop-off yard in front — the ground the 护学岗 stands on.
    function buildTeachingBlock(record, site, body, course, roofMat, options) {
      var mass = massOf(site), frame = frameOf(site, mass);
      for (var level = 0; level < site.floors; level++) {
        storey(record, level, mass, body, course);
        shutters(record, level, mass, green);
      }
      yardOf(record, frame);
      box(record, 'roof', 0, .55, mass.z, mass.w + 1.6, .7, mass.d + 1.6, roofMat);
      parapetFor(record, body, mass.w, mass.d, mass.z);
      portal(record, frame, course);
      if (options.bell) {
        // A bell-cote with a clock face over the gate and the flag beside the
        // drop-off: a school has to read as a school from the far side of the board,
        // which is where the camera lives.
        box(record, 'roof', 0, 1.6, mass.z-4, 4.5, 2, 4, body);
        box(record, 'roof', 0, 2.7, mass.z-4, 5.2, .3, 4.7, roofMat);
        var flag = at(frame, frame.span / 2, -site.w / 2 + 7);
        flagpole(record, flag.x, flag.z);
      }
      if (options.colonnade) {
        var spread=mass.w-10, attic = at(frame, 1.6, 0);
        box(record, 'roof', attic.x, 1.5, attic.z, frame.onZ ? spread + 5 : 2.4, 2.4,
          frame.onZ ? 2.4 : spread + 5, body);
      }
      return mass;
    }
    // An industrial or market hall: a long low mass, a deep yard for the work that
    // happens outside it, and one unmistakable roof.
    function buildHall(record, site, body, course, roofMat, options) {
      var mass = massOf(site), frame = frameOf(site, mass);
      for (var level = 0; level < site.floors; level++) {
        storey(record, level, mass, body, course);
        shutters(record, level, mass, green);
      }
      yardOf(record, frame);
      box(record, 'roof', 0, .5, mass.z, mass.w + 1.4, .6, mass.d + 1.4, course);
      if (options.sawTooth) {
        // North-light bays: a tilted slab and a dark glazing face in each one. No
        // other roof on the board does this, which is how a workshop reads.
        var bays = 5, span = mass.w / bays;
        for (var i = 0; i < bays; i++) {
          var x = (i - (bays - 1) / 2) * span;
          box(record, 'roof', x, 1.9, mass.z, span - .6, .32, mass.d, body, { z: -.4 });
          box(record, 'roof', x + (span - .6) / 2 - .3, 3, mass.z, .3, 2.3, mass.d - 2, green);
        }
      } else if (options.barrel) {
        // A vaulted hall: five ribs stepping down toward the eaves.
        var ribs = 5, step = mass.d / ribs;
        for (var r = 0; r < ribs; r++) {
          box(record, 'roof', 0, 1.55 + (r === 0 || r === ribs - 1 ? -.45 : .35),
            mass.z + (r - (ribs - 1) / 2) * step, mass.w + 1, .55, step * .9, roofMat);
        }
        box(record, 'roof', 0, 2.9, mass.z, mass.w + 1.6, .5, 2.2, course);
      } else {
        // A mono-pitch shed roof, sloping down toward the yard.
        box(record, 'roof', 0, 1.7, mass.z, mass.w + 1.4, 1.2, mass.d + .8, roofMat, { x: .07 });
      }
      if (options.containers) {
        // The waste station's four cabinet doors need clear working space on the
        // left. Compact cargo bays start to its right and remain mutually separate.
        [[-3, gold], [5, terracotta], [13, green]].forEach(function (crate) {
          var spot = at(frame, frame.span * .62, crate[0]);
          box(record, 0, spot.x, 1.5, spot.z, frame.onZ ? 6.2 : 3.4, 2.7, frame.onZ ? 3.4 : 6.2, crate[1]);
          var lid = at(frame, frame.span * .62, crate[0]);
          box(record, 0, lid.x, 3.05, lid.z, frame.onZ ? 6.4 : 3.6, .3, frame.onZ ? 3.6 : 6.4, paving);
        });
      }
      parapetFor(record, body, mass.w, mass.d, mass.z);
      portal(record, frame, course);
      return mass;
    }
    // Thin fascia and compact rear equipment leave the arcade's roof readable.
    function buildSmallCentre(record, site) {
      var mass = massOf(site), frame = frameOf(site, mass);
      for (var level = 0; level < site.floors; level++) {
        storey(record, level, mass, silver, gold);
        shutters(record, level, mass, green);
        [-1, 1].forEach(function (side) {
          box(record, level, side * (mass.w / 2 + .2), 1.3, mass.z, .4, 2.6, mass.d - 4, gold);
        });
      }
      yardOf(record, frame);
      box(record, 'roof', 0, .55, mass.z, mass.w + 1.6, .7, mass.d + 1.6, silver);
      var board = at(frame, -.4, 0);
      box(record, 'roof', board.x, 2.05, board.z, frame.onZ ? mass.w - 10 : .9, 2.3,
        frame.onZ ? .9 : mass.w - 10, gold);
      box(record, 'roof', 7, 1.35, mass.z + 7, 5.2, 1.3, 4, white);
      box(record, 'roof', 7, 2.08, mass.z + 7, 5.6, .16, 4.4, gold);
      parapetFor(record, silver, mass.w, mass.d, mass.z);
      portal(record, frame, gold);
    }

    var PROGRAMMES = {
      primary: function (record, site) { buildTeachingBlock(record, site, ivory, terracotta, ivory, { bell: true }); },
      university: function (record, site) { buildTeachingBlock(record, site, silver, ivory, ivory, { colonnade: true }); },
      library: function (record, site) { buildTeachingBlock(record, site, ivory, gold, white, { colonnade: true }); },
      workshop: function (record, site) { buildHall(record, site, white, silver, silver, { sawTooth: true }); },
      depot: function (record, site) { buildHall(record, site, white, silver, silver, { containers: true }); },
      market: function (record, site) { buildHall(record, site, silver, terracotta, ivory, { barrel: true }); },
      'annex-mall': buildSmallCentre
    };

    /* ---- annex volumes: one storey in a host's yard, or the bank's three ------- */
    function buildClinic(record, annex) {
      var mass = { w: annex.w, d: annex.d, z: 0 }, frame = annexFrame(annex);
      storey(record, 0, mass, white, paving);
      shutters(record, 0, mass, green);
      box(record, 0, 0, 3.75, 0, mass.w + 1.2, .7, mass.d + 1.2, terracotta);
      portal(record, frame, paving);
      // A red cross over the door: the one symbol in this palette that needs no
      // signboard, on a material the hospital batch already owns.
      var sign = at(frame, .3, 0);
      box(record, 0, sign.x, 4.9, sign.z, frame.onZ ? 3.4 : .26, 1.15, frame.onZ ? .26 : 3.4, cross);
      box(record, 0, sign.x, 4.3, sign.z, frame.onZ ? 1.15 : .26, 2.3, frame.onZ ? .26 : 1.15, cross);
    }
    function buildPrecinct(record, annex) {
      var mass = { w: annex.w, d: annex.d, z: 0 }, frame = annexFrame(annex);
      storey(record, 0, mass, ivory, gold);
      shutters(record, 0, mass, green);
      box(record, 0, 0, 4.1, 0, mass.w + 1.6, .7, mass.d + 1.6, ivory);
      box(record, 'roof', 0, .22, 0, mass.w+.6, .35, mass.d+.6, ivory);
      // The light bar, red over mint: the box reads as staffed at any hour, which is
      // the point of it standing at the school gate (§4.4.1 护学岗).
      box(record, 'roof', 0, .66, 0, frame.onZ ? 2.8 : .7, .36, frame.onZ ? .7 : 2.8, cross);
      box(record, 'roof', 0, .93, 0, frame.onZ ? 3 : .85, .12, frame.onZ ? .85 : 3, paving);
      portal(record, frame, gold);
    }
    function buildWaste(record, annex) {
      var mass = { w: annex.w, d: annex.d, z: 0 }, frame = annexFrame(annex);
      storey(record, 0, mass, white, silver);
      box(record, 0, 0, 4.3, 0, mass.w + 1.4, .7, mass.d + 1.4, silver);
      box(record, 'roof', 0, .23, 0, mass.w+.5, .34, mass.d+.5, ivory);
      var door = at(frame, -.1, 0);capturingEntry=true;
      var wasteLeaf = box(record, 0, door.x, 2.1, door.z, frame.onZ ? mass.w - 2.5 : .3, 4.2, frame.onZ ? .3 : mass.w - 2.5, green);
      capturingEntry=false;
      // A roller shutter rather than a swing: the wide leaf slides along the wall.
      markDoor(wasteLeaf, batches.get(green.uuid), frame.onZ
        ? { slide: [-(mass.w - 2.5) * .62, 0] } : { slide: [0, -(mass.w - 2.5) * .62] });
      // The four sorting cabinets are supplied once by architectureParts.
    }
    function buildPodium(record, annex, floors) {
      var mass = { w: annex.w, d: annex.d, z: 0 }, frame = annexFrame(annex), top = floors * 6;
      for (var level = 0; level < floors; level++) {
        storey(record, level, mass, ivory, gold);
        shutters(record, level, mass, green);
      }
      // Marble onto the street with a colonnade, a canopy and a step on the face it
      // projects from, and the tower rising out of this roof: that is what "银行在
      // 写字楼的低楼层" looks like from outside, and it is the map's new mode.
      var bays = Math.max(3, Math.round(annex.w / 7));
      for (var i = 0; i < bays; i++) {
        var post = at(frame, 1.1, (i - (bays - 1) / 2) * (annex.w - 3) / bays);
        for(var columnFloor=0;columnFloor<floors;columnFloor++) column(record,columnFloor,post.x,post.z,1.35,columnFloor===floors-1?4.8:6,ivory);
      }
      var cornice = at(frame, 1.5, 0);
      box(record, 'roof', cornice.x, -.3, cornice.z, frame.onZ ? annex.w + .4 : 2.6, .8,
        frame.onZ ? 2.6 : annex.w + .4, gold);
      var step = at(frame, 2.1, 0);
      box(record, 0, step.x, .3, step.z, frame.onZ ? annex.w - 2 : 3.2, .6,
        frame.onZ ? 3.2 : annex.w - 2, paving);
      box(record, 'roof', 0, .5, 0, annex.w + 1.4, .8, annex.d + 1.4, ivory);
      // A low service grille sits behind the entrance parapet, clear of the sign.
      box(record, 'roof', annex.w*.28, 1.08, annex.d*.15, 3.2, .7, 2.3, white);
    }
    var ANNEX_BUILDERS = {
      clinic: buildClinic, precinct: buildPrecinct, waste: buildWaste, bank: buildPodium
    };

    city.buildings.filter(function (building) { return SITES.some(function (site) { return site.facility === building.facility; }); }).forEach(function (building) {
      var record = { building: building, transforms: [], sample: null, roofMatrix: new THREE.Matrix4() };
      for (var floor = 0; floor < building.floors; floor++) record.transforms.push(new THREE.Matrix4());
      records.push(record);
      var site = SITES.find(function (entry) { return entry.facility === building.facility; });
      var kind = building.facility;
      if (kind === 'mall') {
        for (var level = 0; level < building.floors; level++) {
          box(record, level, 0, 3, 0, 44, 5.86, 48, silver);
          box(record, level, 0, .36, 0, 45, .72, 49, silver);
          [-1, 1].forEach(function (side) {
            box(record, level, 0, 3.35, side * 24.07, 40.8, 3.9, .2, glass);
            box(record, level, side * 22.07, 3.35, 0, .2, 3.9, 44.8, glass);
            box(record, level, 0, 1.29, side * 24.28, 42.3, .19, .52, gold);
            box(record, level, side * 22.28, 1.29, 0, .52, .19, 46.3, gold);
            for (var span = -3; span <= 3; span++) {
              box(record, level, span * 5.55, 3.35, side * 24.21, .18, 3.94, .16, trim);
              box(record, level, side * 22.21, 3.35, span * 6.2, .16, 3.94, .18, trim);
            }
          });
          corners(record, level, gold, 1.15);
        }
        box(record, 0, 0, -.56, 0, 46, 1.12, 50, paving);
        frontPorch(record, gold, 22);
        parapet(record, silver);
        // Raised, pitched glazing and visible mullions make an actual skylight.
        if (!refinedAsset) box(record, 'roof', 0, .75, 1, 20, .9, 25, silver);
        [-1, 1].forEach(function (side) {
          box(record, 'roof', side * 4.7, 2.65, 1, 9.85, .18, 23, glass, { z: -side * .28 });
          if (!refinedAsset) for (var bar = -2; bar <= 2; bar++) box(record, 'roof', side * 4.7, 2.8, 1 + bar * 5.2, 9.85, .16, .18, gold, { z: -side * .28 });
        });
        if (!refinedAsset) box(record, 'roof', 0, 4.02, 1, .22, .22, 23.4, gold);
        [0,1].forEach(function(side){
          function shell(x,y,z,w,h,d){box(record,'roof',side?z:x,y,side?x:z,side?d:w,h,side?w:d,silver);}
          shell(0,3.45,side?-21.75:-23.75,23,6.1,.12);
          var z=side?-22.06:-24.06;
          [-1,1].forEach(function(sign){shell(sign*11.3,3.45,z,.4,6.1,.75);shell(0,3.45+sign*2.9,z,22.6,.3,.75);});
        });
        label(record, '星河商场', '#714a3d', '#ebd1a2');
      } else if (kind === 'hospital') {
        for (var hospitalLevel = 0; hospitalLevel < building.floors; hospitalLevel++) {
          windowRows(record, hospitalLevel, white, trim, true);
        }
        box(record, 0, 0, -.56, 0, 46, 1.12, 50, paving);
        frontPorch(record, green, 18);
        parapet(record, trim);
        if (!refinedAsset) {
          box(record, 'roof', 7, 1.8, 6, 17, 2.8, 20, white);
          box(record, 'roof', 7, 3.29, 6, 18.2, .28, 21.2, green);
          // A rooftop service platform, plus a physical medical cross facing the street.
          [-1, 1].forEach(function (side) {
            box(record, 'roof', 7, 4.03, 6 + side * 10.2, 17.7, .12, .12, trim);
            for (var post = -1; post <= 1; post++) box(record, 'roof', 7 + post * 8.4, 3.66, 6 + side * 10.2, .14, .8, .14, trim);
          });
        }
        box(record, 'roof', 16, 6.2, -24.06, 7.5, 8.6, .75, trim);
        box(record, 'roof', 16, 6.2, -24.57, 5.8, 1.9, .3, cross);
        box(record, 'roof', 16, 6.2, -24.57, 1.9, 6.2, .32, cross);
        box(record, 'roof', 7, 3.48, 6, 8.3, .18, 2.5, cross);
        box(record, 'roof', 7, 3.49, 6, 2.5, .2, 8.3, cross);
        box(record, 'roof', 0, 3.45, -24.06, 23, 6.1, .75, trim);
        box(record, 'roof', -22.06, 3.45, 0, .75, 6.1, 23, trim);
        label(record, '城市医院', '#347154', '#f1ecdb');
      } else if (kind === 'secondary') {
        // This arm is the rename's silent trap. `records.push` above already counted the
        // building, and city-district.js refuses to draw anything with a `facility`, so if
        // the kind moved and this test did not, the campus would vanish from the board
        // with no exception and no count mismatch — only the sign would be missing.
        for (var schoolLevel = 0; schoolLevel < building.floors; schoolLevel++) {
          windowRows(record, schoolLevel, ivory, trim, false, true);
        }
        box(record, 0, 0, -.56, 0, 46, 1.12, 50, paving);
        // Keep the west gate on its proven axis. The short porch and cheeks occupy the
        // same yard as before, while the shared plan above supplies the recessed lobby.
        if (!refinedAsset) {
          box(record, 0, -22.95, 5.04, 0, 2.1, .32, 12.2, terracotta);
          [-1, 1].forEach(function(side){
            box(record, 0, -23.45, 2.45, side * 6.2, .9, 4.9, .9, terracotta);
            box(record, 0, -23.95, 2.82, side * 6.2, .1, 1.05, .65, trim);
          });
        }
        box(record, 0, -23.05, -.26, 0, 3.4, .52, 15.2, paving);
        parapet(record, ivory);
        buildArchitecture(record, site);
      } else if (PROGRAMMES[kind]) {
        // The eight W1.5b blocks: a pavement slab like the landmarks wear, then the
        // programme's own massing. `floors` comes from the replaced building's record
        // so the guard above can never be contradicted by a mismatched constant.
        var sized = Object.assign({}, site, { floors: building.floors });
        box(record, 0, 0, -.56, 0, site.w + 2, 1.12, site.d + 2, paving);
        PROGRAMMES[kind](record, sized);
        buildArchitecture(record,sized);
      }
      addRefined(record);addHospitalRoom(record);
    });

    /* Annexes are drawn against their host's clock: a one-storey surgery appears with
     * the first floor of the block it serves, and the bank's three podium storeys
     * rise with the tower's first three. They are not city.buildings entries, so
     * nothing else in the town has to learn that they exist — but that also means
     * `CityLayout.apply` never translates them, so their place is re-derived from the
     * host building here through `annexAt`, the same formula decorate used. The record's
     * own x/z are the canonical (identity-layout) position and are deliberately not
     * read here: re-running the formula is what lets a swap carry the annex, and what
     * lets the market-band mirror re-decide which flank it stands on afterwards. */
    (city.annexes || []).forEach(function (annex) {
      var host = city.buildings.filter(function (building) { return building.id === annex.host; })[0];
      var builder = ANNEX_BUILDERS[annex.facility];
      var at = annexAt(annex, host);
      if (!at || !builder) return;
      var record = {
        building: { id: annex.id, facility: annex.facility, label: annex.label, name: annex.name,
          x: at.x, z: at.z, w: at.w, d: at.d,
          floors: annex.floors, floorHeight: 6, kind: 'stone', roof: 'facility' },
        annex: annex, host: host, transforms: [], sample: null, roofMatrix: new THREE.Matrix4()
      };
      for (var floor = 0; floor < annex.floors; floor++) record.transforms.push(new THREE.Matrix4());
      annexRecords.push(record);
      builder(record, annex, annex.floors);
      buildArchitecture(record,annex);
    });

    batches.forEach(function (batch) {
      var mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.parts.length);
      mesh.name = batch.name || (batch.module ? 'facilities-civic-' + batch.module : batch.room ? 'facilities-hospital-ward' : 'facilities-' + batch.material.name);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = batch.material!==roomGlass; mesh.receiveShadow = batch.material!==roomGlass; mesh.frustumCulled = false;
      mesh.userData.architectureParts=[]; mesh.userData.buildingIds=[];
      if (batch.module) mesh.userData.civicModules=[];
      if (batch.name||batch.module||batch.room||batch.material===roomGlass) mesh.userData.ledgerIds=[];
      if (batch.room) mesh.userData.hospitalInterior={id:'hospital-ward',floor:3,features:roomAsset.meta.features};
      if (batch.material===roomGlass) mesh.userData.hospitalWindows=[];
      batch.colored=batch.parts.some(function(p){return !!p.tint;});
      if(batch.colored)mesh.setColorAt(0,new THREE.Color('#ffffff'));
      mesh.count = 0; mesh.visible = false; batch.mesh = mesh; group.add(mesh); meshes.push(mesh);
    });
    createCivicSigns();

    function ensureLightMesh() {
      if (lightMesh || !lightPanes.length) return;
      lightMesh = new THREE.InstancedMesh(unitBox, windowGlow, lightPanes.length);
      lightMesh.name = 'facilities-town-windows'; lightMesh.castShadow = false; lightMesh.receiveShadow = false;
      lightMesh.frustumCulled = false; lightMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      var hiddenLight = new THREE.Matrix4().makeScale(0,0,0);
      lightMesh.userData.buildingIds=lightPanes.map(function(p){return p.record.building.id;});
      lightPanes.forEach(function(p,i){lightMesh.setMatrixAt(i,hiddenLight);});
      allRecords().forEach(function(r){
        (r.lightPanes||[]).slice().sort(function(a,b){return (Math.imul(a.ordinal+1,2654435761)>>>0)-(Math.imul(b.ordinal+1,2654435761)>>>0);})
          .forEach(function(p,index){p.order=index;});
      });
      group.add(lightMesh); meshes.push(lightMesh);
    }
    function refreshLights() {
      if (!townView && !lightMesh) return;
      ensureLightMesh();
      if (!lightMesh) return;
      var signature = allRecords().map(function(record){
        var id = townBindings && townBindings.byMapId && townBindings.byMapId[record.building.id] || record.building.id;
        var entry = townView && townView.byBuilding && townView.byBuilding[id];
        record.maxPanes=entry&&Number.isFinite(entry.maxPanes)?entry.maxPanes:Infinity;
        record.ledgerId = id; record.lightLevel = entry ? Math.max(0,Math.min(1,Number(entry.lightLevel)||0)) : 0;
        record.litWindows = 0;
        return [id,record.lightLevel,record.maxPanes,record.sample&&record.sample.builtFloors,record.building.x,record.building.z].join(':');
      }).join('|');
      // Keep diagnostics intact when no GPU update is needed.
      var changed = signature !== lightsKey; lightsKey = signature;
      var hidden = new THREE.Matrix4().makeScale(0,0,0), any = false;
      lightPanes.forEach(function(p,index){
        var r=p.record,n=r.lightPanes.length;
        // A fixed permutation spreads working rooms across facades; any nonzero
        // duty level retains at least one real window.
        var lit=p.order<Math.min(r.maxPanes,Math.ceil(r.lightLevel*n))&&r.sample&&p.floor<r.sample.builtFloors;
        if(lit){r.litWindows++;any=true;}
        if(!changed)return;
        if(lit){matrix.makeTranslation(r.building.x,BASE_Y+p.floor*6,r.building.z);matrix.multiply(p.local);}
        lightMesh.setMatrixAt(index,lit?matrix:hidden);
      });
      lightMesh.visible=any;if(changed)lightMesh.instanceMatrix.needsUpdate=true;
    }
    function setTownView(view,bindings){
      if(disposed)return;townView=view;townBindings=bindings;refreshLights();refreshDoors();
      batches.forEach(function(batch){
        if(!batch.mesh.userData.ledgerIds)return;
        var data=batch.mesh.userData;
        data.buildingIds.forEach(function(id,index){data.ledgerIds[index]=bindings&&bindings.byMapId&&bindings.byMapId[id]||id;});
      });
    }

    function sampleRecord(record, time) {
      var building = record.building;
      if (record.host) {
        // Derived from the host, so an annex can never disagree with the block it
        // hangs off: no clock of its own to compute, and nothing to go NaN.
        var hostSample = root.CityModel.sampleBuilding(record.host, time);
        var built = Math.min(building.floors, hostSample.builtFloors);
        record.sample = { builtFloors: built, falling: [], complete: built === building.floors };
        return;
      }
      record.sample = root.CityModel.sampleBuilding(building, time);
    }

    function placeRecord(record) {
      var building = record.building, sample = record.sample;
      record.visibleFloors = new Set();
      for (var floor = 0; floor < sample.builtFloors; floor++) {
        record.transforms[floor].makeTranslation(building.x, BASE_Y + floor * building.floorHeight, building.z);
        record.visibleFloors.add(floor);
      }
      sample.falling.forEach(function (falling) {
        position.set(building.x, BASE_Y + falling.y, building.z); rotation.setFromAxisAngle(up, -falling.rotation);
        record.transforms[falling.floor].compose(position, rotation, scale);
        record.visibleFloors.add(falling.floor);
      });
      record.roofMatrix.makeTranslation(building.x, BASE_Y + building.floors * building.floorHeight, building.z);
      if (sample.builtFloors || sample.falling.length) statistics.buildings++;
      statistics.floorInstances += sample.builtFloors; statistics.fallingInstances += sample.falling.length;
      if (sample.complete) statistics.roofInstances++;
    }

    function update(time) {
      if (disposed) return;
      time = typeof time === 'number' && !Number.isNaN(time) ? time : 0;
      if (time === lastTime) return;
      if (lastTime !== null && lastTime >= city.duration && time >= city.duration) { lastTime = time; return; }
      lastTime = time;
      statistics.buildings = 0; statistics.floorInstances = 0; statistics.fallingInstances = 0;
      statistics.roofInstances = 0; statistics.drawCalls = 0; statistics.triangles = 0;
      refinedActive.length = 0; refinedTriangles = 0;roomActive=false;roomTriangles=0;
      doorLeaves.forEach(function (part) { part.door.index = -1; });
      records.concat(annexRecords).forEach(function (record) {
        sampleRecord(record, time);
        placeRecord(record);
      });
      var untinted=new THREE.Color('#ffffff');
      batches.forEach(function (batch) {
        var mesh = batch.mesh, count = 0;
        batch.parts.forEach(function (part) {
          var record = part.record, roof = part.floor === 'roof';
          if (roof ? !record.sample.complete : !record.visibleFloors.has(part.floor)) return;
          if (part.door) part.door.index = count;
          matrix.multiplyMatrices(roof ? record.roofMatrix : record.transforms[part.floor], part.local);
          mesh.setMatrixAt(count, matrix);
          if (batch.colored) mesh.setColorAt(count, part.tint||untinted);
          mesh.userData.architectureParts[count]=part.architecture||null;
          mesh.userData.buildingIds[count]=record.building.id;
          if (batch.module) mesh.userData.civicModules[count]=batch.module;
          if (mesh.userData.ledgerIds) mesh.userData.ledgerIds[count]=townBindings && townBindings.byMapId && townBindings.byMapId[record.building.id] || record.building.ledgerId || record.building.id;
          if (mesh.userData.hospitalWindows) mesh.userData.hospitalWindows[count]=part.hospitalWindow;
          count++;
        });
        mesh.count = count; mesh.visible = count > 0;
        mesh.userData.architectureParts.length=count; mesh.userData.buildingIds.length=count;
        mesh.instanceMatrix.clearUpdateRanges();
        if (count) { mesh.instanceMatrix.addUpdateRange(0, count * 16); statistics.drawCalls++; }
        mesh.instanceMatrix.needsUpdate = true; statistics.triangles += count * batch.triangles;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        if (mesh.userData.ledgerIds) mesh.userData.ledgerIds.length=count;
        if (mesh.userData.hospitalWindows) mesh.userData.hospitalWindows.length=count;
        if (batch.module) {
          mesh.userData.civicModules.length=count;
          if (count) { refinedActive.push(batch.module); refinedTriangles += count * batch.triangles; }
        }
        if (batch.name||batch.module||batch.room||batch.material===roomGlass) {
          // Raycaster caches instance bounds even when the first frame is empty.
          mesh.computeBoundingBox(); mesh.computeBoundingSphere();
        }
        if(batch.room&&count){roomActive=true;roomTriangles+=count*batch.triangles;}
      });
      refreshDoors();
      refreshLights();
      labels.forEach(function (item) {
        item.mesh.visible = item.record.sample.complete;
        item.mesh.count=+item.mesh.visible;item.mesh.userData.buildingIds=item.mesh.visible?[item.record.building.id]:[];item.mesh.computeBoundingSphere();
        item.mesh.position.copy(item.local).applyMatrix4(item.record.roofMatrix);

        if (item.mesh.visible) { statistics.drawCalls++; statistics.triangles += 2; }
      });
      updateCivicSigns();
    }
    function allRecords() { return records.concat(annexRecords); }
    function getInfo() {
      return Object.assign({ ready: !disposed, time: lastTime, totalBuildings: disposed ? 0 : records.length + annexRecords.length,
        batches: disposed ? 0 : meshes.length, labels: disposed ? 0 : labels.length+civicSigns.length,
        annexes: disposed ? 0 : annexRecords.length,
        refinedCivic:{assetId:refinedAsset ? refinedAsset.meta.assetId : null,available:!!refinedAsset && !disposed,
          activeModules:refinedActive.slice(),triangles:refinedTriangles},
        hospitalInterior:{assetId:roomAsset?roomAsset.meta.assetId:null,available:!!roomAsset&&!disposed,floor:3,
          active:roomActive,triangles:roomTriangles,features:roomAsset?roomAsset.meta.features:[],
          windows:roomAsset?[-5.7,0,5.7].map(function(x,i){return {bay:i,x:x,y:3.25,z:-24.08,w:4.2,h:3.15,lightLevel:roomLevels[i]};}):[]},
        lights: allRecords().filter(function(r){return r.lightPanes;}).map(function(r){return {id:r.ledgerId||r.building.id,mapId:r.building.id,level:r.lightLevel||0,windows:r.lightPanes.length,litWindows:r.litWindows||0};}),
        doors: doorLeaves.map(function (part) {
          var meta = part.door;
          return { ledger: townBindings && townBindings.byMapId && townBindings.byMapId[meta.ledger] || meta.ledger,
            kind: meta.slide ? 'slide' : 'swing', travel: meta.travel || 0, drawn: meta.index >= 0 };
        }),
        facilities: allRecords().map(function (record) { return { id: record.building.id, facility: record.building.facility,
          label: record.building.label, palette: Object.assign({}, civicPalette(record.building.facility)||PALETTES[record.building.facility]),
          signs:record.architecture?record.architecture.signs.map(function(s){return s.text;}):[],
          architectureStyle:record.architecture&&record.architecture.style||null,
          architectureFeatures:record.architecture?record.architecture.features.slice():[],
          architecturePieces:record.architecturePieces||0 }; }) }, statistics, {drawCalls:statistics.drawCalls+(lightMesh&&lightMesh.visible?1:0),triangles:statistics.triangles+(lightMesh&&lightMesh.visible?lightPanes.length*12:0)});
    }
    function dispose() {
      if (disposed) return;
      disposed = true; group.visible = false; group.removeFromParent();
      meshes.forEach(function (mesh) { if (mesh.isInstancedMesh) mesh.dispose(); });
      ownedGeometries.forEach(function (geometry) { geometry.dispose(); });
      ownedMaterials.forEach(function (mat) { mat.dispose(); });
      ownedTextures.forEach(function (texture) { texture.dispose(); });
      group.clear(); batches.clear(); labels.length = 0; meshes.length = 0; records.length = 0;
      annexRecords.length = 0;
      refinedActive.length = 0; refinedTriangles = 0; refinedAsset = null; refinedGeometries = {};
      roomAsset=null;roomActive=false;roomTriangles=0;roomLevels=[0,0,0];
      civicSigns.length = 0;civicSignMesh = null;
      Object.keys(statistics).forEach(function (name) { statistics[name] = 0; });
    }
    update(0);
    return { group: group, update: update, setTownView:setTownView, dispose: dispose, getInfo: getInfo, getLightAnchors:function(){return lightAnchors;},
      setInteriorLights:setInteriorLights,setInteriorDaylight:setInteriorDaylight,setLighting:function(l){
        if(disposed)return;cross.emissive.set('#c9493c');cross.emissiveIntensity=l.lamps*.9;
        var nextMode=l.lamps>.2?'night':'day';
        if(nextMode!==signMode){signMode=nextMode;signSurfaces.forEach(function(surface){surface.repaint(nextMode==='night');surface.texture.needsUpdate=true;});}
        var evening=l.minute>=1110&&l.minute<1380;
        signMaterials.forEach(function(mat){
          mat.emissiveIntensity=l.lamps*(evening?.05:.02);
          mat.color.setScalar(nextMode==='night'?(evening?3.5:1.6):1);
        });
        labels.forEach(function(item){if(item.lightbox)item.mesh.material.color.setScalar(.12+.88*l.daylight+3.3*(l.buildings?.['c-mall']?.decoration||0));});
        setInteriorDaylight(l.daylight);
      } };

  }
  return { decorate: decorate, create: create, nightSignInk:nightSignInk, architectureParts:architectureParts, civicPalette:civicPalette, SITES: SITES, ANNEXES: ANNEXES, lotCentre: lotCentre,
    annexAt: annexAt, annexSites: annexSites };
});
