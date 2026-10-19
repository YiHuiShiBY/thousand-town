/* Plan synthesis, location resolution, rotation and validation (§7.5).
 *
 * The state machine's only input is a Plan: one 24h, fully-covered, non-overlapping
 * segment list per resident per day. Phase 1 synthesizes it from the template +
 * traits; phase 2 may hand in an LLM-authored plan through the same door — if it
 * fails validation the resident silently falls back to their template plan.
 *
 * Determinism: per-(seed, resident, day) rotation comes from a hashed RNG, so
 * regenerating any day's plans from the snapshot inputs reproduces them exactly. */
(function (root, factory) {
  'use strict';
  var api = factory(
    (typeof CityRandom === 'object' && CityRandom) ? CityRandom :
    (typeof require === 'function' ? require('../city-random.js') : null),
    (typeof CitySchedules === 'object' && CitySchedules) ? CitySchedules :
    (typeof require === 'function' ? require('./resident-schedule.js') : null),
    (typeof CityDailyClock === 'object' && CityDailyClock) ? CityDailyClock :
    (typeof require === 'function' ? require('./daily-clock.js') : null)
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CityPlans = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (CityRandom, CitySchedules, CityDailyClock) {
  'use strict';

  var MINUTES_PER_DAY = 1440;

  // Allowed cyclic next-states per §7.2, extended so a shift can collapse straight
  // into SLEEPING (walking in from night duty into bed) and a wake-up can go
  // straight to the table.
  var NEXT = {
    HOME: ['HOME', 'DINING', 'COMMUTE', 'SLEEPING'],
    SLEEPING: ['HOME', 'SLEEPING', 'DINING', 'COMMUTE'],
    COMMUTE: ['AT_WORK', 'SHOPPING', 'LEISURE', 'MEDICAL', 'DINING', 'HOME', 'COMMUTE', 'SLEEPING'],
    AT_WORK: ['AT_WORK', 'DINING', 'COMMUTE', 'HOME', 'SLEEPING'],
    DINING: ['DINING', 'AT_WORK', 'HOME', 'COMMUTE', 'SHOPPING', 'LEISURE', 'MEDICAL', 'SLEEPING'],
    SHOPPING: ['SHOPPING', 'DINING', 'COMMUTE', 'HOME', 'LEISURE', 'SLEEPING'],
    LEISURE: ['LEISURE', 'DINING', 'SHOPPING', 'COMMUTE', 'HOME', 'SLEEPING'],
    MEDICAL: ['MEDICAL', 'DINING', 'COMMUTE', 'HOME', 'SLEEPING']
  };

  /* Same-roof exceptions: a ward patient leaves the bed for the treatment room and
   * strolls the corridor, a night-shift nurse walks in and goes straight to bed —
   * state changes inside one building need no street segment. Only legal when both
   * segments resolve to the exact same place, so any real outing still has to walk. */
  function allows(from, to, fromSeg, toSeg) {
    if ((NEXT[from] || []).indexOf(to) >= 0) return true;
    return !!toSeg.location && toSeg.location === fromSeg.location;
  }

  function hash32(text) {
    var h = 0x811C9DC5;
    for (var i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function dayRng(seed, residentId, day) {
    return CityRandom.randomGenerator(hash32(seed + ':' + residentId + ':' + day));
  }

  function seg(start, end, state, location, substate) {
    return { start: start, end: end, state: state, location: location, substate: substate || null };
  }

  // Rotate a fully covering day by ±minutes, splitting whatever crosses midnight —
  // "this person woke up 12 minutes late today" without touching internal seams.
  function rotate(segments, offset) {
    var out = [];
    segments.forEach(function (s) {
      var start = s.start + offset;
      var end = s.end + offset;
      if (start < 0) {
        out.push(seg(0, end, s.state, s.location, s.substate));
        out.push(seg(MINUTES_PER_DAY + start, MINUTES_PER_DAY, s.state, s.location, s.substate));
      } else if (end > MINUTES_PER_DAY) {
        out.push(seg(start, MINUTES_PER_DAY, s.state, s.location, s.substate));
        out.push(seg(0, end - MINUTES_PER_DAY, s.state, s.location, s.substate));
      } else {
        out.push(seg(start, end, s.state, s.location, s.substate));
      }
    });
    out.sort(function (a, b) { return a.start - b.start; });
    return out;
  }

  // HOME / WORK / STREET stay; outing tokens resolve against the resident's
  // assigned buildings. A resident whose venue ledger came up empty parks at HOME
  // and their outing state softens to plain home time.
  function resolveLocation(token, resident, kinds, ctx) {
    switch (token) {
      case 'HOME': return resident.home;
      case 'WORK': return resident.workplace || resident.home;
      case 'STREET': return 'street';
      case 'PLAZA':
      case 'PARK':
        if (resident.leisureVenue && resident.leisureVenue !== 'HOME') return resident.leisureVenue;
        return { softHome: true };
      case 'MALL': return kinds.mall || { softHome: true };
      case 'SCHOOL': return kinds.school || { softHome: true };
      // W1.5 (§4.4/§4.5): the second shopping centre, and the wholesale market doing
      // its public morning hours.
      case 'ANNEX': return kinds['annex-mall'] || kinds.mall || { softHome: true };
      case 'MARKET': return kinds.market || { softHome: true };
      // The riverside food street is a dining destination, not a seat in the leisure
      // ledger — anyone can eat there, so it never collapses for being homebound. The
      // clinic is the block's own surgery when it has one.
      case 'NIGHT': return kinds['night-market'] || { softHome: true };
      case 'CLINIC': return resident.clinic || kinds.clinic || { softHome: true };
      /* Errands (§4.4.1): two counters, one per kind, chosen by the template's habit
       * draw rather than here — a man who banks does not also queue for the
       * sub-district office the same week. `POST` is the officer's duty place, which is
       * the lot their 警务室 is annexed to: the state stays AT_WORK, the building
       * changes, so the walk to the school gate is real and counted. */
      case 'BANK': return kinds.bank || { softHome: true };
      case 'CIVIC': return kinds.civic || { softHome: true };
      case 'POST': return resident.dutyPost || resident.workplace || { softHome: true };
      /* §4.4.2 weekend tokens. `DUTY` is the building this resident is minding today,
       * which is somebody else's building: the roster lives in `weekendPostOf` because
       * it needs the day number, and only the plan layer knows that. `AMUSEMENT` exists
       * because the rides are the one venue no adult's leisure ledger ever seats, so
       * without a token of their own the children could never be counted inside it. */
      case 'DUTY': return (ctx && ctx.duty) || resident.workplace || { softHome: true };
      case 'AMUSEMENT': return kinds.amusement || { softHome: true };
      default:
        // Any other all-caps word is a symbol this town has no building for. Park the
        // person at home instead of leaking the token into an occupancy ledger.
        if (typeof token === 'string' && /^[A-Z][A-Z0-9_-]*$/.test(token)) return { softHome: true };
        return token; // already a concrete building id
    }
  }

  /* The weekend duty roster (§4.4.2). A shut building is not an empty one: one 运维
   * person keeps the plant room and the yard, and the two malls keep a 安保 at the door
   * even when they are open. Only blue-collar workers are eligible, and
   * only those whose own workplace is shut that day, so the depot and the market never
   * lose their crew to somebody else's boiler room. Half that pool is on call, picked by
   * a rule that moves with the week number so the same fifteen people are not working
   * every Sunday forever. Pure in (town, resident, day), so snapshots still replay. */
  var SECURITY_POSTS = ['c-mall', 'c-annex-mall'];
  // Residential blocks are deliberately not on this list. They do not need a guard to
  // avoid being empty — 958 people sleep in them — and a guard counted *inside* a block
  // would push the twelve-flat courtyard to thirteen, because `capacity` on a housing
  // building doubles as its bed count. A 门房 stands at the gate, which is pavement: that
  // is a W2 street agent, not a line in the occupancy ledger.

  function dutyPosts(town, dayType) {
    if (!town || !dayType || dayType === 'weekday') return [];
    var posts = [];
    (town.buildings || []).forEach(function (b) {
      if (CitySchedules.closesOn(b.open, dayType)) posts.push(b.id);
    });
    SECURITY_POSTS.forEach(function (id) {
      if (town.byId && town.byId[id] && posts.indexOf(id) < 0) posts.push(id);
    });
    return posts;
  }

  function weekendPostOf(town, resident, day) {
    var dayType = CityDailyClock.dayType(day);
    if (dayType === 'weekday') return null;
    if (resident.role !== 'worker') return null;
    if (!CitySchedules.closesOn(resident.venuePolicy, dayType)) return null;
    var posts = dutyPosts(town, dayType);
    if (!posts.length) return null;
    var week = CityDailyClock.weekIndex(day);
    // Half the pool is on call, and Saturday and Sunday call *different* halves: a
    // weekend duty roster that books the same people both days is not 双休 for anybody.
    // The week number slides both halves along, so over a month everybody takes a turn.
    var parity = dayType === 'sunday' ? 1 : 0;
    if ((resident.ordinal + week + parity) % 2 !== 0) return null;
    var rank = Math.floor((resident.ordinal - 1) / 2);
    return posts[(rank + week) % posts.length];
  }

  // Tokens that mean "leave the building for this".
  var OUTING_TOKENS = ['PLAZA', 'PARK', 'MALL', 'SCHOOL'];

  /* Errands are not leisure (§4.4.1). The venue ledger decides who gets to *go out for
   * nothing*, and a pension collected in person is not nothing — so a homebound
   * retiree still walks to the counter. Without this exemption the leisure ledger
   * would silently swallow the bank's and the office's entire public, because they are
   * drawn in the SHOPPING state the collapse also governs. */
  var ERRAND_TOKENS = ['BANK', 'CIVIC'];

  /* Waves, not platoons (§4.5). A template walk has one fixed start minute, and the
   * day rotation moves the whole day together, so an entire role used to step onto the
   * pavement at the same instant and vanish an hour later — 190 retirees at 10:30 made
   * the pensioners' stroll the busiest minute of the town, taller than either commute.
   * Each interior walk is therefore slid ±stagger minutes as a *rigid unit*: its own
   * duration is untouched, and the two sessions it joins grow or shrink to absorb the
   * shift, which is what "they left the plaza at ten past" actually means. Drawn from
   * the day RNG, so a day stays reproducible from (seed, resident, day). */
  var WALK_STAGGER = 30;
  var MIN_SESSION = 10;

  function staggerWaves(segments, rng, stagger, minSession) {
    var max = stagger === undefined ? WALK_STAGGER : stagger;
    var floor = minSession === undefined ? MIN_SESSION : minSession;
    var out = segments.map(function (s) { return seg(s.start, s.end, s.state, s.location, s.substate); });
    for (var i = 1; i < out.length - 1; i++) {
      var walk = out[i];
      if (walk.state !== 'COMMUTE') continue;
      var prev = out[i - 1];
      var next = out[i + 1];
      // Chained walks would have to slide as one longer walk; leave them to the rotation.
      if (prev.state === 'COMMUTE' || next.state === 'COMMUTE') continue;
      var room = Math.min(prev.end - prev.start, next.end - next.start) - floor;
      if (room <= 0) continue;
      var d = Math.round((rng() * 2 - 1) * max);
      d = Math.max(-room, Math.min(room, d));
      if (!d) continue;
      prev.end += d;
      walk.start += d;
      walk.end += d;
      next.start += d;
    }
    return out;
  }

  /* HOME / WORK / STREET stay; outing tokens resolve against the resident's
   * assigned buildings. A resident whose venue ledger came up empty (leisureVenue
   * === 'HOME') stays in today: every leisure or shopping outing collapses into
   * home time. Their walks survive as strolls around the block, which is both what
   * an elderly neighbour actually does and what keeps the transition graph honest. */
  function resolveLocations(segments, resident, town, ctx) {
    var kinds = town.kinds || {};
    var byId = town.byId || {};
    var homebound = resident.leisureVenue === 'HOME';
    var weekend = !!(ctx && ctx.dayType && ctx.dayType !== 'weekday');
    var softened = false;
    var out = segments.map(function (s) {
      var place = resolveLocation(s.location, resident, kinds, ctx);
      var errand = s.state === 'SHOPPING' && ERRAND_TOKENS.indexOf(s.location) >= 0;
      // §4.4.2: a pension queue cannot stand inside a bank that is shut, and a
      // grandparent cannot collect a child from a school on a Sunday. Anything pointing
      // at a closed venue folds into home time, exactly like an unseated outing does.
      // The duty post is the one exception, and it is the whole point of the rule.
      var shut = weekend && typeof place === 'string' && place !== 'street' &&
        s.location !== 'DUTY' && place !== (ctx && ctx.duty) &&
        CitySchedules.closesOn((byId[place] || {}).open, ctx.dayType);
      var stays = shut || (place && place.softHome) || (!errand && homebound &&
        (s.state === 'LEISURE' || s.state === 'SHOPPING' ||
          OUTING_TOKENS.indexOf(s.location) >= 0));
      if (stays) {
        softened = true;
        return seg(s.start, s.end, 'HOME', resident.home, s.substate ? 'indoor-' + s.substate : 'indoor');
      }
      return seg(s.start, s.end, s.state, place, s.substate);
    });
    return { segments: out, softHome: softened };
  }

  /* The stable habit draw (§6): 0–99 from (seed, resident) alone, never from the day
   * number, so "this one eats out at the night market" is a character trait of the
   * person rather than a coin flip every morning. Templates that branch on it list
   * themselves in CitySchedules.VARIANT_TEMPLATES. */
  function variantOf(seed, resident) {
    return hash32(seed + ':' + resident.id + ':habit') % 100;
  }

  function buildDay(resident, day, options) {
    var opts = options || {};
    var seed = (opts.seed === undefined ? 0 : opts.seed) + '';
    var town = opts.town || { kinds: {} };
    // §4.4.2: the week. `dayType` is derived from the day number alone, so a Sunday is
    // the same Sunday in every snapshot, and the duty post is a pure function of the
    // same three things the rest of the plan already keys on.
    var dayType = CityDailyClock.dayType(day);
    var duty = weekendPostOf(town, resident, day);
    var template = CitySchedules.templateFor(resident, dayType, duty);
    var variant = variantOf(seed, resident);
    // `ordinal` is the roster number, not a random draw: some duties belong to a place
    // in the crew rather than to a habit (the 护学岗, §4.4.1).
    var base = template({
      shift: resident.shiftWindow,
      variant: variant,
      ordinal: resident.ordinal,
      role: resident.role,
      dayType: dayType,
      halfDay: CitySchedules.halfDayOn(resident.venuePolicy, dayType)
    });
    var rng = dayRng(seed, resident.id, day);
    // pace tilts the whole day ±30 min, the daily draw adds ±15 of jitter.
    var offset = Math.round(resident.traits.pace * 30 + (rng() * 30 - 15));
    var segments = staggerWaves(rotate(base, offset), rng);
    var resolved = resolveLocations(segments, resident, town, { dayType: dayType, duty: duty });
    return {
      owner: resident.id,
      day: day,
      dayType: dayType,
      source: 'template',
      variant: variant,
      dutyPost: duty || null,
      segments: resolved.segments
    };
  }

  // Structural + transition legality per §7.5; returns {ok, problems[]}.
  function validate(plan) {
    var problems = [];
    var segments = plan.segments || [];
    if (!segments.length) return { ok: false, problems: ['empty plan'] };
    var cursor = 0;
    segments.forEach(function (s, i) {
      if (s.state && CitySchedules.STATES.indexOf(s.state) < 0) problems.push('unknown state ' + s.state + ' @' + i);
      if (s.start < cursor) problems.push('overlap @' + i + ' start ' + s.start + ' < ' + cursor);
      // A plan is a full 24h cover: an unclaimed stretch of minutes is as broken as an
      // overlap, and it is exactly what an LLM writes when it forgets to eat.
      else if (s.start > cursor) problems.push('uncovered minute ' + cursor + '→' + s.start + ' @' + i);
      if (s.end <= s.start) problems.push('empty segment @' + i);
      cursor = Math.max(cursor, s.end);
    });
    if (cursor > MINUTES_PER_DAY) problems.push('plan exceeds 1440 minutes: ' + cursor);
    // Midnight wrap counts as one sleep, so a head SLEEPING piece and a tail
    // SLEEPING piece are allowed to sit adjacent across the day seam.
    var head = segments[0];
    var tail = segments[segments.length - 1];
    var wrapSleep = head.state === 'SLEEPING' && tail.state === 'SLEEPING';
    for (var i = 0; i < segments.length - 1; i++) {
      var from = segments[i].state; var to = segments[i + 1].state;
      if (!allows(from, to, segments[i], segments[i + 1])) {
        problems.push('illegal transition ' + from + '→' + to + ' @' + segments[i + 1].start);
      }
    }
    if (!wrapSleep) {
      var lastSeg = segments[segments.length - 1];
      var firstSeg = segments[0];
      if (!allows(lastSeg.state, firstSeg.state, lastSeg, firstSeg)) {
        problems.push('illegal seam transition ' + lastSeg.state + '→' + firstSeg.state);
      }
    }
    // Coverage only counts when the seam continues (plans repeat daily, so head
    // segment must start at 0 and tail must reach 1440).
    if (head.start !== 0) problems.push('day starts at ' + head.start);
    if (tail.end !== MINUTES_PER_DAY) problems.push('day ends at ' + tail.end);
    return { ok: problems.length === 0, problems: problems };
  }

  // The single door the state machine uses: trust an external (llm/event) plan
  // only when it validates, otherwise fall back to the template and log why.
  function resolvePlan(resident, day, options) {
    var opts = options || {};
    if (opts.external && opts.external.owner === resident.id && opts.external.day === day) {
      var check = validate(opts.external);
      if (check.ok) return { plan: opts.external, fellBack: false, problems: [] };
      return { plan: buildDay(resident, day, opts), fellBack: true, problems: check.problems };
    }
    return { plan: buildDay(resident, day, opts), fellBack: false, problems: [] };
  }

  return {
    NEXT: NEXT,
    OUTING_TOKENS: OUTING_TOKENS,
    ERRAND_TOKENS: ERRAND_TOKENS,
    SECURITY_POSTS: SECURITY_POSTS,
    dutyPosts: dutyPosts,
    weekendPostOf: weekendPostOf,
    WALK_STAGGER: WALK_STAGGER,
    MIN_SESSION: MIN_SESSION,
    allows: allows,
    hash32: hash32,
    dayRng: dayRng,
    variantOf: variantOf,
    rotate: rotate,
    staggerWaves: staggerWaves,
    resolveLocations: resolveLocations,
    buildDay: buildDay,
    validate: validate,
    resolvePlan: resolvePlan
  };
});
