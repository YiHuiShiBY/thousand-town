/* Plan snapshots (§7.5 determinism contract). Every simulated day's plans are
 * archived; playback and video rendering read snapshots instead of recomputing,
 * which is what keeps tomorrow's LLM-authored plans from breaking V2's
 * "pause / replay / export stay identical" guarantee. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CityPlanSnapshots = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = 1;

  function capture(seed, day, plans) {
    return {
      version: VERSION,
      seed: seed >>> 0,
      day: day,
      plans: plans.map(function (plan) {
        return {
          owner: plan.owner,
          source: plan.source,
          segments: plan.segments.map(function (s) {
            return {
              start: s.start, end: s.end, state: s.state,
              location: s.location, substate: s.substate || null
            };
          })
        };
      })
    };
  }

  function serialize(snapshot) {
    return JSON.stringify(snapshot);
  }

  function parse(text) {
    var snapshot = JSON.parse(text);
    if (!snapshot || snapshot.version !== VERSION) throw new Error('unsupported snapshot version');
    return snapshot;
  }

  function indexByOwner(snapshot) {
    var byOwner = {};
    snapshot.plans.forEach(function (plan) { byOwner[plan.owner] = plan; });
    return byOwner;
  }

  // Cheap structural equality for determinism assertions in tests and tooling.
  function equals(a, b) {
    return serialize(a) === serialize(b);
  }

  return {
    VERSION: VERSION,
    capture: capture,
    serialize: serialize,
    parse: parse,
    indexByOwner: indexByOwner,
    equals: equals
  };
});
