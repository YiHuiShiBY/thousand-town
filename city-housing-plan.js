/* Deterministic residential lots. All housing geometry is local to its building. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CityHousingPlan = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SITES = [
    { x: -132, z: -40, type: 'courtyard', label: '庭院住宅', floors: 7,
      palette: { wall: '#d8cbb4', trim: '#f3ecde', glass: '#738786', accent: '#a6785e' } },
    { x: 60, z: -40, type: 'slab', label: '花园板楼', floors: 8,
      palette: { wall: '#d9ddd1', trim: '#f4f0e5', glass: '#7b9189', accent: '#7f977d' } },
    { x: -60, z: 40, type: 'terrace', label: '退台公寓', floors: 8,
      palette: { wall: '#dfc4ae', trim: '#f4e8d8', glass: '#8b8b7a', accent: '#ab8064' } },
    { x: 132, z: 40, type: 'point', label: '双塔住区', floors: 10,
      palette: { wall: '#ddd7cb', trim: '#f6f0e4', glass: '#79888d', accent: '#89947d' } }
  ];

  function volume(x, z, w, d, floors, balconies) {
    return { x: x, z: z, y: 0, w: w, d: d, floors: Math.max(3, floors), balconies: balconies };
  }

  function housing(site, floors) {
    var volumes, courtyard;
    // Every wing has 2.4 units on all four sides for balconies and cornices.
    // These expanded wings remain disjoint inside the 46 x 50 occupied lot.
    if (site.type === 'courtyard') {
      volumes = [volume(0, -17, 40, 10, floors, 'z'), volume(-15, 7, 10, 26, floors - 1, 'x'), volume(15, 7, 10, 26, floors - 1, 'x')];
      courtyard = { x: 0, z: 7, w: 14, d: 25 };
    } else if (site.type === 'slab') {
      volumes = [volume(-3, -13, 32, 12, floors, 'z'), volume(3, 12, 32, 12, floors - 1, 'z')];
      courtyard = { x: 0, z: -.5, w: 28, d: 7 };
    } else if (site.type === 'terrace') {
      volumes = [volume(-4, -16, 30, 10, floors, 'z'), volume(3, 0, 34, 12, floors - 2, 'z'), volume(-7, 16, 24, 10, floors - 4, 'z')];
      courtyard = { x: 14.5, z: 16, w: 10, d: 11 };
    } else {
      volumes = [volume(-11.5, -9, 16, 22, floors, 'both'), volume(11.5, 9, 16, 22, floors - 2, 'both')];
      courtyard = { x: 11.5, z: -14.5, w: 13, d: 12 };
    }
    return { type: site.type, label: site.label, palette: Object.assign({}, site.palette), volumes: volumes, courtyard: courtyard };
  }

  function finish(building) {
    return building.start + (building.floors - 1) * building.step + building.fallDuration;
  }

  function decorate(city, options) {
    if (options && options.housing === false) return city;
    if (!city || !Array.isArray(city.buildings)) throw new Error('CityHousingPlan.decorate requires a canonical city with buildings.');
    var skyline = options && Number.isFinite(options.skyline) ? Math.max(.55, Math.min(1.45, options.skyline)) : 1;
    var replacements = new Map(), removed = new Set(), occupied = [];
    SITES.forEach(function (site) {
      var selected = city.buildings.filter(function (building) {
        return !building.facility && building.kind !== 'glass' && Math.abs(building.x - site.x) < 28 && Math.abs(building.z - site.z) < 31;
      });
      if (!selected.length || (selected.length === 1 && selected[0].housing)) return;
      var first = selected[0], floors = Math.max(6, Math.min(10, Math.round(site.floors * skyline)));
      var end = Math.min(finish(first), Math.max.apply(null, selected.map(finish)), Number.isFinite(city.duration) ? city.duration : Infinity);
      var duration = end - first.start, fallDuration = first.fallDuration;
      var step = (duration - fallDuration) / (floors - 1);
      if (step < fallDuration / 2) {
        // Low skylines can have only three original floors. Scale the two timing
        // intervals together so six residential floors still finish at the same
        // absolute instant and never require more than two simultaneous fallers.
        var ratio = Math.min(2, first.fallDuration / first.step);
        step = duration / (floors - 1 + ratio);
        fallDuration = step * ratio;
      }
      var replacement = Object.assign({}, first, {
        x: site.x, z: site.z, w: 46, d: 50, floors: floors, floorHeight: 6,
        kind: 'housing', roof: 'housing', label: site.label,
        step: step, fallDuration: fallDuration, housing: housing(site, floors)
      });
      replacements.set(first, replacement); occupied.push(replacement);
      selected.slice(1).forEach(function (building) { removed.add(building); });
    });
    if (!replacements.size) return city;
    return Object.assign({}, city, {
      buildings: city.buildings.filter(function (building) { return !removed.has(building); }).map(function (building) { return replacements.get(building) || building; }),
      trees: (city.trees || []).filter(function (tree) {
        return !occupied.some(function (building) {
          return Math.abs(tree.x - building.x) < building.w / 2 + tree.r + .8 && Math.abs(tree.z - building.z) < building.d / 2 + tree.r + .8;
        });
      })
    });
  }

  return { decorate: decorate };
});
