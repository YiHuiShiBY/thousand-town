/* Shared seeded PRNG (mulberry32-style). Load before city-model/city-life/city-light/city-ground/city-layout. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CityRandom = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Deterministic across engines: >>> 0 coercion, Math.imul for the 32-bit mixes.
  function randomGenerator(seed) {
    var state = seed >>> 0;
    return function () {
      state = (state + 0x6D2B79F5) >>> 0;
      var value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  return { randomGenerator: randomGenerator };
});
