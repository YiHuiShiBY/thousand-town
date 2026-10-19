/* Plot frontage: a shop podium ring around commercial frontage buildings, and a
 * walled courtyard compound with a gate around low-rise housing and civic sites.
 *
 * plan() is pure data (no THREE) so the ground module, city-life, the tests and
 * both renderers share one source of truth: it settles the band depth per side
 * against the real clearance rules and emits every part with its own appearance
 * time. create() only batches those parts.
 *
 * Commercial sites keep shops on three sides; the fourth is the building's own
 * entrance and faces the nearest carriageway (see entrySide). The mall carries its
 * own street presence — golden porch, cornices, skylight — so it gets no ring at
 * all. Every shop unit is a small building, not a printed sheet: jambs, a soffit,
 * a stone threshold and a lit interior sit behind the glazing.
 *
 * Construction reuses the count-prefix idiom of the building sections: parts are
 * sorted by time and each batch draws a prefix, so scrubbing time costs one
 * binary search and no instance upload. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CityFrontage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  // Scale note: the actors are stylised and large (a walker is ~4.35 units to the
  // top of the head, a car 8 units long), so every frontage part is sized against
  // the project's own architecture instead of real-world metres — a storey is 6
  // units, a housing floor module 5.83, its entrance door 3.6 and canopy 4.16, a
  // park bench 2.42. Doors, awnings and railings below those numbers read as
  // miniature next to the people walking past them.
  var SHOP = {
    gap: 1.35, depth: 3.6, minDepth: 2, height: 5.6, wall: .5,
    awning: 1.5, awningY: 4.45, fasciaY: 5, fascia: .95, unit: 6.4,
    // A unit is a small building, not a printed sheet: jambs post the opening
    // out of the shop body, a soffit and a stone threshold close the reveal, a
    // lit back wall and a counter stand behind the glazing, and the sign board
    // hangs off two brackets.
    jamb: .34, reveal: .34, board: .34, lit: .3, door: 1.5
  };
  // The fourth side of a shop ring is the building's own entrance: a paved
  // forecourt, a door in a real reveal, two piers and a canopy carrying the name
  // board. Everything stays inside the band the shops would have used there.
  var LOBBY = {
    wall: 1, door: 1.5, leaf: .28, reveal: .34, pier: 1.1, pierHeight: 6.3,
    canopy: .34, board: 1.15, half: 5.4, step: .22
  };
  var WALL = {
    thickness: .7, base: 1, railTop: 3.3, pierStep: 7,
    maxRing: 7.5, minRing: 2.2, gate: 8, gatePier: 1.45
  };
  var SHOP_NAMES = [
    '便利店', '面包房', '药房', '书店', '咖啡馆', '花店',
    '理发店', '五金行', '文具铺', '茶室', '缝纫铺', '照相馆'
  ];
  var COMPOUND_NAMES = ['梧桐里', '临水佳苑', '云庭', '槐荫巷', '青瓦坊', '望江邸', '春和里', '叠翠园'];
  var HOME_NAME_COUNT = COMPOUND_NAMES.length;
  var PUBLIC_GATE_NAMES = {secondary:'未来中学',primary:'镇东小学',university:'城市大学',hospital:'社区医院',library:'社区图书馆'};
  Object.keys(PUBLIC_GATE_NAMES).forEach(function (kind) { COMPOUND_NAMES.push(PUBLIC_GATE_NAMES[kind]); });
  var AWNING_COLORS = ['#b4705f', '#c69a5c', '#7f9aa6', '#8fa477', '#a9836f', '#948eae'];
  var SIDES = ['x-', 'x+', 'z-', 'z+'];
  var SIGN_ATLAS = { columns: 2 };
  var PLAQUE_ATLAS = { columns: 2 };

  function overlaps(a, b, gap) {
    return Math.abs(a.x - b.x) < (a.w + b.w) / 2 + (gap || 0) &&
      Math.abs(a.z - b.z) < (a.d + b.d) / 2 + (gap || 0);
  }
  function rect(x, z, w, d) { return { x: x, z: z, w: w, d: d }; }
  function rounded(value) { return Math.round(value * 100) / 100; }
  function axisOf(side) { return side.charAt(0); }
  function signOf(side) { return side.charAt(1) === '-' ? -1 : 1; }
  // Outward unit vector and the along-side unit vector of one plot side.
  function normalOf(side) {
    var axis = axisOf(side), sign = signOf(side);
    return axis === 'z' ? { x: 0, z: sign } : { x: sign, z: 0 };
  }
  function alongOf(side) {
    return axisOf(side) === 'z' ? { x: 1, z: 0 } : { x: 0, z: 1 };
  }
  // Outward yaw for a plane facing this side.
  function yawOf(side) {
    var normal = normalOf(side);
    return Math.atan2(normal.x, normal.z);
  }

  // A frontage part may only stand where the city is genuinely free: no roadway,
  // canal, bridge approach, reserved site, park, other building, tree or street
  // furniture, no pedestrian/vehicle sweep, and no earlier plot's own ring.
  function partClear(city, part, gap, sweeps) {
    if (Math.abs(part.x) + part.w / 2 > city.extentX - 1 || Math.abs(part.z) + part.d / 2 > city.extentZ - 1) return false;
    if (overlaps(part, city.water, .3 + gap)) return false;
    if (city.roads.some(function (road) { return overlaps(part, road, .25 + gap); })) return false;
    if (city.bridges.some(function (bridge) {
      return overlaps(part, { x: bridge.x, z: bridge.z, w: bridge.w + 20, d: bridge.d + 8 }, .5 + gap);
    })) return false;
    if ((city.reservations || []).some(function (site) { return overlaps(part, site, .2 + gap); })) return false;
    if ((city.parks || []).some(function (park) { return overlaps(part, park, .2 + gap); })) return false;
    if (city.buildings.some(function (b) { return overlaps(part, b, gap); })) return false;
    if (city.playground && overlaps(part, { x: city.playground.x, z: city.playground.z, w: 40, d: 46 }, .3 + gap)) return false;
    if ((sweeps || []).some(function (bar) { return overlaps(part, bar, gap); })) return false;
    return !(city.trees || []).some(function (tree) {
      var dx = Math.max(0, Math.abs(tree.x - part.x) - part.w / 2);
      var dz = Math.max(0, Math.abs(tree.z - part.z) - part.d / 2);
      return Math.hypot(dx, dz) < tree.r * .65 + .4 + gap;
    });
  }

  // Commercial frontage wraps office towers; everything low-rise — housing,
  // hospitals, schools — gets the walled compound with a gated court. The mall is
  // neither: its own porch, cornices and skylight already address the street, so
  // it is planned with no ring and no reservation rather than a box of small shops.
  function frontageType(building) {
    if (building.facility === 'mall') return null;
    if (building.facility) return 'wall';
    if (building.housing) return 'wall';
    return building.kind === 'glass' || building.floors >= 15 ? 'shops' : 'wall';
  }

  // Outward bar of one side at a given inner gap and band depth.
  function sideBar(building, side, inner, depth) {
    var axis = axisOf(side), sign = signOf(side), center = inner + depth / 2;
    if (axis === 'z') {
      return rect(building.x, building.z + sign * (building.d / 2 + center),
        building.w + 2 * (inner + depth), depth);
    }
    return rect(building.x + sign * (building.w / 2 + center), building.z,
      depth, building.d + 2 * (inner + depth));
  }

  // Deepest band this side can take, searched inward from the full depth.
  function bestShopDepth(city, building, side, sweeps) {
    var depth = SHOP.depth;
    while (depth >= SHOP.minDepth - 1e-9) {
      if (partClear(city, sideBar(building, side, SHOP.gap, depth), .1, sweeps)) return rounded(depth);
      depth -= .4;
    }
    return 0;
  }

  // Compound offsets tried in order: the ladder always ends exactly on the
  // minimum, which a plain step-down would skip (7.5, 7.0 … 2.5, 2.0 > floor).
  function ringLadder() {
    var list = [];
    for (var ring = WALL.maxRing; ring > WALL.minRing; ring = rounded(ring - .5)) list.push(ring);
    list.push(WALL.minRing);
    return list;
  }

  // A compound wall reads as one rectangle, so all four sides share the largest
  // offset they can all hold; below the floor the site stays unwalled.
  function compoundRing(city, building, sweeps) {
    var ladder = ringLadder();
    for (var index = 0; index < ladder.length; index += 1) {
      var ring = ladder[index];
      var fits = SIDES.every(function (side) {
        return partClear(city, sideBar(building, side, ring - WALL.thickness / 2, WALL.thickness), .12, sweeps);
      });
      if (fits) return ring;
    }
    return 0;
  }

  // Perpendicular distance from one side of a plot to the nearest carriageway that
  // faces it, measured from the building face; Infinity when no road runs along
  // that side. Only roads are counted: an entrance belongs on the traffic side.
  function roadGap(building, side, roads) {
    var axis = axisOf(side), sign = signOf(side), best = Infinity;
    (roads || []).forEach(function (road) {
      if (road.axis !== axis) return;
      var own = axis === 'z' ? building.z : building.x;
      var half = (axis === 'z' ? building.d : building.w) / 2;
      var line = axis === 'z' ? road.z : road.x;
      if ((line - own) * sign <= 0) return;
      var gap = Math.abs(line - own) - half;
      if (gap < best) best = gap;
    });
    return best;
  }

  function nearestRoadSide(building, roads) {
    var best = { distance: Infinity, side: 'z-' };
    (roads || []).forEach(function (road) {
      var along = road.axis === 'x' ? Math.abs(road.z - building.z) - building.d / 2 : Math.abs(road.x - building.x) - building.w / 2;
      var side = road.axis === 'x'
        ? (road.z < building.z ? 'z-' : 'z+')
        : (road.x < building.x ? 'x-' : 'x+');
      if (along < best.distance) best = { distance: along, side: side };
    });
    return best.side;
  }

  // The gate faces the recorded entrance, else the courtyard, else the nearest
  // carriageway — so every compound opens onto a street rather than a back lot.
  function gateSide(building, roads, entrance) {
    if (entrance) {
      var dx = entrance.x - building.x, dz = entrance.z - building.z;
      if (Math.abs(dx) > Math.abs(dz)) return dx < 0 ? 'x-' : 'x+';
      return dz < 0 ? 'z-' : 'z+';
    }
    var court = building.housing && building.housing.courtyard;
    if (court && Math.hypot(court.x, court.z) >= 3) {
      return Math.abs(court.x) > Math.abs(court.z) ? (court.x < 0 ? 'x-' : 'x+') : (court.z < 0 ? 'z-' : 'z+');
    }
    return nearestRoadSide(building, roads);
  }

  // Shop sides in the order the entrance is tried: the nearest carriageway first
  // — never a walking route, an entrance belongs on the traffic side — then the
  // rest by road distance. A plot whose street side cannot hold a band still opens
  // somewhere rather than losing its lobby.
  function entryLadder(building, roads) {
    return SIDES.slice().sort(function (a, b) {
      var gapA = roadGap(building, a, roads), gapB = roadGap(building, b, roads);
      if (gapA !== gapB) return gapA < gapB ? -1 : 1;
      return SIDES.indexOf(a) - SIDES.indexOf(b);
    });
  }

  function makeBuilder() {
    var parts = [];
    return {
      parts: parts,
      add: function (role, x, y, z, w, h, d, time, tint, tile, yaw) {
        if (w <= 0 || h <= 0 || d <= 0) return null;
        var part = {
          role: role, x: rounded(x), y: rounded(y), z: rounded(z),
          w: rounded(w), h: rounded(h), d: rounded(d), t: rounded(time),
          tint: tint || null, tile: tile || null, yaw: yaw || 0, side: null
        };
        parts.push(part);
        return part;
      }
    };
  }

  // Unit frame shared by the shop bays and the lobby: u runs along the side, v
  // runs outward from the facade, y up from the plinth.
  function sidePlacer(building, site, side) {
    var axis = axisOf(side), normal = normalOf(side), along = alongOf(side), yaw = yawOf(side);
    var facade = (axis === 'z' ? building.d : building.w) / 2;
    return function (u, v, y, alongWidth, height, outwardDepth, role, time, tint, tile) {
      var reach = facade + v;
      var part = site.builder.add(role, building.x + along.x * u + normal.x * reach, y,
        building.z + along.z * u + normal.z * reach,
        axis === 'z' ? alongWidth : outwardDepth, height,
        axis === 'z' ? outwardDepth : alongWidth, time, tint, tile, yaw);
      if (part) part.side = side;
      return part;
    };
  }

  // Shop units fill one side of the podium. Every dimension is measured from the
  // facade: v runs outward from the wall, u runs along the side.
  function buildSide(city, building, site, side) {
    var depth = site.band[side];
    if (!depth) { site.gaps.push(side); return; }
    // The side that carries the building's entrance holds the lobby instead: no
    // shops there, and the other three sides keep the shop bands they always had.
    if (side === site.entrySide) { buildLobby(building, site, side); return; }
    var place = sidePlacer(building, site, side);
    var base = site.riseAt;
    var axis = axisOf(side);
    var inner = SHOP.gap, outer = inner + depth;
    var bodyOut = inner + SHOP.wall;   // outer face of the shop body wall
    var front = outer - .12;           // shopfront plane: the jambs stop here
    var recess = front - bodyOut;
    var span = axis === 'z' ? building.w + 2 * outer : building.d;
    var halfSpan = span / 2;
    var count = Math.max(1, Math.round(span / SHOP.unit));
    var width = span / count;
    site.unitCount += count;
    site.units.push({ side: side, count: count, width: rounded(width) });
    // The apron and the podium roof tie the ring back to the plinth.
    place(0, (inner + outer) / 2, .27, span, .08, depth, 'paving', base - .32);
    for (var index = 0; index < count; index++) {
      var u = -halfSpan + width * (index + .5);
      var time = base + index * .045;
      var name = (site.nameIndex + index * 5 + (axis === 'z' ? 0 : 7)) % SHOP_NAMES.length;
      var body = index % 2 === 0 ? '#efe6d2' : '#e5d9c2';
      var awning = AWNING_COLORS[(site.styleIndex + index + (axis === 'z' ? 0 : 2)) % AWNING_COLORS.length];
      var glassU = u - width * .05, glassW = width - 1.9, glassV = outer - .5;
      var door = u + width / 2 - 1.15;
      // The opening runs from the frame post at the unit edge to the door, so the
      // soffit, the threshold and the interior all share one width.
      var post = glassU - glassW / 2 - SHOP.jamb / 2 + .05;
      var lintel = door - SHOP.door / 2 - SHOP.jamb / 2 + .05;
      var openW = lintel - post + SHOP.jamb, openMid = (post + lintel) / 2;
      // Shop body, then the pilasters that separate it from its neighbours.
      place(u, inner + SHOP.wall / 2, SHOP.height / 2 + .27, width - .3, SHOP.height, SHOP.wall, 'shopbody', time, body);
      place(u - width / 2, (inner + outer) / 2, SHOP.height / 2 + .27, .55, SHOP.height + .6, depth, 'trim', time);
      if (index === count - 1) {
        place(u + width / 2, (inner + outer) / 2, SHOP.height / 2 + .27, .55, SHOP.height + .6, depth, 'trim', time);
      }
      // Jambs project from the shop body out to the shopfront plane on both edges
      // of the opening, so the front reads as three planes instead of one sheet.
      place(post, (bodyOut - .3 + front) / 2, SHOP.height / 2 + .27, SHOP.jamb, SHOP.height, recess + .3, 'jamb', time + .05);
      place(lintel, (bodyOut - .3 + front) / 2, SHOP.height / 2 + .27, SHOP.jamb, SHOP.height, recess + .3, 'jamb', time + .05);
      // Soffit over the recess and a stone threshold below it: the glazing sits in
      // a reveal, and the shop has a floor rather than a pane on the pavement.
      place(openMid, (bodyOut + front) / 2, 4.05, openW, .3, recess, 'soffit', time + .06);
      place(openMid, (bodyOut + front) / 2, .68, openW, .74, recess, 'ledge', time + .04);
      // Recessed display glazing with a heavy frame band above and a sill below.
      place(glassU, glassV, 2.55, glassW, 3, .22, 'shopglass', time + .06);
      place(glassU, outer - .32, 4.2, glassW + .2, .36, .42, 'trim', time + .06);
      place(glassU, outer - .32, .95, glassW + .2, .38, .42, 'trim', time + .06);
      // A lit back wall, a low counter and a shelf behind the glass: the interior
      // of a shop, seen through the glazing instead of painted on it.
      place(openMid, bodyOut + SHOP.lit / 2, 2.55, openW - .4, 3, SHOP.lit, 'shoplit', time + .07);
      place(openMid, bodyOut + .9, 1.73, openW - 1.2, 1.36, .9, 'counter', time + .08);
      place(openMid, bodyOut + .65, 3.2, openW - 1.4, .2, .5, 'shelf', time + .08);
      // Door recessed behind the shopfront plane: the frame post is its left
      // reveal, the party wall its right, the head band above and a step below.
      place(door, outer - .75, 2.25, SHOP.door, 3.9, .3, 'timber', time + .06);
      place(door, outer - .36, 4.38, SHOP.door + 2 * SHOP.reveal, .36, .48, 'reveal', time + .07);
      place(door, outer - .36, .4, SHOP.door + .1, .2, .48, 'trim', time + .1);
      // Awning with a hanging valance, then the coloured sign board that carries
      // the shop name — the ring reads as one terrace of shops from a distance.
      place(u, outer + SHOP.awning / 2, SHOP.awningY, width - .7, .2, SHOP.awning, 'awning', time + .12, awning);
      place(u, outer + SHOP.awning - .08, SHOP.awningY - .33, width - .7, .46, .14, 'awning', time + .12, awning);
      // The board is a board, held off the shopfront on two small brackets.
      var board = Math.min(5, width - .7);
      place(u, outer + .12, SHOP.fasciaY, board, SHOP.fascia, SHOP.board, 'awning', time + .14, awning);
      place(u - board / 2 - .02, outer + .12, 4.85, .24, .5, SHOP.board + .11, 'bracket', time + .16);
      place(u + board / 2 + .02, outer + .12, 4.85, .24, .5, SHOP.board + .11, 'bracket', time + .16);
      place(u, outer + .3, SHOP.fasciaY, Math.min(4.8, width - .95), SHOP.fascia - .22, .08, 'sign', time + .18, null,
        [name % SIGN_ATLAS.columns, Math.floor(name / SIGN_ATLAS.columns)]);
    }
    // Continuous cornice along the podium top, then the corner piers close the ring.
    place(0, (inner + outer) / 2, SHOP.height + .45, span, .38, depth + .16, 'trim', base + .52);
  }

  // The entrance side of a shop ring: no shops, the building's own lobby instead.
  // Its forecourt is the same paved band the shops would have used, and every part
  // stays inside it, so the reservation and the clearance accounting do not move.
  function buildLobby(building, site, side) {
    var depth = site.band[side], place = sidePlacer(building, site, side);
    var base = site.riseAt, axis = axisOf(side), sign = signOf(side);
    var inner = SHOP.gap, outer = inner + depth;
    var span = axis === 'z' ? building.w + 2 * outer : building.d;
    var half = Math.min(LOBBY.half, Math.max(LOBBY.door + 2, span / 2 - .8));
    var doorHalf = LOBBY.door + .03;
    // A shallow plot gets a slimmer entrance wall rather than none, the same way
    // the compound slims its rail when the ring is tight.
    var wall = Math.min(LOBBY.wall, Math.max(.6, depth * .45));
    var wallOut = inner + wall;
    var leaf = inner + wall * .4;
    var ground = .31, stepTop = ground + LOBBY.step, head = stepTop + 3.9;
    var wallTop = SHOP.height + .27;
    var forecourt = Math.max(.24, Math.min(1.7, outer - wallOut));
    place(0, (inner + outer) / 2, .27, span, .08, depth, 'paving', base - .32);
    // Wall panels leave the doorway open; the wall's own thickness is the reveal.
    place(-(half + doorHalf) / 2, wallOut - wall / 2, SHOP.height / 2 + .27, half - doorHalf, SHOP.height, wall, 'trim', base + .36);
    place((half + doorHalf) / 2, wallOut - wall / 2, SHOP.height / 2 + .27, half - doorHalf, SHOP.height, wall, 'trim', base + .36);
    place(0, wallOut - wall / 2, (head + wallTop) / 2, 2 * doorHalf, wallTop - head, wall, 'trim', base + .38);
    // A recessed double door with its reveal liner, a step and the head band.
    [-1, 1].forEach(function (end) {
      place(end * LOBBY.door / 2, leaf, (stepTop + head) / 2, LOBBY.door, 3.9, LOBBY.leaf, 'timber', base + .44);
      place(end * (LOBBY.door / 2 + LOBBY.reveal / 2), (leaf + LOBBY.leaf / 2 + wallOut) / 2, 2.35,
        LOBBY.reveal, 4.1, wallOut - leaf - LOBBY.leaf / 2, 'reveal', base + .45);
    });
    place(0, (leaf + LOBBY.leaf / 2 + wallOut) / 2, head + .1, LOBBY.door + 2 * LOBBY.reveal, .2,
      wallOut - leaf - LOBBY.leaf / 2, 'reveal', base + .46);
    place(0, wallOut + forecourt / 2, ground + LOBBY.step / 2, LOBBY.door + .3, LOBBY.step, forecourt, 'trim', base + .5);
    // Two piers, their caps, the canopy between them and the name board on its
    // fascia: the door is framed the way a real entrance is.
    [-1, 1].forEach(function (end) {
      place(end * (half + .3), (inner + wallOut) / 2, 3.45, LOBBY.pier, LOBBY.pierHeight, wall + .3, 'stone', base + .42);
      place(end * (half + .3), (inner + wallOut) / 2, 6.6 + .13, LOBBY.pier + .3, .26, wall + .6, 'trim', base + .5);
    });
    place(0, wallOut + forecourt / 2, 4.95, 2 * half - .5, LOBBY.canopy, forecourt, 'trim', base + .54);
    place(0, wallOut + forecourt - .15, 4.95, Math.min(4.6, half * 1.6), LOBBY.board, .3, 'board', base + .58, null,
      [site.nameIndex % PLAQUE_ATLAS.columns, Math.floor(site.nameIndex / PLAQUE_ATLAS.columns)]);
    // The approach in front of the doors stays clear: the corner piers are not
    // allowed to stand in it.
    var approach = axis === 'z'
      ? rect(building.x, building.z + sign * (building.d / 2 + (wallOut + outer) / 2), 2 * doorHalf + 1.2, outer - wallOut)
      : rect(building.x + sign * (building.w / 2 + (wallOut + outer) / 2), building.z, outer - wallOut, 2 * doorHalf + 1.2);
    approach.side = side;
    site.entry = { side: side, depth: depth, opening: approach };
  }

  function buildShops(city, building, site) {
    SIDES.forEach(function (side) { buildSide(city, building, site, side); });
    var scale = site.cornerScale || 1;
    var reach = SHOP.gap + Math.max.apply(null, SIDES.map(function (side) { return site.band[side] || 0; })) * scale;
    var base = site.riseAt;
    var opening = site.entry && site.entry.opening;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (corner, index) {
      var x = building.x + corner[0] * (building.w / 2 + reach);
      var z = building.z + corner[1] * (building.d / 2 + reach);
      var size = 1.9 * scale;
      // The ring keeps its corner piers, but they must not sit on the entrance
      // opening: a pier that would steps outward until it is clear.
      for (var push = 0; push < 4 && opening && overlaps(rect(x, z, size, size), opening, 0); push += 1) {
        var normal = normalOf(opening.side);
        x = rounded(x + normal.x * size);
        z = rounded(z + normal.z * size);
      }
      if (opening && overlaps(rect(x, z, size, size), opening, 0)) return;
      var pier = site.builder.add('stone', x, 3.15, z, size, 6.3, size, base + .2 + index * .04);
      var cap = site.builder.add('trim', x, 6.35, z, size + .5 * scale, .26, size + .5 * scale, base + .3 + index * .04);
      if (pier) pier.side = 'corner';
      if (cap) cap.side = 'corner';
    });
  }

  function buildWall(city, building, site) {
    var builder = site.builder, ring = site.ring, base = site.riseAt;
    // A shallow plot gets a slimmer section rather than no wall at all: the base,
    // piers and gate posts all scale with the room available behind the railing.
    var girth = Math.max(.58, Math.min(1, (ring - 1.1) / 2.6));
    var thickness = WALL.thickness * girth, pier = 1.1 * girth, gatePier = WALL.gatePier * girth;
    var halfW = building.w / 2 + ring, halfD = building.d / 2 + ring;
    SIDES.forEach(function (side, sideIndex) {
      var axis = axisOf(side), sign = signOf(side), yaw = yawOf(side);
      var span = axis === 'z' ? building.w + ring * 2 + WALL.thickness : building.d;
      var center = axis === 'z' ? building.z + sign * halfD : building.x + sign * halfW;
      var fixed = axis === 'z' ? building.x : building.z;
      var fraction = [0, .25, .5, .75][sideIndex];
      function sweep(local) { return base + (fraction + local * .25 * .9) * .9; }
      function put(position, y, alongWidth, height, outwardDepth, role, time, tint, tile) {
        var part = axis === 'z'
          ? builder.add(role, fixed + position, y, center, alongWidth, height, outwardDepth, time, tint, tile, yaw)
          : builder.add(role, center, y, fixed + position, outwardDepth, height, alongWidth, time, tint, tile, yaw);
        if (part) part.side = side;
        return part;
      }
      if (side === site.gate.side) {
        // Gated side: wall runs to the opening, then piers, leaves and the plaque.
        var half = WALL.gate / 2;
        [-1, 1].forEach(function (end) {
          var start = end < 0 ? -span / 2 : half;
          var stop = end < 0 ? -half : span / 2;
          var at = (start + stop) / 2, width = stop - start;
          if (width <= 0) return;
          var stagger = end < 0 ? 0 : .18;
          put(at, WALL.base / 2, width, WALL.base, thickness, 'stone', sweep(.06 + stagger));
          put(at, WALL.railTop, width, .17, .22 * girth, 'iron', sweep(.3 + stagger));
          put(at, 2.15, width, .12, .18 * girth, 'iron', sweep(.3 + stagger));
          put(at, 1.2, width, .12, .16 * girth, 'iron', sweep(.3 + stagger));
          var bars = Math.max(2, Math.floor(width / .75));
          for (var bar = 0; bar < bars; bar++) {
            put(start + width * ((bar + .5) / bars), 2.25, .1, 2.1, .1, 'iron', sweep(.42 + stagger));
          }
        });
        [-1, 1].forEach(function (end) {
          put(end * half, 2.45, gatePier, 4.9, gatePier, 'stone', sweep(.58));
          put(end * half, 5, gatePier + .3, .26, gatePier + .3, 'trim', sweep(.6));
          put(end * (WALL.gate / 4), 2.2, WALL.gate / 2 - .32, 4, .16, 'iron', sweep(.74));
          for (var leaf = 0; leaf < 6; leaf++) {
            put(end * (WALL.gate / 4) + (leaf - 2.5) * (WALL.gate / 2 - .7) / 6, 2.2, .1, 3.8, .1, 'iron', sweep(.78));
          }
        });
        put(0, 5.15, Math.min(4.4, span * .7), 1.5, .18, 'plaque', sweep(.9), null,
          [site.nameIndex % PLAQUE_ATLAS.columns, Math.floor(site.nameIndex / PLAQUE_ATLAS.columns)]);
      } else {
        put(0, WALL.base / 2, span, WALL.base, thickness, 'stone', sweep(.05));
        put(0, WALL.railTop, span, .17, .22 * girth, 'iron', sweep(.3));
        put(0, 2.15, span, .12, .18 * girth, 'iron', sweep(.3));
        put(0, 1.2, span, .12, .16 * girth, 'iron', sweep(.3));
        var verticals = Math.max(2, Math.floor(span / .75));
        for (var bar = 0; bar < verticals; bar++) {
          put(-span / 2 + span * ((bar + .5) / verticals), 2.25, .1, 2.1, .1, 'iron', sweep(.4));
        }
        var piers = Math.max(2, Math.round(span / WALL.pierStep));
        for (var post = 0; post <= piers; post++) {
          var at = -span / 2 + span * (post / piers);
          put(at, 1.95, pier, 3.9, pier, 'stone', sweep(.5));
          put(at, 4, pier + .22, .26, pier + .22, 'trim', sweep(.52));
        }
      }
      // Hedge line just inside the wall, then the gate axis keeps a clear path.
      var inner = ring - 1.4;
      var hedged = Math.max(1.8, (axis === 'z' ? building.w : building.d) + 2 * inner);
      if (axis === 'z') {
        builder.add('hedge', fixed, 1.1, center - sign * 1.2, hedged, 1.7, 1.4, base + .56, null, null, yaw);
      } else {
        builder.add('hedge', center - sign * 1.2, 1.1, fixed, 1.4, 1.7, hedged, base + .56, null, null, yaw);
      }
    });
    // Paved run from the gate to just short of the building, so it never grazes
    // the facade it leads to.
    var gaxis = axisOf(site.gate.side), gsign = signOf(site.gate.side);
    var run = Math.max(1.4, ring - .9);
    if (gaxis === 'z') {
      builder.add('paving', building.x, .29, building.z + gsign * (building.d / 2 + .9 + run / 2), 3.6, .08, run, base + .72);
    } else {
      builder.add('paving', building.x + gsign * (building.w / 2 + .9 + run / 2), .29, building.z, run, .08, 3.6, base + .72);
    }
    // Court planting fills the band between the building and the wall, never the
    // building itself, and always leaves the gate opening clear. Clump size is
    // bounded by the ring so a shallow plot still keeps them inside the railing.
    var clump = Math.min(2.2, Math.max(1.2, ring - .5));
    SIDES.forEach(function (side, sideIndex) {
      for (var step = 0; step < 2; step++) {
        var lateral = (step === 0 ? -.42 : .42) * (axisOf(side) === 'z' ? building.w : building.d) * .5 +
          (sideIndex % 2 === 0 ? -1.4 : 1.4);
        if (side === site.gate.side && Math.abs(lateral) < WALL.gate * .75) continue;
        var normal = normalOf(side), along = alongOf(side);
        var reach = (axisOf(side) === 'z' ? building.d : building.w) / 2 + ring * .55;
        builder.add('hedge', building.x + along.x * lateral + normal.x * reach, .88,
          building.z + along.z * lateral + normal.z * reach, clump, 1.75, clump,
          base + .82 + (sideIndex * 2 + step) * .03);
      }
    });
    for (var planter = 0; planter < 2; planter++) {
      var edge = planter === 0 ? -1 : 1;
      var px = gaxis === 'z' ? building.x + edge * (WALL.gate * .72) : building.x + gsign * (building.w / 2 + ring * .58);
      var pz = gaxis === 'z' ? building.z + gsign * (building.d / 2 + ring * .58) : building.z + edge * (WALL.gate * .72);
      builder.add('stone', px, .75, pz, 1.7, 1.5, 1.7, base + .88);
      builder.add('hedge', px, 1.85, pz, 1.5, .75, 1.5, base + .92);
    }
  }

  // Reserve the built band so street furniture, planting and newly generated
  // walking routes keep out — the same contract the river markets use. A shop site
  // reserves every side that carries a band, the entrance forecourt included.
  function reserve(site) {
    if (site.type === 'shops') {
      return SIDES.filter(function (side) { return site.band[side]; }).map(function (side) {
        return sideBar(site.building, side, SHOP.gap, site.band[side]);
      });
    }
    return [rect(site.x, site.z, site.w + 2 * site.ring, site.d + 2 * site.ring)];
  }

  function makeSite(building, index, type, band, ring, gateSideName) {
    var seed = building.detailSeed || index;
    return {
      id: 'frontage-' + building.id, building: building, type: type,
      x: building.x, z: building.z, w: building.w, d: building.d,
      band: band, ring: ring, unitCount: 0, units: [], gaps: [],
      entrySide: null, entry: null,
      styleIndex: seed % AWNING_COLORS.length,
      nameIndex: PUBLIC_GATE_NAMES[building.facility] ? COMPOUND_NAMES.indexOf(PUBLIC_GATE_NAMES[building.facility]) : seed % HOME_NAME_COUNT,
      phase: (seed % 97) / 97 * Math.PI * 2,
      riseAt: rounded((building.start || 0) + (type === 'wall' ? .2 : .35)),
      gate: type === 'wall' ? { side: gateSideName } : null
    };
  }

  // The plan is only credible if the geometry it emits is clear, and the built
  // parts are wider than the ring line they stand on (gate piers, corner piers,
  // pier caps). So every part is validated after building, and the band steps
  // down a notch until the real boxes fit — or the plot is left without frontage.
  function buildAndCheck(city, building, index, type, band, ring, gateSideName, sweeps, cornerScale, entrySide) {
    var site = makeSite(building, index, type, band, ring, gateSideName);
    site.cornerScale = cornerScale || 1;
    site.entrySide = entrySide || null;
    site.builder = makeBuilder();
    if (type === 'shops') buildShops(city, building, site);
    else buildWall(city, building, site);
    site.parts = site.builder.parts;
    site.builder = null;
    for (var step = 0; step < site.parts.length; step += 1) {
      if (!partClear(city, site.parts[step], .08, sweeps)) return { site: site, blocked: site.parts[step] };
    }
    return { site: site, blocked: null };
  }

  function plan(city) {
    var sites = [], reservations = [], sweeps = [];
    // Civic entrances live on the facility records, keyed by the building they replaced.
    var entrances = {};
    (city.facilities || []).forEach(function (facility) {
      if (facility.entrance) entrances[facility.id] = facility.entrance;
    });
    (city.buildings || []).forEach(function (building, index) {
      var type = frontageType(building);
      if (!type) return;  // the mall: no site, no reservation, nothing to keep clear of
      var gate = type === 'wall' ? gateSide(building, city.roads, entrances[building.id]) : null;
      var band = {}, ring = 0, attempt = null;
      if (type === 'shops') {
        SIDES.forEach(function (side) { band[side] = bestShopDepth(city, building, side, sweeps); });
        if (SIDES.every(function (side) { return !band[side]; })) return;
        var entryOrder = entryLadder(building, city.roads);
        var corner = 1;
        for (var step = 0; step < 16; step += 1) {
          // The lobby takes the street side that kept its band: shops on the other
          // three, the building's own entrance on this one.
          var open = entryOrder.filter(function (side) { return band[side] > 0; });
          attempt = buildAndCheck(city, building, index, type, band, 0, null, sweeps, corner, open.length ? open[0] : null);
          if (!attempt.blocked) break;
          var blocker = attempt.blocked.side;
          attempt = null;
          // Give ground where the collision actually is: corners pull in first,
          // then only the blocked side narrows, so the other bays keep their depth.
          if (blocker === 'corner' && corner > .5) { corner = rounded(corner * .82); continue; }
          if (blocker && band[blocker] > 0) {
            band[blocker] = rounded(band[blocker] - .4) >= SHOP.minDepth ? rounded(band[blocker] - .4) : 0;
            if (SIDES.every(function (side) { return !band[side]; })) break;
            continue;
          }
          break;
        }
      } else {
        var ladder = ringLadder();
        var start = ladder.indexOf(compoundRing(city, building, sweeps));
        for (var level = start < 0 ? 0 : start; level < ladder.length; level += 1) {
          attempt = buildAndCheck(city, building, index, type, band, ladder[level], gate, sweeps, 1);
          if (!attempt.blocked) { ring = ladder[level]; break; }
          attempt = null;
        }
      }
      if (!attempt) return;
      var site = attempt.site;
      site.ring = ring;
      site.settleAt = site.parts.reduce(function (latest, part) { return Math.max(latest, part.t); }, 0);
      reserve(site).forEach(function (bar) {
        reservations.push({ kind: 'frontage', id: site.id, x: bar.x, z: bar.z, w: bar.w, d: bar.d });
      });
      // Later sites must not be planned through an earlier plot's ring.
      var reach = type === 'wall' ? ring : SHOP.gap + Math.max.apply(null, SIDES.map(function (side) { return band[side] || 0; }));
      sweeps.push(rect(building.x, building.z, building.w + 2 * reach, building.d + 2 * reach));
      sites.push(site);
    });
    return { type: 'frontage', sites: sites, reservations: reservations, sweeps: sweeps };
  }

  function create(T, kit, city, planData) {
    var data = planData || plan(city);
    var group = new T.Group();
    group.name = 'city-frontage';
    var geometries = [new T.BoxGeometry(1, 1, 1)];
    var materials = [], meshes = [], disposed = false, instances = 0;
    function material(name, options) {
      var m = new T.MeshStandardMaterial(options);
      m.name = name; materials.push(m); return m;
    }
    var roles = {
      paving: kit.pavement, stone: kit.stone, hedge: kit.leaf,
      iron: material('frontage-iron', { color: '#3d4a50', roughness: .44, metalness: .58 }),
      shopbody: material('frontage-shop-body', { color: '#f0e9da', roughness: .86 }),
      trim: material('frontage-trim', { color: '#f6f1e6', roughness: .72 }),
      timber: material('frontage-timber', { color: '#937052', roughness: .82 }),
      // Shop glazing is lit from inside, not painted on: a pale glass body with a
      // soft glow, thin enough to read the lit back wall and counter through it.
      shopglass: material('frontage-shop-glass', {
        color: '#a9c8cd', roughness: .3, metalness: .08, transparent: true, opacity: .52,
        depthWrite: false, emissive: '#66766f', emissiveIntensity: .5
      }),
      shoplit: material('frontage-shop-lit', {
        color: '#e9dcc0', roughness: .84, emissive: '#c3a273', emissiveIntensity: .5
      }),
      awning: material('frontage-awning', { color: '#ffffff', roughness: .78 })
    };
    // Roles are schema labels, one material is one batch: the jamb posts ride the
    // trim, the threshold the stone, the interior the timber and the brackets the
    // iron, so a fancier shopfront costs no extra draw call.
    ['jamb', 'reveal', 'soffit'].forEach(function (role) { roles[role] = roles.trim; });
    ['counter', 'shelf'].forEach(function (role) { roles[role] = roles.timber; });
    roles.ledge = roles.stone;
    roles.bracket = roles.iron;

    // Signs share one texture atlas; a per-instance UV tile picks the name, so all
    // shop boards in the city cost a single draw call (and one more for plaques).
    function atlas(names, columns) {
      if (!root.document) return null;
      // A 4:1 cell matches the sign board, so names are not squeezed.
      var cell = 512, rowHeight = 128, rows = Math.ceil(names.length / columns);
      var canvas = root.document.createElement('canvas');
      canvas.width = cell * columns; canvas.height = rowHeight * rows;
      var context = canvas.getContext('2d');
      context.fillStyle = '#f6f1e2'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.font = '600 76px "Microsoft YaHei",sans-serif';
      context.textAlign = 'center'; context.textBaseline = 'middle';
      names.forEach(function (name, index) {
        var col = index % columns, row = Math.floor(index / columns);
        context.fillStyle = ['#6b4a3a', '#3f5a63', '#4e5b45'][index % 3];
        context.fillText(name, col * cell + cell / 2, row * rowHeight + rowHeight / 2);
      });
      var texture = new T.CanvasTexture(canvas);
      texture.colorSpace = T.SRGBColorSpace;
      // 发光招牌（亮化第二批 #6）：emissiveMap 复用同一张图，夜里按 lamps 微光——
      // 店招是灯箱，但亮度克制（不抢橱窗）；plaque 不驱动、intensity 保持 0。
      var sheet = material('frontage-atlas', { map: texture, roughness: .8,
        emissive: new T.Color('#ffffff'), emissiveMap: texture, emissiveIntensity: 0 });
      // The include is still unresolved when onBeforeCompile runs, so the tile is
      // applied by replacing <map_fragment> itself. Per-material scale keeps the
      // differently sized shop and gate atlases on the same shader program.
      var scale = { value: new T.Vector2(1 / columns, 1 / rows) };
      sheet.customProgramCacheKey = function () { return 'frontage-atlas-scale-v1'; };
      sheet.onBeforeCompile = function (shader) {
        shader.uniforms.frontageAtlasScale = scale;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nattribute vec2 instanceTile;\nvarying vec2 vTile;')
          .replace('#include <uv_vertex>', '#include <uv_vertex>\nvTile = instanceTile;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec2 vTile;\nuniform vec2 frontageAtlasScale;')
          .replace('#include <map_fragment>',
            '#ifdef USE_MAP\n\tvec4 sampledDiffuseColor = texture2D( map, vMapUv * frontageAtlasScale + vTile );\n' +
            '\tdiffuseColor *= sampledDiffuseColor;\n#endif')
          .replace('#include <emissivemap_fragment>',
            '#ifdef USE_EMISSIVEMAP\n\tvec4 sampledEmissiveColor = texture2D( emissiveMap, vMapUv * frontageAtlasScale + vTile );\n' +
            '\ttotalEmissiveRadiance *= sampledEmissiveColor.rgb;\n#endif');
      };
      sheet.userData.atlas = { columns: columns, rows: rows };
      materials.push(texture);
      return sheet;
    }
    var sheets = { sign: atlas(SHOP_NAMES, SIGN_ATLAS.columns), plaque: atlas(COMPOUND_NAMES, PLAQUE_ATLAS.columns) };

    var batches = new Map();
    data.sites.forEach(function (site) {
      site.parts.forEach(function (part) {
        if (part.role === 'skip') return;
        // Boards share the plaque atlas, signs the shop one; both are per-instance
        // tiles, so all shop names and all lobby name boards cost two draw calls.
        var sheet = part.role === 'sign' ? sheets.sign
          : part.role === 'plaque' || part.role === 'board' ? sheets.plaque : null;
        var mat = sheet || roles[part.role];
        if (!mat) return;
        var key = mat.uuid;
        if (!batches.has(key)) batches.set(key, { material: mat, sheet: sheet, parts: [] });
        batches.get(key).parts.push(part);
      });
    });

    var matrix = new T.Matrix4(), position = new T.Vector3(), scale = new T.Vector3();
    var rotation = new T.Quaternion(), up = new T.Vector3(0, 1, 0), color = new T.Color();
    batches.forEach(function (batch) {
      // Appearance-time order lets a drawn prefix be the construction state.
      batch.parts.sort(function (a, b) { return a.t - b.t || a.x - b.x || a.z - b.z || a.y - b.y; });
      var geometry = batch.sheet ? new T.PlaneGeometry(1, 1) : geometries[0];
      if (batch.sheet) geometries.push(geometry);
      var mesh = new T.InstancedMesh(geometry, batch.material, batch.parts.length);
      mesh.name = batch.sheet ? 'frontage-signs' : batch.material.name;
      var tiles = batch.sheet ? new Float32Array(batch.parts.length * 2) : null;
      batch.parts.forEach(function (part, index) {
        if (batch.sheet) {
          var atlasInfo = batch.material.userData.atlas;
          var cell = part.tile || [0, 0];
          tiles[index * 2] = cell[0] / atlasInfo.columns;
          // Canvas rows run top-down while texture v runs bottom-up.
          tiles[index * 2 + 1] = (atlasInfo.rows - 1 - cell[1]) / atlasInfo.rows;
          // A sheet is a flat plane turned to face its side, so its own X is the
          // along-side width. Reading w would use the outward depth on x sides and
          // squirt the name into a sliver.
          var sideways = Math.abs(Math.sin(part.yaw)) > .5;
          rotation.setFromAxisAngle(up, part.yaw);
          scale.set(sideways ? part.d : part.w, part.h, 1);
        } else {
          rotation.identity();
          scale.set(part.w, part.h, part.d);
        }
        position.set(part.x, part.y, part.z);
        matrix.compose(position, rotation, scale);
        mesh.setMatrixAt(index, matrix);
        if (!batch.sheet) { color.set(part.tint || '#ffffff'); mesh.setColorAt(index, color); }
      });
      if (tiles) geometry.setAttribute('instanceTile', new T.InstancedBufferAttribute(tiles, 2));
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = !batch.sheet && batch.material !== kit.pavement && batch.material !== kit.leaf;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.userData.times = batch.parts.map(function (part) { return part.t; });
      instances += batch.parts.length;
      group.add(mesh); meshes.push(mesh);
    });

    // Shop-front pools (lighting pass one): one additive decal on the pavement in
    // front of every lit shop window, driven by the same trading clock as the
    // shoplit wall — a lit window that lights nothing around it reads as a dull
    // facade at night. One InstancedMesh for all units; skipped without the pool
    // atlas (Node tests) so the existing drawCalls assertions still hold.
    var shopPoolMaterial = null, shopPoolMesh = null;
    if (kit && kit.lightPoolMap) {
      var shopPoolAnchors = [];
      // Keep each pool on its own shop construction clock.
      data.sites.forEach(function (site) {
        if (site.type !== 'shops') return;
        site.parts.forEach(function (part) {
          if (part.role !== 'shoplit') return;
          var axis = axisOf(part.side), normal = normalOf(part.side);
          var along = Math.max(3, (axis === 'z' ? part.w : part.d) * .65);
          var out = SHOP.lit / 2 + 1.15;
          shopPoolAnchors.push({ x: part.x + normal.x * out, z: part.z + normal.z * out, y: .31,
            t: part.t, w: axis === 'z' ? along : 2.3, d: axis === 'z' ? 2.3 : along });
        });
      });
      shopPoolAnchors.sort(function(a,b){return a.t-b.t;});
      if (shopPoolAnchors.length) {
        shopPoolMaterial = material('frontage-shop-pools', {
          color: '#ffd9a0', map: kit.lightPoolMap, transparent: true, opacity: 0,
          depthWrite: false, blending: T.AdditiveBlending, toneMapped: false });
        var shopPoolGeometry = new T.PlaneGeometry(1, 1);
        shopPoolGeometry.rotateX(-Math.PI / 2); geometries.push(shopPoolGeometry);
        shopPoolMesh = new T.InstancedMesh(shopPoolGeometry, shopPoolMaterial, shopPoolAnchors.length);
        shopPoolMesh.name = 'frontage-shop-pools'; shopPoolMesh.frustumCulled = false; shopPoolMesh.visible = false;
        var poolMatrix = new T.Matrix4(), poolPosition = new T.Vector3(), poolScale = new T.Vector3();
        var poolDown = new T.Quaternion();
        shopPoolAnchors.forEach(function (anchor, index) {
          poolPosition.set(anchor.x, anchor.y, anchor.z); poolScale.set(anchor.w, 1, anchor.d);
          poolMatrix.compose(poolPosition, poolDown, poolScale);
          shopPoolMesh.setMatrixAt(index, poolMatrix);
        });
        shopPoolMesh.instanceMatrix.needsUpdate = true;
        // The pools belong to the shops: the same built-prefix clock that raises
        // the shoplit walls raises them, so a half-built city has no night lamps.
        shopPoolMesh.count = 0;
        shopPoolMesh.userData.times = shopPoolAnchors.map(function(a){return a.t;});
        group.add(shopPoolMesh); meshes.push(shopPoolMesh);
      }
    }

    // Time is a query, never accumulated state: the drawn prefix is recomputed
    // from the sorted times, so pause, rewind and export all agree.
    function getLightAnchors(){
      return data.sites.flatMap(site=>{
        const b=site.building;if(!b||!b.ledgerId)return [];
        return site.parts.filter(p=>p.role==='board').map(p=>({building:b,ledgerId:b.ledgerId,floor:0,layer:'entry',
          local:[p.x-b.x,p.y-p.h/2-.10-1.4,p.z-b.z,p.w+.025,.08,p.d+.025]}));
      });
    }
    function update(time,lighting) {
      if(lighting){
        const trading=lighting.minute>=420&&lighting.minute<1320;
        roles.shoplit.emissiveIntensity=trading?.3+lighting.lamps*1.2:0;
        roles.shopglass.emissiveIntensity=trading?.15+lighting.lamps*.35:0;
        // 店招灯箱（#6）：随 trading 钟，亮度纯随 lamps——白天日光下灯箱不发光。
        // 夜市补光：.57 在成片里读作"暗板"，抬到 1.35 让字真正发亮；
        // 仍随 lamps 走，日光下恒为 0。
        if(sheets.sign)sheets.sign.emissiveIntensity=trading?lighting.lamps*1.35:0;
        if(shopPoolMesh){
          shopPoolMaterial.opacity=trading?lighting.lamps*.62:0;
          shopPoolMesh.visible=trading&&lighting.lamps>0;
        }
      }
      if (disposed) return;
      var moment = Number.isFinite(time) ? time : 0;
      for (var index = 0; index < meshes.length; index++) {
        var mesh = meshes[index], times = mesh.userData.times;
        var low = 0, high = times.length;
        while (low < high) {
          var mid = (low + high) >> 1;
          if (times[mid] <= moment) low = mid + 1; else high = mid;
        }
        if (mesh.count !== low) mesh.count = low;
      }
    }
    function visibleParts(time) {
      var moment = Number.isFinite(time) ? time : 0;
      return data.sites.reduce(function (total, site) {
        return total + site.parts.filter(function (part) { return part.t <= moment; }).length;
      }, 0);
    }
    function getInfo() {
      return {
        ready: !disposed,
        sites: data.sites.length,
        shops: data.sites.filter(function (site) { return site.type === 'shops'; }).length,
        compounds: data.sites.filter(function (site) { return site.type === 'wall'; }).length,
        shopUnits: data.sites.reduce(function (total, site) { return total + site.unitCount; }, 0),
        shopPools: disposed || !shopPoolMesh ? 0 : shopPoolMesh.count,
        parts: data.sites.reduce(function (total, site) { return total + site.parts.length; }, 0),
        instances: instances,
        drawCalls: disposed ? 0 : meshes.length,
        gates: data.sites.filter(function (site) { return site.gate; })
          .map(function (site) { return { id: site.id, side: site.gate.side }; }),
        entries: data.sites.filter(function (site) { return site.entrySide; })
          .map(function (site) { return { id: site.id, side: site.entrySide, depth: site.entry.depth }; }),
        rings: data.sites.map(function (site) {
          return {
            id: site.id, type: site.type, x: site.x, z: site.z, w: site.w, d: site.d,
            ring: site.ring, band: site.band, gaps: site.gaps, units: site.unitCount,
            entrySide: site.entrySide, gate: site.gate,
            riseAt: site.riseAt, settleAt: site.settleAt, parts: site.parts.length
          };
        })
      };
    }
    function dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      meshes.forEach(function (mesh) { mesh.dispose(); });
      if (shopPoolMesh) shopPoolMesh.dispose();
      geometries.forEach(function (geometry) { geometry.dispose(); });
      materials.forEach(function (entry) { entry.dispose(); });
      group.clear();
    }
    return { group: group, update: update, dispose: dispose, getInfo: getInfo, getLightAnchors:getLightAnchors, plan: data, visibleParts: visibleParts, roles: roles };
  }

  return {
    plan: plan, create: create, frontageType: frontageType,
    reserveBars: reserve, SHOP: SHOP, WALL: WALL, LOBBY: LOBBY,
    SHOP_NAMES: SHOP_NAMES, COMPOUND_NAMES: COMPOUND_NAMES
  };
});
