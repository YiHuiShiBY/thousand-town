(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CityModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var FLOOR_HEIGHT = 6;
  var EPSILON = 1e-9;

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  function option(value, fallback, low, high) {
    return Number.isFinite(value) ? clamp(value, low, high) : fallback;
  }

  function normalizeSeed(seed) {
    return Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 1;
  }

  var randomGenerator = (typeof CityRandom === 'object' && CityRandom && CityRandom.randomGenerator)
    ? CityRandom.randomGenerator
    : (typeof require === 'function' ? require('./city-random.js').randomGenerator : null);

  function rounded(value) {
    return Math.round(value * 1000) / 1000;
  }

  function insideExpandedRect(x, z, rect, margin) {
    return Math.abs(x - rect.x) < rect.w / 2 + margin &&
      Math.abs(z - rect.z) < rect.d / 2 + margin;
  }

  // The board ends here. Actors are routed past that line on purpose, so both
  // renderers ask the same question about them: the WebGL scene and the Canvas
  // fallback hide an actor exactly when it is off the board.
  function onBoard(city, x, z) {
    return Math.abs(x) <= city.extentX && Math.abs(z) <= city.extentZ;
  }

  function createCity(seed, options) {
    options = options && typeof options === 'object' ? options : {};
    seed = normalizeSeed(seed);
    // 258 = the far row centre at ±200 plus the same 58-unit margin a row had against
    // the old board edge, which keeps the lot pitch identical at every row. The board is
    // now 380 × 516, so its half-diagonal is 322: beyond the ±270 shadow frustum (see
    // §4.4 代价 1 — the frustum is T3's call, the geometry is Stage 0's).
    var extentX = 190, extentZ = 258;
    var density = option(options.density, 0.82, 0.35, 1);
    var skyline = option(options.skyline, 1, 0.55, 1.45);
    var random = randomGenerator(seed);
    // W1.5b Stage 0: the board grows by one row at each end, never in x. Four columns
    // are a promise to the rest of the system — `index = row*4 + col`, the HUD's four
    // CSS columns, and the A/D station rule all read the column out of `index % 4` —
    // so only `zs` grows, and every index-keyed table below shifts by exactly four.
    var xs = [-132, -60, 60, 132];
    var zs = [-200, -120, -40, 40, 120, 200];
    // Old 4×4 tables, translated row+1: park [0,7,12] → [4,11,16], tower [1,2,5] →
    // [5,6,9]. Rows 0 and 5 (index 0-3 and 20-23) are the eight new lots W1.5b fills.
    var parkLots = [4, 11, 16];
    // 台账里有四栋写字楼（t-one…t-four，§4.5 的 31 栋表），而 V2 的 4×4 盘面上只
    // 有三个塔位。扩到 4×6 之后北行（row 0）腾出了格 3，第四栋塔就落在那里：
    // x=132 / z=-200，与 §4.4 的"北行放写字楼 #4"一致，也避开公园（4/11/16）、
    // 车站（12）与 T1 的四个新功能体（0/1/20/21/22/23）。
    var towerLots = [3, 5, 6, 9];
    var buildings = [];
    var parks = [];
    var trees = [];
    var roads = [];
    // The five street rows, named once so the tunnel records below can take
    // their z from the outermost rows (the two ring roads) instead of restating
    // ±160 by hand.
    var streetZs = [-160, -80, 0, 80, 160];
    var water = { x: 0, z: 0, w: 30, d: 516 };
    var bridges = [-80, 80].map(function (z) {
      return { x: 0, z: z, w: 46, d: 15 };
    });
    // Two footbridges span the canal between the carriageway crossings. They are
    // narrow enough to leave the promenade markets untouched, and are flagged so
    // only the walking model uses them: no vehicle route reaches them.
    [-40, 40].forEach(function (z) {
      bridges.push({ x: 0, z: z, w: 44, d: 5, pedestrian: true });
    });

    // V4 北/南外环快速路（2026-09-21 用户拍板）：过境交通绕镇走。两条快速路
    // 放在 z = ±245 的边带上——最外地块行止于 ±236，板边 ±258，这条带里既无
    // 建筑、树木也无步道——中段抬成高架，一次跨过西堤大道、河面与东堤
    // 大道，两端引桥落在环路路口外侧的接地段上，不在镇内、更不在滨河夜市
    // 走廊的地面上增加任何交叉口。一条 viaduct 记录只带纵断四数，桥面板、
    // 桥墩、引桥、护栏与以后的行驶高度全部由它们导出，记录里不留绝对坐标：
    //   height — 高架路面顶标高。.25 是全镇路面基准；8.45 给堤大道留出 8.2
    //             净空（2026-09-21 用户拍板"再高一些显得震撼"：5.45→8.45，
    //             约一层半楼），最高车顶约 3.45，行人灯杆 8.5 只在镇内侧
    //             |x| < 156，收边带内无灯无树，桥下净空富余。
    //   flatX  — 满高段半长（|x| ≤ 120，加高后从 140 收进，把多出的高差
    //             摊进更长的引桥，坡度峰值与 5.45/30 档基本持平）。
    //   rampX  — 引桥水平长（120 → 170 爬完 8.2，接地点仍在环路内沿）。
    //   d      — 路幅全宽 12，与横街同断面：10.2 路面 + 两侧 2.4 路缘。
    var viaducts = [-245, 245].map(function (z) {
      return { z: z, d: 12, height: 8.45, flatX: 120, rampX: 50 };
    });

    // V4: two cut-and-cover tunnels close the ring roads (E1 / E5) under the
    // canal. The streets themselves still stop at the bank in `roads` — every
    // collision rule that reads them, and the model test that refuses asphalt
    // over water, stay untouched — so a tunnel is its own record: the street's
    // z plus the three numbers of its longitudinal profile. Portals, deck, tube
    // and the ramp the cars drive all derive from these and from `water`, so
    // nothing below stores an absolute coordinate of its own.
    //   drop    — how far the carriageway sinks below the .25 pavement datum in
    //              the covered section. 4.5 clears the tallest vehicle (a
    //              shuttle roof tops out near 3.45) with headroom to spare.
    //   portalX — where the asphalt starts sinking. The avenue junction's stop
    //              bars sit at |x| = 85, so 84 keeps the whole crossing on flat
    //              road and the descent reads as "just past the avenue".
    //   coverX  — where the flush lid begins. It must start outside the night
    //              market corridor (plots reach u = 33.95) or the open cut
    //              would sever the riverside walk; from here to the far bank
    //              the surface is one continuous sidewalk over the tube.
    var tunnels = [streetZs[0], streetZs[streetZs.length - 1]].map(function (z) {
      return { z: z, halfD: 6, portalX: 84, coverX: 35, drop: 4.5 };
    });

    // Each horizontal street starts on the canal bank — the water owns |x| < 15 —
    // and either runs out past the board edge (the through streets, so the asphalt
    // still covers a car whose centre is on the edge) or stops at the ring roads
    // (2026-09-21 用户拍板：中街与北/南环路不再连接市外). A closed street ends flush
    // with the ring road's outer edge, so the junction keeps its full crosswalk
    // layout and the only way onward is the ring road itself. Only ±80 carries
    // wheels across the water, and the footbridges stay at ±40.
    var canalBank = water.w / 2, streetReach = extentX + 5;
    var ringRoadX = 175, ringRoadHalf = 5, closedReach = ringRoadX + ringRoadHalf;
    // Every street still lies on a row boundary: six rows have five gaps, so ±160 join
    // the old -80/0/80. Like the middle street, the two new ones stop at the bank —
    // only ±80 carries wheels across the water, and the footbridges stay at ±40.
    streetZs.forEach(function (z) {
      var through = z === -80 || z === 80;
      var reach = through ? streetReach : closedReach;
      var centre = (canalBank + reach) / 2;
      [-centre, centre].forEach(function (x) {
        roads.push({ x: x, z: z, w: reach - canalBank, d: 12, axis: 'x', closed: !through });
      });
    });
    // 中街步行街（2026-09-21 拍板）：z=0 横街的河侧两段（西1段/东1段，|x| 从河岸
    // 15 到堤大道路缘 96-5=91）去掉车道、改行人铺装。标记只挂在这两半幅的记录
    // 上：roadCuts 在绘制层据此切走沥青与中线虚线，而记录本身的长宽与端点不动——
    // 所有读 roads 的碰撞口径（避让/家具/落位）原样成立。没有车流经过这条带：
    // 四条车环与骑行环都在 z≥±77.6，公交只走 ±80 两街，所以去车道不搁浅任何车。
    roads.forEach(function (road) {
      if (road.axis === 'x' && road.z === 0) road.walkOnlyTo = 91;
    });
    // The north-south avenues are the only way to reach the far rows from either bank,
    // so they run the full height of the board instead of the old 320.
    [-96, 96].forEach(function (x) {
      roads.push({ x: x, z: 0, w: 10, d: 516, axis: 'z' });
    });
    // Two perimeter ring roads (the atlas calls them 西环路 / 东环路) between the
    // lot columns — whose buildings, parks and reservations stop at |x| ≤ 158 —
    // and the board edge at ±190. Full board height like the avenues; the
    // east-west streets already reach out past ±175, so the five junctions per
    // ring get their markings from the same crossing logic that serves the
    // avenues, and no building, tree or piece of street furniture ever stood in
    // the 170–180 band.
    [-175, 175].forEach(function (x) {
      roads.push({ x: x, z: 0, w: 10, d: 516, axis: 'z' });
    });
    // The two expressway ground stubs close each ring-road junction: the viaduct
    // touches down exactly where the stub begins (|x| = 170) and the asphalt runs
    // on out past the board edge like every other street, so the "城外起讫" reads
    // as road, not as a ramp cut off in mid-air. `unlit` keeps the kerb-lamp loop
    // away: the band beyond the ring roads stays unlit by the same design that
    // leaves the street stubs dark, and the deck gets its own lamps later.
    viaducts.forEach(function (viaduct) {
      [-1, 1].forEach(function (side) {
        roads.push({ x: side * 182.5, z: viaduct.z, w: 25, d: 12, axis: 'x', unlit: true });
      });
    });

    var splitCandidates = [];
    for (var lot = 0; lot < 24; lot += 1) {
      if (parkLots.indexOf(lot) === -1 && towerLots.indexOf(lot) === -1) {
        splitCandidates.push({ lot: lot, rank: random() });
      }
    }
    splitCandidates.sort(function (a, b) { return a.rank - b.rank; });
    var splitCount = Math.round(5 + 5 * (density - 0.35) / 0.65);
    var splitLots = splitCandidates.slice(0, splitCount).map(function (item) { return item.lot; });

    for (var row = 0; row < zs.length; row += 1) {
      for (var col = 0; col < xs.length; col += 1) {
        var index = row * 4 + col;
        var x = xs[col];
        var z = zs[row];
        if (parkLots.indexOf(index) !== -1) {
          parks.push({ x: x, z: z, w: 52, d: 58 });
          continue;
        }

        var tower = towerLots.indexOf(index) !== -1;
        var split = splitLots.indexOf(index) !== -1;
        var splitAlongX = (row + col) % 2 === 0;
        // A split lot is two halves sharing one corridor, and both halves need
        // frontage: whichever is planned first reserves its compound ring as a
        // sweep the second may not cross. Worst case the first takes the deepest
        // ring (7.5) and the second still needs its narrowest wall (2.2 + half a
        // .41 section + the .08 check gap), so the corridor has to clear 9.6. The
        // lot window caps the reach at 25 across a column and 28 down a row, so
        // the room has to come from the footprints, not from pushing the halves
        // out: 15 apart with 16-19 wide halves gives 11-14, and 16.5 apart with
        // 20-22 deep halves gives 11-13, both inside the window. Measured over 12
        // seeds x densities .35/.8/1, no plot loses its frontage at these numbers;
        // the old 13/15 with 19-22 x 22-25 left a 4-7 corridor and dropped plots.
        for (var unit = 0; unit < (split ? 2 : 1); unit += 1) {
          var offset = unit === 0 ? -1 : 1;
          var w = tower ? 27 + random() * 5 : 38 + random() * 7;
          var d = tower ? 32 + random() * 7 : 41 + random() * 8;
          var bx = x;
          var bz = z;
          if (split && splitAlongX) {
            w = 16 + random() * 3;
            bx += offset * 15;
          } else if (split) {
            d = 20 + random() * 2;
            bz += offset * 16.5;
          }

          var baseFloors = tower ? 18 + Math.floor(random() * 5) :
            (split ? 5 + Math.floor(random() * 6) : 8 + Math.floor(random() * 6));
          var floors = Math.max(3, Math.round(baseFloors * skyline));
          var kind = tower ? 'glass' : (random() < 0.77 ? 'stone' : 'sand');
          var roofChoice = random();
          buildings.push({
            id: 'b-' + index + '-' + unit,
            x: rounded(bx), z: rounded(bz), w: rounded(w), d: rounded(d),
            floors: floors, floorHeight: FLOOR_HEIGHT,
            kind: kind,
            roof: tower ? (roofChoice < 0.55 ? 'solar' : 'terrace') :
              (roofChoice < 0.42 ? 'garden' : roofChoice < 0.72 ? 'solar' : 'terrace'),
            detailSeed: Math.floor(random() * 4294967296),
            start: 0, step: 0, fallDuration: 0
          });
        }
      }
    }

    // The tallest tower carries the rooftop helipad, and its roof carries nothing
    // else: 'plain' tells every roof builder to lay no equipment, so the pad stands
    // alone up there. Chosen here rather than in the scene because both roof
    // builders (the Blender district and the procedural one) read this field, and
    // the helipad picks the same building — the tallest one that is neither civic
    // nor housing, which is always a tower.
    var tallest = null;
    buildings.forEach(function (building) {
      if (building.kind !== 'glass') return;
      if (!tallest || building.floors > tallest.floors ||
        (building.floors === tallest.floors && building.id < tallest.id)) tallest = building;
    });
    if (tallest) tallest.roof = 'plain';

    // A deterministic shuffled construction order lets several streets grow together.
    var schedule = buildings.map(function (building) {
      return { building: building, rank: random(), speed: random(), overlap: random() };
    }).sort(function (a, b) { return a.rank - b.rank; });
    var rawEnd = 0;
    schedule.forEach(function (entry, index) {
      var building = entry.building;
      building.start = index * 21 / (schedule.length - 1);
      building.step = 0.63 + entry.speed * 0.12;
      building.fallDuration = building.step * (1.48 + entry.overlap * 0.38);
      rawEnd = Math.max(rawEnd, building.start + (building.floors - 1) * building.step + building.fallDuration);
    });

    var duration = rounded(36 + 4 * density + 2 * (skyline - 0.55) / 0.9);
    var timeScale = duration / rawEnd;
    buildings.forEach(function (building) {
      building.start *= timeScale;
      building.step *= timeScale;
      building.fallDuration *= timeScale;
    });

    // A tree may not stand where a plot has to keep its frontage. The narrowest
    // compound the frontage planner can build is WALL.minRing (2.2) past the
    // facade with a .41 section half, and `partClear` refuses that ring for a
    // crown whose refusal circle (r*.65 + .4) touches it, plus the .08 check gap.
    // So a crown must stay `r*.65 + 3.1` clear of every footprint — that is
    // stricter than the crown's own radius everywhere a tree is planted here, so
    // it is the one building rule; below it the tree wins the ground and the plot
    // loses its shops, its wall or its gate.
    function inFrontage(x, z, radius) {
      var keep = radius * .65 + 3.1;
      return buildings.some(function (building) { return insideExpandedRect(x, z, building, keep); });
    }

    function addTree(x, z, radius, height) {
      if (insideExpandedRect(x, z, water, radius + 0.7)) return;
      if (inFrontage(x, z, radius)) return;
      if (roads.some(function (road) { return insideExpandedRect(x, z, road, radius + 0.4); })) return;
      if (trees.some(function (tree) {
        return Math.hypot(tree.x - x, tree.z - z) < (tree.r + radius) * 1.15;
      })) return;
      trees.push({ x: rounded(x), z: rounded(z), r: rounded(radius), h: rounded(height) });
    }

    parks.forEach(function (park) {
      [-16, 0, 16].forEach(function (dx) {
        [-18, 0, 18].forEach(function (dz) {
          addTree(park.x + dx + (random() - 0.5) * 4, park.z + dz + (random() - 0.5) * 4,
            3.1 + random() * 1.5, 9 + random() * 5);
        });
      });
    });
    // Pavement trees sit inside the lot boundary and are checked against every footprint.
    // They stand 30.5 from the row centre, which is the kerb verge: the carriageway edge
    // is at 34 and the road keep-out is `radius + 0.4`, so this is as close as a crown of
    // up to 2.7 can sit without touching the asphalt, and it hands the whole strip between
    // kerb and building line to the frontage. The old 28 planted the crown in the middle
    // of that strip — the exact ground a compound needs, since `partClear` refuses a ring
    // for a crown within `r*.65 + .4`. Where a split half reaches close enough to the
    // verge that even this line would crowd its courtyard, `inFrontage` drops the tree.
    zs.forEach(function (z) {
      xs.forEach(function (x) {
        [-30.5, 30.5].forEach(function (dz) {
          [-18, 0, 18].forEach(function (dx) {
            if (random() < 0.74) addTree(x + dx, z + dz, 2.1 + random() * 0.6, 8 + random() * 3);
          });
        });
      });
    });

    var city = {
      seed: seed, extentX: extentX, extentZ: extentZ, duration: duration,
      buildings: buildings, trees: trees, parks: parks, water: water,
      bridges: bridges, roads: roads, viaducts: viaducts, tunnels: tunnels,
      // city-life.js builds the car rings and the rider strip from these
      // half-extents. The first two rings' corners sit on the avenue mouths
      // (x = ±96), so every turn happens on a drawn junction: the rings run the
      // z = ±80 streets and the avenue flanks, and the cars still cross both
      // canal bridges on every lap. The numbers keep the spacing the rings were
      // designed with: carriageways 4.8 apart, the rider strip 2.1 further out
      // in x and 2.6 in z, which is the clearance the rider check measures.
      // The third lane is the V4 ring-road loop: the z = ±160 streets plus the
      // x = ±175 ring roads, closed across the canal by the two tunnels. The
      // fourth is the V4 express loop: the z = ±245 expressways plus the same
      // ring roads, closed across the canal on the viaduct decks. Both keep the
      // same 2.4 inset from their road centrelines — on the ring roads the two
      // loops run in the familiar 4.8-apart pair — so every leg sits on street
      // asphalt and every corner turns inside a drawn junction.
      vehicleLaneExtents: [
        { halfX: 93.6, halfZ: 77.6 },
        { halfX: 98.4, halfZ: 82.4 },
        { halfX: 172.6, halfZ: 157.6 },
        { halfX: 177.4, halfZ: 247.4 }
      ],
      riderLaneExtents: { halfX: 100.5, halfZ: 85 }
    };

    if (options.playground === true) {
      city.playground = {
        x: -132, z: 120, w: 52, d: 58,
        trackRadius: 16, trackHalfStraight: 6, laneWidth: 1, lanes: 4,
        pitchW: 17, pitchD: 26
      };
      parks.forEach(function (park) {
        if (park.x === city.playground.x && park.z === city.playground.z) park.use = 'sports';
      });
      // Clear crowns only after all original trees have consumed their random values.
      // This preserves the rest of the city, including trees beside the outer paths.
      var playingArea = { x: city.playground.x, z: city.playground.z, w: 40, d: 46 };
      city.trees = trees.filter(function (tree) {
        return !insideExpandedRect(tree.x, tree.z, playingArea, tree.r + 0.5);
      });
    }

    return city;
  }

  function sampleBuilding(building, time) {
    var sampledTime = typeof time === 'number' && !Number.isNaN(time) ? time : 0;
    var elapsed = sampledTime - building.start;
    var builtFloors = elapsed + EPSILON < building.fallDuration ? 0 :
      clamp(Math.floor((elapsed - building.fallDuration + EPSILON) / building.step) + 1, 0, building.floors);
    var falling = [];
    var latestSpawned = Math.min(building.floors - 1, Math.floor((elapsed + EPSILON) / building.step));
    for (var floor = builtFloors; floor <= latestSpawned; floor += 1) {
      var progress = clamp((elapsed - floor * building.step) / building.fallDuration, 0, 1);
      var detail = randomGenerator((building.detailSeed + Math.imul(floor + 1, 2654435761)) >>> 0);
      var drop = 40 + detail() * 35;
      var rotation = (detail() - 0.5) * 0.28;
      falling.push({
        floor: floor,
        y: floor * building.floorHeight + drop * (1 - progress * progress),
        rotation: rotation * Math.pow(1 - progress, 2) * Math.cos(progress * Math.PI),
        opacity: Math.min(1, 0.45 + progress * 4),
        progress: progress
      });
    }
    var sinceLanding = builtFloors > 0 ? elapsed - (builtFloors - 1) * building.step - building.fallDuration : Infinity;
    return {
      builtFloors: builtFloors,
      height: builtFloors * building.floorHeight,
      falling: falling,
      flash: sinceLanding >= -EPSILON ? clamp(1 - Math.max(0, sinceLanding) / 0.3, 0, 1) : 0,
      complete: builtFloors === building.floors
    };
  }

  function summarize(city, time) {
    var builtFloors = 0;
    var totalFloors = 0;
    var completedBuildings = 0;
    var fallingCount = 0;
    city.buildings.forEach(function (building) {
      var sample = sampleBuilding(building, time);
      totalFloors += building.floors;
      builtFloors += sample.builtFloors;
      fallingCount += sample.falling.length;
      if (sample.complete) completedBuildings += 1;
    });
    return {
      builtFloors: builtFloors, totalFloors: totalFloors,
      progress: totalFloors ? builtFloors / totalFloors : 1,
      completedBuildings: completedBuildings, totalBuildings: city.buildings.length,
      fallingCount: fallingCount
    };
  }

  return { createCity: createCity, sampleBuilding: sampleBuilding, summarize: summarize, onBoard: onBoard };
});
