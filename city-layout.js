/* Move complete canonical lots while retaining the seeded construction timeline. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CityLayout = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var XS = [-132, -60, 60, 132], ZS = [-200, -120, -40, 40, 120, 200];
  // 4 columns × 6 rows. A destination cell is still addressed as row*4+col; the
  // 16-lot era's index i is now i+4, because a row was inserted at the north end.
  var LOTS = XS.length * ZS.length;
  var STATION_LOT = 12;

  function identity() {
    return Array.from({ length: LOTS }, function (_, index) { return index; });
  }

  function permutation(value) {
    if (typeof value === 'string') {
      var tokens = value.split(',').map(function (token) { return token.trim(); });
      if (tokens.some(function (token) { return !/^\d+$/.test(token); })) return null;
      value = tokens.map(Number);
    }
    // A 16-number URL cannot be salvaged onto a 24-cell board, and guessing would
    // silently move the station or a school. Rejecting is the honest shape: normalize
    // falls back to identity, so an old shared link still renders — it just loses its
    // hand-made arrangement (§4.4 records that as a price of the expansion).
    if (!Array.isArray(value) || value.length !== LOTS) return null;
    var seen = new Set();
    for (var index = 0; index < LOTS; index += 1) {
      var destination = value[index];
      if (!Number.isInteger(destination) || destination < 0 || destination >= LOTS || seen.has(destination)) return null;
      seen.add(destination);
    }
    var stationColumn = value[STATION_LOT] % 4;
    return stationColumn === 0 || stationColumn === 3 ? value.slice() : null;
  }

  var randomGenerator = (typeof CityRandom === 'object' && CityRandom && CityRandom.randomGenerator)
    ? CityRandom.randomGenerator
    : (typeof require === 'function' ? require('./city-random.js').randomGenerator : null);

  function randomize(seed) {
    var random = randomGenerator(((Number(seed) >>> 0) ^ 0x5B912ACE) >>> 0);
    var result=identity();
    for(var i=LOTS-1;i>0;i--){var j=Math.floor(random()*(i+1));var v=result[i];result[i]=result[j];result[j]=v;}
    if(result[STATION_LOT]%4!==0&&result[STATION_LOT]%4!==3){
      var edges=result.map(function(v,i){return v%4===0||v%4===3?i:-1;}).filter(function(i){return i>=0;});
      var at=edges[Math.floor(random()*edges.length)],value=result[STATION_LOT];result[STATION_LOT]=result[at];result[at]=value;
    }
    return result;
  }

  function normalize(value) {
    return permutation(value) || identity();
  }

  // Arguments address physical destination cells, not original source lots.
  function swap(layout, sourceDestinationLot, targetDestinationLot) {
    var result = permutation(layout);
    if (!result) throw new Error('Invalid city layout.');
    if (![sourceDestinationLot, targetDestinationLot].every(function (index) {
      // Must be LOTS, not 16: the two inserted rows (cells 16-19 and 20-23) are legal
      // swap targets, and this bound was left behind while its own message was updated.
      return Number.isInteger(index) && index >= 0 && index < LOTS;
    })) throw new Error('City layout cell must be an integer from 0 to ' + (LOTS - 1) + '.');
    var source = result.indexOf(sourceDestinationLot), target = result.indexOf(targetDestinationLot);
    result[source] = targetDestinationLot;
    result[target] = sourceDestinationLot;
    if (!permutation(result)) throw new Error('The bus and taxi station must stay in column A or D.');
    return result;
  }

  function center(index) {
    return { x: XS[index % 4], z: ZS[Math.floor(index / 4)] };
  }

  function nearest(values, coordinate) {
    var best = 0;
    for (var index = 1; index < values.length; index += 1) {
      if (Math.abs(values[index] - coordinate) < Math.abs(values[best] - coordinate)) best = index;
    }
    return best;
  }

  function lotOf(item) {
    return nearest(ZS, item.z) * 4 + nearest(XS, item.x);
  }

  // Always apply to the canonical decorated model, before waterfront planning.
  // Lot-local offsets keep split buildings, tree crowns, and entrances together.
  function apply(city, layout) {
    if (!city || typeof city !== 'object') throw new Error('CityLayout.apply requires a canonical city.');
    var normalized = normalize(layout), result = Object.assign({}, city, { layout: normalized });
    function translate(item) {
      var source = center(lotOf(item)), destination = center(normalized[lotOf(item)]);
      var dx = destination.x - source.x, dz = destination.z - source.z;
      var moved = Object.assign({}, item, { x: item.x + dx, z: item.z + dz });
      if (item.entrance) moved.entrance = Object.assign({}, item.entrance, {
        x: item.entrance.x + dx, z: item.entrance.z + dz
      });
      if (item.kind === 'station') {
        moved.gateSide = destination.x < 0 ? 1 : -1;
        moved.roadX = destination.x < 0 ? -96 : 96;
        moved.name = '公交·出租车站';
      }
      return moved;
    }
    ['buildings', 'trees', 'parks', 'facilities', 'places', 'reservations'].forEach(function (key) {
      if (Array.isArray(city[key])) result[key] = city[key].map(translate);
    });
    if (city.playground) result.playground = translate(city.playground);
    // Old lots 9 and 15, translated by the inserted row.
    result.blockWalks = [13, 19].map(function (sourceLot) { return center(normalized[sourceLot]); });
    return result;
  }

  function cells(city) {
    city = city || {};
    var layout = normalize(city.layout);
    var result = identity().map(function (index) {
      var position = center(index), row = Math.floor(index / 4), col = index % 4;
      return {
        index: index, row: row, col: col, label: 'ABCD'[col] + (row + 1),
        x: position.x, z: position.z, sourceLot: layout.indexOf(index),
        kind: 'building', name: '普通街区', special: false
      };
    });
    function mark(item, kind, name) {
      Object.assign(result[lotOf(item)], { kind: kind, name: name, special: true });
    }
    (city.parks || []).forEach(function (park) { mark(park, 'park', '公园'); });
    (city.buildings || []).filter(function (building) { return building.housing; }).forEach(function (building) {
      var cell = result[lotOf(building)];
      Object.assign(cell, { kind: 'housing', name: building.housing.label, special: false });
    });
    if (city.playground) mark(city.playground, 'playground', '操场');
    (city.facilities || []).forEach(function (facility) {
      mark(facility, facility.facility, facility.label || facility.name || facility.facility);
    });
    (city.places || []).forEach(function (place) { mark(place, place.kind, place.label || place.name || place.kind); });
    return result;
  }

  return { randomize: randomize, identity: identity, normalize: normalize, apply: apply, swap: swap, cells: cells };
});
