/* Weekday schedule templates (§6). Each template is a function of small per-role
 * context and returns non-overlapping segments covering one sim day [0,1440).
 * Locations are symbolic tokens — HOME / WORK / STREET / PLAZA — resolved later by
 * resident-plan.js against the resident's actual building refs, so a template never
 * hardcodes city geometry. Sleep spans that cross midnight are emitted as a head
 * segment and a tail segment; the plan validator treats them as one sleep.
 *
 * W1.5 adds a second argument to that context: `variant`, a stable 0–99 draw per
 * resident. Templates use it to split a role into the sub-crowds a real street shows
 * — the office staff who eat at the night market and the ones who eat at home. It is
 * hashed, not random, so the same person makes the same choice every day and every
 * replay of the town reproduces it. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CitySchedules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var STATES = ['HOME', 'COMMUTE', 'AT_WORK', 'LEISURE', 'MEDICAL', 'SHOPPING', 'DINING', 'SLEEPING'];

  function seg(start, end, state, location, substate) {
    return { start: start, end: end, state: state, location: location, substate: substate || null };
  }

  function sleepAround(from, to) {
    // One sleeping span [from, to]; when it crosses midnight `to` is given as the
    // morning end (< from) and we emit a head piece plus a tail piece.
    if (to < from) to += 1440;
    var parts = [];
    if (to > 1440) {
      parts.push(seg(0, to - 1440, 'SLEEPING', 'HOME'));
      parts.push(seg(from, 1440, 'SLEEPING', 'HOME'));
    } else {
      parts.push(seg(from, to, 'SLEEPING', 'HOME'));
    }
    return parts;
  }

  // Assemble a full day: sleep wrap pieces (or none when sleepFrom is null) + the
  // awake chain, with any gaps filled as HOME so coverage is total.
  function day(sleepFrom, sleepTo, awakeSegments) {
    var segments = awakeSegments.slice();
    if (sleepFrom !== null) {
      sleepAround(sleepFrom, sleepTo).forEach(function (p) { segments.push(p); });
    }
    segments.sort(function (a, b) { return a.start - b.start; });
    var filled = [];
    var cursor = 0;
    segments.forEach(function (s) {
      if (s.start > cursor) filled.push(seg(cursor, s.start, 'HOME', 'HOME'));
      // Overlapping segments would corrupt stateAt; last writer wins by trimming.
      var start = Math.max(s.start, cursor);
      if (s.end > start) filled.push(seg(start, s.end, s.state, s.location, s.substate));
      cursor = Math.max(cursor, s.end);
    });
    if (cursor < 1440) filled.push(seg(cursor, 1440, 'HOME', 'HOME'));
    return filled;
  }

  var TEMPLATES = {
    // §6.2 office: 7 起床 / 8:30 出门 / 9-18 工作 / 19 后回家 / 22 睡.
    // A fifth of them eat at the night market instead of going straight home (§4.5).
    office: function (c) {
      var v = c ? c.variant : 99;
      var late = c ? (c.variant % 3) * 30 : 0;
      var out = c && c.variant < 20 ? [
        seg(1080, 1125, 'COMMUTE', 'STREET', 'walk'),
        seg(1125, 1245 + late, 'DINING', 'NIGHT', 'night-snack'),
        seg(1245 + late, 1290 + late, 'COMMUTE', 'STREET', 'walk')
      ] : [
        seg(1080, 1110, 'COMMUTE', 'STREET', 'walk'),
        seg(1110, 1170, 'HOME', 'HOME'),
        seg(1170, 1230, 'DINING', 'HOME'),
        seg(1230, 1320, 'HOME', 'HOME', 'leisure')
      ];
      // A tenth of them run an errand on the way back from lunch. It starts at 14:30 on
      // purpose: the pension queue owns the midday hour (the retiree band below), and a
      // bank that seats whoever is standing at noon is a bank the town cannot actually
      // feed, so the two crowds are split across the counter's open hours instead of
      // stacked into one peak. The two branches alternate so neither desk is staffed for
      // an audience of one.
      var midday = v >= 40 && v < 50 ? [
        seg(720, 780, 'DINING', 'WORK', 'canteen'),
        seg(780, 850, 'AT_WORK', 'WORK', 'office'),
        seg(850, 870, 'COMMUTE', 'STREET', 'walk'),
        seg(870, 930, 'SHOPPING', v % 2 ? 'BANK' : 'CIVIC', 'errand'),
        seg(930, 950, 'COMMUTE', 'STREET', 'walk'),
        seg(950, 1080, 'AT_WORK', 'WORK', 'office')
      ] : [
        seg(720, 780, 'DINING', 'WORK', 'canteen'),
        seg(780, 1080, 'AT_WORK', 'WORK', 'office')
      ];
      return day(1320, 420, [
        seg(420, 510, 'HOME', 'HOME', 'wake'),
        seg(510, 540, 'COMMUTE', 'STREET', 'walk'),
        seg(540, 720, 'AT_WORK', 'WORK', 'office')
      ].concat(midday, out));
    },
    // Blue collar: earlier start, trade floor or depot.
    worker: function (c) {
      var late = c ? (c.variant % 3) * 30 : 0;
      var out = c && c.variant < 35 ? [
        seg(1050, 1095, 'COMMUTE', 'STREET', 'ride'),
        seg(1095, 1230 + late, 'DINING', 'NIGHT', 'night-snack'),
        seg(1230 + late, 1275 + late, 'COMMUTE', 'STREET', 'walk')
      ] : [
        seg(1050, 1080, 'COMMUTE', 'STREET', 'ride'),
        seg(1080, 1160, 'HOME', 'HOME'),
        seg(1160, 1220, 'DINING', 'HOME'),
        seg(1220, 1290, 'HOME', 'HOME', 'leisure')
      ];
      return day(1290, 390, [
        seg(390, 450, 'HOME', 'HOME', 'wake'),
        seg(450, 480, 'COMMUTE', 'STREET', 'ride'),
        seg(480, 720, 'AT_WORK', 'WORK', 'labour'),
        seg(720, 780, 'DINING', 'WORK', 'canteen'),
        seg(780, 1050, 'AT_WORK', 'WORK', 'labour')
      ].concat(out));
    },
    /* §6.2 shopkeeper: 8:30 开店 / 午饭店内 / 21 关店. A fifth of them slip out for ten
     * in the morning to put yesterday's takings in the bank — the shop is quiet then,
     * and it is the one hour the branch and the street are both open. The branch shuts
     * at five, so a "deposit the evening's takings" leg would be a customer walking
     * into a closed building; this is why it is morning and not nine at night. */
    shopkeeper: function (c) {
      var v = c && c.variant !== undefined ? c.variant : 99;
      if (v >= 22) {
        return day(1350, 360, [
          seg(360, 450, 'HOME', 'HOME', 'wake'),
          seg(450, 510, 'COMMUTE', 'STREET', 'walk'),
          seg(510, 750, 'AT_WORK', 'WORK', 'reception'),
          seg(750, 795, 'DINING', 'WORK', 'canteen'),
          seg(795, 1260, 'AT_WORK', 'WORK', 'reception'),
          seg(1260, 1305, 'COMMUTE', 'STREET', 'walk'),
          seg(1305, 1350, 'HOME', 'HOME')
        ]);
      }
      return day(1350, 360, [
        seg(360, 450, 'HOME', 'HOME', 'wake'),
        seg(450, 510, 'COMMUTE', 'STREET', 'walk'),
        seg(510, 600, 'AT_WORK', 'WORK', 'reception'),
        seg(600, 620, 'COMMUTE', 'STREET', 'walk'),
        seg(620, 670, 'SHOPPING', 'BANK', 'takings'),
        seg(670, 690, 'COMMUTE', 'STREET', 'walk'),
        seg(690, 750, 'AT_WORK', 'WORK', 'reception'),
        seg(750, 795, 'DINING', 'WORK', 'canteen'),
        seg(795, 1260, 'AT_WORK', 'WORK', 'reception'),
        seg(1260, 1305, 'COMMUTE', 'STREET', 'walk'),
        seg(1305, 1350, 'HOME', 'HOME')
      ]);
    },
    // §6.2 driver: 早晚两班中间回家吃饭.
    driver: function () {
      return day(1290, 360, [
        seg(360, 390, 'HOME', 'HOME', 'wake'),
        seg(390, 420, 'COMMUTE', 'STREET', 'ride'),
        seg(420, 720, 'AT_WORK', 'WORK', 'driving'),
        seg(720, 870, 'HOME', 'HOME', 'rest'),
        seg(870, 900, 'COMMUTE', 'STREET', 'ride'),
        seg(900, 1230, 'AT_WORK', 'WORK', 'driving'),
        seg(1230, 1290, 'HOME', 'HOME')
      ]);
    },
    /* Wholesale market crew (§4.4): the 农贸批发市场 peaks before dawn — that is the one
     * stretch W1 measured as a truly empty street (00:00–06:00 = 0 pedestrians) — but it
     * then trades to midday, so the 40 of them split by habit into two stalls: the
     * wholesale half opens at 04:00 and sleeps off the morning, the retail half comes in
     * for the hours the neighbours actually shop. A market whose whole staff goes home at
     * 08:00 while shoppers are still inside buying vegetables is not a market. */
    'market-early': function (c) {
      var v = c ? c.variant : 0;
      if (v >= 50) {
        return day(1320, 390, [
          seg(390, 420, 'HOME', 'HOME', 'wake'),
          seg(420, 450, 'COMMUTE', 'STREET', 'ride'),
          seg(450, 690, 'AT_WORK', 'WORK', 'retail'),
          seg(690, 720, 'COMMUTE', 'STREET', 'ride'),
          seg(720, 840, 'HOME', 'HOME', 'rest'),
          seg(840, 870, 'COMMUTE', 'STREET', 'walk'),
          seg(870, 1020, 'LEISURE', 'PLAZA', 'afternoon'),
          seg(1020, 1050, 'COMMUTE', 'STREET', 'walk'),
          seg(1050, 1110, 'DINING', 'HOME'),
          seg(1110, 1320, 'HOME', 'HOME', 'leisure')
        ]);
      }
      return day(1290, 180, [
        seg(180, 210, 'HOME', 'HOME', 'wake'),
        seg(210, 240, 'COMMUTE', 'STREET', 'ride'),
        seg(240, 420, 'AT_WORK', 'WORK', 'wholesale'),
        seg(420, 450, 'DINING', 'WORK', 'stall-breakfast'),
        seg(450, 480, 'AT_WORK', 'WORK', 'wholesale'),
        seg(480, 510, 'COMMUTE', 'STREET', 'ride'),
        seg(510, 660, 'SLEEPING', 'HOME', 'nap'),
        seg(660, 720, 'HOME', 'HOME'),
        seg(720, 750, 'COMMUTE', 'STREET', 'walk'),
        seg(750, 930, 'LEISURE', 'PLAZA', 'afternoon'),
        seg(930, 960, 'COMMUTE', 'STREET', 'walk'),
        seg(960, 1050, 'HOME', 'HOME'),
        seg(1050, 1110, 'DINING', 'HOME'),
        seg(1110, 1290, 'HOME', 'HOME', 'leisure')
      ]);
    },
    // Night-market stall owner: asleep at midnight, set up at five, trading till late.
    'night-market': function () {
      return day(null, null, [
        seg(0, 330, 'SLEEPING', 'HOME'),
        seg(330, 540, 'HOME', 'HOME'),
        seg(540, 690, 'SLEEPING', 'HOME', 'nap'),
        seg(690, 930, 'HOME', 'HOME', 'prep'),
        seg(930, 960, 'COMMUTE', 'STREET', 'ride'),
        seg(960, 1080, 'AT_WORK', 'WORK', 'set-up'),
        seg(1080, 1260, 'AT_WORK', 'WORK', 'stall'),
        seg(1260, 1305, 'DINING', 'WORK', 'staff-meal'),
        seg(1305, 1410, 'AT_WORK', 'WORK', 'stall'),
        seg(1410, 1440, 'COMMUTE', 'STREET', 'ride')
      ]);
    },
    // §6.1 student-p and §6.2 school staff; middle school adds evening study.
    'student-p': function (c) {
      var v = c && c.variant !== undefined ? c.variant : 99;
      // A quarter of them do not go straight home (§4.4.2). The rides are the only venue
      // in town that belongs to children rather than to the adult leisure ledger, and
      // this leg is what keeps it from standing empty on a Tuesday afternoon.
      var afterSchool = v < 25 ? [
        seg(960, 1005, 'COMMUTE', 'STREET', 'walk'),
        seg(1005, 1125, 'LEISURE', 'AMUSEMENT', 'after-school'),
        seg(1125, 1170, 'COMMUTE', 'STREET', 'walk'),
        seg(1170, 1260, 'HOME', 'HOME', 'homework')
      ] : [
        seg(960, 1020, 'COMMUTE', 'STREET', 'walk'),
        seg(1020, 1140, 'HOME', 'HOME', 'leisure'),
        seg(1140, 1260, 'HOME', 'HOME', 'homework')
      ];
      return day(1260, 390, [
        seg(390, 450, 'HOME', 'HOME', 'wake'),
        seg(450, 480, 'COMMUTE', 'STREET', 'walk'),
        seg(480, 690, 'AT_WORK', 'WORK', 'class'),
        seg(690, 810, 'AT_WORK', 'WORK', 'lunch'),
        seg(810, 960, 'AT_WORK', 'WORK', 'class')
      ].concat(afterSchool));
    },
    'student-m': function () {
      return day(1350, 360, [
        seg(360, 420, 'HOME', 'HOME', 'wake'),
        seg(420, 450, 'COMMUTE', 'STREET', 'walk'),
        seg(450, 690, 'AT_WORK', 'WORK', 'class'),
        seg(690, 810, 'AT_WORK', 'WORK', 'lunch'),
        seg(810, 1020, 'AT_WORK', 'WORK', 'class'),
        seg(1020, 1230, 'AT_WORK', 'WORK', 'evening-study'),
        seg(1230, 1290, 'COMMUTE', 'STREET', 'walk'),
        seg(1290, 1350, 'HOME', 'HOME')
      ]);
    },
    teacher: function () {
      return day(1320, 390, [
        seg(390, 450, 'HOME', 'HOME', 'wake'),
        seg(450, 480, 'COMMUTE', 'STREET', 'walk'),
        seg(480, 720, 'AT_WORK', 'WORK', 'class'),
        seg(720, 780, 'DINING', 'WORK', 'canteen'),
        seg(780, 1020, 'AT_WORK', 'WORK', 'office'),
        seg(1020, 1050, 'COMMUTE', 'STREET', 'walk'),
        seg(1050, 1140, 'HOME', 'HOME'),
        seg(1140, 1200, 'DINING', 'HOME'),
        seg(1200, 1320, 'HOME', 'HOME', 'lesson-prep')
      ]);
    },
    // College: loose morning, campus then town. Two in five finish the day at the
    // night market rather than the plaza, which is what a Chinese campus town does,
    // and a third of them shop at the small annex centre instead of the big mall.
    'student-u': function (c) {
      var v = c ? c.variant : 99;
      var late = (v % 3) * 30;
      var out = v < 40 ? [
        seg(1080, 1110, 'COMMUTE', 'STREET', 'walk'),
        seg(1110, 1260 + late, 'DINING', 'NIGHT', 'night-snack'),
        seg(1260 + late, 1290 + late, 'COMMUTE', 'STREET', 'walk')
      ] : [
        seg(1080, 1110, 'COMMUTE', 'STREET', 'walk'),
        seg(1110, 1140, 'LEISURE', 'PLAZA'),
        seg(1140, 1170, 'COMMUTE', 'STREET', 'walk'),
        seg(1170, 1380, 'HOME', 'HOME', 'leisure')
      ];
      return day(1380, 540, [
        seg(540, 630, 'HOME', 'HOME', 'wake'),
        seg(630, 660, 'COMMUTE', 'STREET', 'walk'),
        seg(660, 840, 'AT_WORK', 'WORK', 'class'),
        seg(840, 900, 'DINING', 'WORK', 'canteen'),
        seg(900, 930, 'COMMUTE', 'STREET', 'walk'),
        seg(930, 1080, 'SHOPPING', v < 35 ? 'ANNEX' : 'MALL')
      ].concat(out));
    },
    // §6.2 rotating shift staff; early (08–16) and mid (16–24) share this shape,
    // night (00–08) lives in its own day-reversed template.
    shift: function (c) {
      var early = !c || !c.shift || c.shift.start === 480;
      if (early) {
        return day(1320, 420, [
          seg(435, 480, 'COMMUTE', 'STREET', 'walk'),
          seg(480, 720, 'AT_WORK', 'WORK', 'duty'),
          seg(720, 780, 'DINING', 'WORK', 'canteen'),
          seg(780, 960, 'AT_WORK', 'WORK', 'duty'),
          seg(960, 1020, 'COMMUTE', 'STREET', 'walk'),
          seg(1020, 1200, 'HOME', 'HOME', 'leisure')
        ]);
      }
      // Mid shift 16–24: short sleep at the head of the day, work ends at midnight,
      // the way home belongs to the next day's sleep bookkeeping.
      return day(null, null, [
        seg(0, 60, 'SLEEPING', 'HOME'),
        seg(60, 390, 'HOME', 'HOME'),
        seg(390, 450, 'DINING', 'HOME'),
        seg(450, 930, 'HOME', 'HOME', 'leisure'),
        seg(930, 960, 'COMMUTE', 'STREET', 'walk'),
        seg(960, 1200, 'AT_WORK', 'WORK', 'duty'),
        seg(1200, 1260, 'DINING', 'WORK', 'canteen'),
        seg(1260, 1440, 'AT_WORK', 'WORK', 'duty')
      ]);
    },
    // Night shift 00–08: finishes the night block, sleeps through the afternoon —
    // this is the template that makes 03:00 show real hospital staff (镜头③).
    'shift-night': function () {
      return day(null, null, [
        seg(0, 420, 'AT_WORK', 'WORK', 'duty'),
        seg(420, 480, 'DINING', 'WORK', 'canteen'),
        seg(480, 540, 'COMMUTE', 'STREET', 'walk'),
        seg(540, 1140, 'SLEEPING', 'HOME'),
        seg(1140, 1200, 'DINING', 'HOME'),
        seg(1200, 1320, 'HOME', 'HOME'),
        seg(1320, 1380, 'COMMUTE', 'STREET', 'walk'),
        seg(1380, 1440, 'AT_WORK', 'WORK', 'duty')
      ]);
    },
    // Patient: lives in the hospital ward, treatment windows (§4.3 病房楼层留给 W2).
    patient: function () {
      return day(1290, 360, [
        seg(360, 480, 'HOME', 'WORK', 'ward-rest'),
        seg(480, 660, 'MEDICAL', 'WORK', 'treatment'),
        seg(660, 720, 'DINING', 'WORK', 'ward-meal'),
        seg(720, 840, 'HOME', 'WORK', 'ward-rest'),
        seg(840, 1020, 'MEDICAL', 'WORK', 'treatment'),
        seg(1020, 1080, 'LEISURE', 'WORK', 'corridor'),
        seg(1080, 1140, 'DINING', 'WORK', 'ward-meal'),
        seg(1140, 1290, 'HOME', 'WORK', 'ward-rest')
      ]);
    },
    // Hospital visitor for M0: a few hours at the ward then back.
    visitor: function () {
      return day(1320, 450, [
        seg(450, 510, 'HOME', 'HOME', 'wake'),
        seg(510, 570, 'COMMUTE', 'STREET', 'walk'),
        seg(570, 750, 'MEDICAL', 'WORK', 'visiting'),
        seg(750, 810, 'DINING', 'STREET', 'street-food'),
        seg(810, 1020, 'MEDICAL', 'WORK', 'visiting'),
        seg(1020, 1080, 'COMMUTE', 'STREET', 'walk'),
        seg(1080, 1320, 'HOME', 'HOME', 'leisure')
      ]);
    },
    // §6.2 retiree: 5:30 起 / 早茶广场 / 下午棋牌 / 接孙 / 21 电视 / 22 睡.
    // Three variant branches keep this the busiest role on screen without turning any
    // of its buildings into a crush: a fifth do the household grocery run at the market
    // while it is still trading, a small share book the clinic on their own block, and
    // the school-gate pick-up runs on three staggered windows.
    // The two street legs are 35 minutes, not an hour: 190 people walking for 60 minutes
    // at once is the loudest platoon in the town and a retiree does not stroll for an
    // hour between two benches. The time went back to the plaza, where it reads better.
    retiree: function (c) {
      var v = c ? c.variant : 99;
      var morning = v >= 8 && v < 20 ? [
        seg(390, 420, 'COMMUTE', 'STREET', 'walk'),
        seg(420, 540, 'SHOPPING', 'MARKET', 'grocery'),
        seg(540, 570, 'COMMUTE', 'STREET', 'walk'),
        seg(570, 625, 'LEISURE', 'PLAZA', 'morning-exercise')
      ] : [
        seg(390, 420, 'COMMUTE', 'STREET', 'walk'),
        seg(420, 625, 'LEISURE', 'PLAZA', 'morning-exercise')
      ];
      var mid = v < 8 ? [
        seg(720, 750, 'COMMUTE', 'STREET', 'walk'),
        seg(750, 810, 'MEDICAL', 'CLINIC', 'check-up'),
        seg(810, 840, 'COMMUTE', 'STREET', 'walk')
      ] : v >= 24 && v < 36 ? [
        // 领养老金: the reason the bank has a queue at all, and the reason it has one
        // at half past twelve rather than at nine — the early shift at the counter is
        // the town's own clerks arriving, the early shift *of customers* is later.
        seg(720, 745, 'COMMUTE', 'STREET', 'walk'),
        seg(745, 815, 'SHOPPING', 'BANK', 'pension'),
        seg(815, 840, 'COMMUTE', 'STREET', 'walk')
      ] : v >= 36 && v < 42 ? [
        seg(720, 745, 'COMMUTE', 'STREET', 'walk'),
        seg(745, 815, 'SHOPPING', 'CIVIC', 'records'),
        seg(815, 840, 'COMMUTE', 'STREET', 'walk')
      ] : [
        seg(720, 805, 'HOME', 'HOME'),
        seg(805, 840, 'COMMUTE', 'STREET', 'walk')
      ];
      var gamesEnd = v < 34 ? 900 : v < 67 ? 960 : 1020;
      // Nobody to collect at the gate on a weekend (§4.4.2), so the same walk becomes
      // the Sunday afternoon at the mall. The leg keeps its slot in the day, which is
      // why the retiree curve moves rather than shrinks when the week turns.
      var weekend = !!(c && c.dayType && c.dayType !== 'weekday');
      // 广场舞: a quarter of them come back out after dinner, which is the single
      // most Chinese thing a town at 20:30 looks like — and the reason the street is
      // not a dead line between the evening peak and bedtime.
      var night = v >= 28 && v < 52 ? [
        seg(1200, 1230, 'COMMUTE', 'STREET', 'walk'),
        seg(1230, 1300, 'LEISURE', 'PLAZA', 'square-dance'),
        seg(1300, 1320, 'COMMUTE', 'STREET', 'walk')
      ] : [
        seg(1200, 1320, 'HOME', 'HOME', 'tv')
      ];
      return day(1320, 330, [
        seg(330, 390, 'HOME', 'HOME', 'wake'),
        seg(625, 660, 'COMMUTE', 'STREET', 'walk'),
        seg(660, 720, 'DINING', 'HOME')
      ].concat(morning, mid, [
        seg(840, gamesEnd, 'LEISURE', 'PLAZA', 'board-games'),
        seg(gamesEnd, gamesEnd + 30, 'COMMUTE', 'STREET', 'walk'),
        seg(gamesEnd + 30, gamesEnd + 90,
          weekend && v < 30 ? 'SHOPPING' : 'LEISURE',
          weekend ? (v < 30 ? 'MALL' : 'PLAZA') : 'SCHOOL',
          weekend ? (v < 30 ? 'errand' : 'stroll') : 'pick-up'),
        seg(gamesEnd + 90, gamesEnd + 120, 'COMMUTE', 'STREET', 'walk'),
        seg(gamesEnd + 120, gamesEnd + 180, 'DINING', 'HOME')
      ], night));
    },
    // Senior 71+: quieter, one short walk, the highest clinic-visit share in town and
    // a morning grocery run of their own.
    senior: function (c) {
      var v = c ? c.variant : 99;
      var mid = v < 12 ? [
        seg(510, 600, 'HOME', 'HOME'),
        seg(600, 630, 'COMMUTE', 'STREET', 'walk'),
        seg(630, 720, 'MEDICAL', 'CLINIC', 'check-up'),
        seg(720, 750, 'COMMUTE', 'STREET', 'walk'),
        seg(750, 840, 'HOME', 'HOME')
      ] : v < 24 ? [
        seg(510, 540, 'HOME', 'HOME'),
        seg(540, 570, 'COMMUTE', 'STREET', 'walk'),
        // The oldest customers are the ones who still go in person: half of this band
        // is at the counter drawing pension instead of at the market for greens, and
        // they are why the branch's morning is busier than its afternoon.
        seg(570, 690, 'SHOPPING', v >= 16 ? 'BANK' : 'MARKET', v >= 16 ? 'pension' : 'grocery'),
        seg(690, 720, 'COMMUTE', 'STREET', 'walk'),
        seg(720, 840, 'HOME', 'HOME')
      ] : [
        seg(510, 840, 'HOME', 'HOME')
      ];
      return day(1230, 360, [
        seg(360, 450, 'HOME', 'HOME', 'wake'),
        seg(450, 510, 'DINING', 'HOME')
      ].concat(mid, [
        seg(840, 875, 'COMMUTE', 'STREET', 'walk'),
        seg(875, 990, 'LEISURE', 'PLAZA', 'stroll'),
        seg(990, 1025, 'COMMUTE', 'STREET', 'walk'),
        seg(1080, 1140, 'DINING', 'HOME'),
        seg(1140, 1230, 'HOME', 'HOME', 'tv')
      ]));
    },
    // Pre-school: home orbit, stroller hours in the plaza.
    child: function () {
      return day(1275, 405, [
        seg(405, 540, 'HOME', 'HOME', 'wake'),
        seg(540, 600, 'DINING', 'HOME'),
        seg(600, 720, 'HOME', 'HOME'),
        seg(720, 780, 'COMMUTE', 'STREET', 'walk'),
        seg(780, 990, 'LEISURE', 'PLAZA', 'stroller'),
        seg(990, 1050, 'COMMUTE', 'STREET', 'walk'),
        seg(1050, 1170, 'HOME', 'HOME', 'nap'),
        seg(1170, 1275, 'HOME', 'HOME')
      ]);
    },
    // Unemployed / between-jobs: late sleep, drifts through mall and plaza, and half
    // of them eat dinner at the night market because it is the cheapest table in town.
    idler: function (c) {
      var v = c ? c.variant : 99;
      var late = (v % 3) * 30;
      var out = v < 50 ? [
        seg(1140, 1170, 'COMMUTE', 'STREET', 'walk'),
        seg(1170, 1290 + late, 'DINING', 'NIGHT', 'night-snack'),
        seg(1290 + late, 1320 + late, 'COMMUTE', 'STREET', 'walk')
      ] : [
        seg(1140, 1200, 'DINING', 'STREET', 'street-food'),
        seg(1200, 1380, 'HOME', 'HOME', 'leisure')
      ];
      // Between jobs is the one crowd the sub-district office genuinely serves: half
      // of this band spends the afternoon on its waiting bench instead of the plaza,
      // which is what makes the office a building with a public rather than a room
      // with staff in it.
      var queue = v >= 66 && v < 82;
      return day(1380, 570, [
        seg(570, 660, 'HOME', 'HOME', 'wake'),
        seg(660, 720, 'DINING', 'HOME'),
        seg(720, 765, 'COMMUTE', 'STREET', 'walk'),
        seg(765, 960, queue ? 'SHOPPING' : 'LEISURE', queue ? 'CIVIC' : 'PLAZA',
          queue ? 'welfare-queue' : undefined),
        seg(960, 1005, 'COMMUTE', 'STREET', 'walk'),
        seg(1005, 1140, 'SHOPPING', v < 35 ? 'ANNEX' : 'MALL')
      ].concat(out));
    },

    /* Police post (§4.4.1): eight people over the three windows — 3/3/2 — which is the
     * honest scale for a town of 1000. Mid and night borrow the hospital's rotating
     * shape verbatim; only the early shift has something the town will actually see, a
     * 护学岗 at the school gate for the last 45 minutes of its watch, which is where the
     * biggest single-venue peak in the ledger sits (121 on the school lot at 15:40).
     * Who stands there is a *roster* rule, not a habit coin: the first number on the
     * early shift keeps the desk and the other two walk over. An earlier draft drew it
     * from `variant`, and on one of the two candidate showcase seeds nobody happened to
     * pull the gate — a school gate that is staffed nine times out of ten is not staffed. */
    precinct: function (c) {
      var ordinal = c && c.ordinal ? c.ordinal : 1;
      var open = c && c.shift ? c.shift.start : 480;
      if (open === 960) return TEMPLATES.shift(c);
      if (open === 0) return TEMPLATES['shift-night'](c);
      // No school, no school run: the gate posting only exists on a teaching day, so on
      // a weekend the early shift stays on the desk and the patrol car does the rounds.
      var schoolDay = !c || !c.dayType || c.dayType === 'weekday';
      var gate = ordinal !== 1 && schoolDay;
      return day(1320, 420, [
        seg(435, 480, 'COMMUTE', 'STREET', 'walk'),
        seg(480, 900, 'AT_WORK', 'WORK', gate ? 'patrol' : 'desk'),
        seg(900, 915, 'COMMUTE', 'STREET', 'walk'),
        seg(915, 960, 'AT_WORK', gate ? 'POST' : 'WORK', gate ? 'school-gate' : 'desk'),
        seg(960, 1005, 'COMMUTE', 'STREET', 'walk'),
        seg(1005, 1140, 'HOME', 'HOME'),
        seg(1140, 1200, 'DINING', 'HOME'),
        seg(1200, 1320, 'HOME', 'HOME', 'leisure')
      ]);
    },
    // Bank counter and sub-district window: one day shape, two workplaces. The
    // branch shuts to the public at 17:00 but the ledger keeps the last two clerks
    // until 17:30 squaring the day's takings, which is the difference between a
    // building that goes dark and one that closes.
    clerk: function (c) {
      var v = c && c.variant !== undefined ? c.variant : 0;
      // Saturday half day (§4.4.2): the counter opens at 08:00 and shuts at 14:00 —
      // measured, not chosen. The pension errands land in two bands (retirees 12:25–
      // 13:35, idlers to 14:00), so a noon closing left 29 people queued in a bank with
      // zero tellers in it, which is the one kind of false the ledger exists to prevent.
      // Six hours is still three and a half shorter than the weekday counter.
      if (c && c.halfDay) {
        return day(1300, 390, [
          seg(390, 435, 'HOME', 'HOME', 'wake'),
          seg(435, 480, 'COMMUTE', 'STREET', 'walk'),
          seg(480, 840, 'AT_WORK', 'WORK', 'counter'),
          seg(840, 870, 'COMMUTE', 'STREET', 'walk'),
          seg(870, 930, 'DINING', 'HOME', 'lunch'),
          seg(930, 1300, 'HOME', 'HOME', 'afternoon-off')
        ]);
      }
      var late = v < 16 ? [
        seg(1020, 1050, 'AT_WORK', 'WORK', 'balanceday'),
        seg(1050, 1080, 'DINING', 'WORK', 'boxed-meal'),
        seg(1080, 1110, 'COMMUTE', 'STREET', 'walk')
      ] : [
        seg(1020, 1050, 'COMMUTE', 'STREET', 'walk')
      ];
      return day(1300, 390, [
        seg(390, 435, 'HOME', 'HOME', 'wake'),
        seg(435, 480, 'COMMUTE', 'STREET', 'walk'),
        seg(480, 720, 'AT_WORK', 'WORK', 'counter'),
        seg(720, 780, 'DINING', 'WORK', 'canteen'),
        seg(780, 1020, 'AT_WORK', 'WORK', 'counter')
      ].concat(late, [
        seg(1110, 1170, 'HOME', 'HOME'),
        seg(1170, 1230, 'DINING', 'HOME'),
        seg(1230, 1300, 'HOME', 'HOME', 'tv')
      ]));
    },
    /* Sanitation (§4.4.1): the crew the town used to be silently missing — a 1000-
     * person town produces about a tonne of waste a day and nothing in the model
     * carried it off. Seven of the ten take the dawn round out at 04:30, *behind* the
     * 04:00 wholesale trucks rather than on top of them, so the pre-dawn hour gets
     * two separate reasons for traffic; the other three clear the riverfront after
     * the food street folds its tables. The third shift window folds into the dawn
     * crew, because a town this size does not run a night collection. */
    sanitation: function (c) {
      var open = c && c.shift ? c.shift.start : 480;
      if (open === 960) {
        return day(1350, 810, [
          seg(810, 870, 'HOME', 'HOME', 'wake'),
          seg(870, 900, 'COMMUTE', 'STREET', 'ride'),
          seg(900, 1140, 'AT_WORK', 'WORK', 'riverfront'),
          seg(1140, 1185, 'DINING', 'WORK', 'stall-leftovers'),
          seg(1185, 1290, 'AT_WORK', 'WORK', 'yard'),
          seg(1290, 1320, 'COMMUTE', 'STREET', 'ride')
        ]);
      }
      return day(1290, 255, [
        seg(255, 285, 'COMMUTE', 'STREET', 'ride'),
        seg(285, 540, 'AT_WORK', 'WORK', 'collection'),
        seg(540, 585, 'DINING', 'WORK', 'yard-breakfast'),
        seg(585, 720, 'AT_WORK', 'WORK', 'transfer'),
        seg(720, 750, 'COMMUTE', 'STREET', 'ride'),
        seg(750, 900, 'HOME', 'HOME'),
        seg(900, 960, 'DINING', 'HOME'),
        seg(960, 1290, 'HOME', 'HOME', 'nap')
      ]);
    },
    /* The rest day (§4.4.2). This is not the weekday template with the work legs cut
     * out. A Sunday has its own shape: nobody leaves at seven, the morning errand is the
     * market run the whole family does together, and the buildings that stay open are the
     * ones trading on leisure rather than on labour. Branches run by role, because a
     * seven-year-old, a twenty-year-old and a forty-year-old do not spend a Sunday in the
     * same building. The amusement park is also the one venue no adult's leisure ledger
     * ever seats, so Sunday is when the children get it to themselves: 30% of them by
     * habit, which fills it without ever filling it up. */
    weekend: function (c) {
      var v = c && c.variant !== undefined ? c.variant : 50;
      var role = (c && c.role) || '';
      var kid = role === 'preschooler' || role === 'student-p' || role === 'student-m';
      if (kid) {
        // Children are the one population the leisure ledger never seats, so Sunday is
        // the only day they get a venue of their own. The band is a quarter of them, not
        // a third: raising the park's cap to make room would be self-defeating, because
        // the ledger hands out floor(cap × 0.85) seats, so a bigger park simply seats more
        // adults there on weekdays and the weekend crush comes back. Capacity has to be
        // fixed first and the crowd fitted to it.
        var kidOut = v < 25 ? ['AMUSEMENT', 'rides'] : v < 50 ? ['MALL', 'arcade'] : ['PLAZA', 'playground'];
        return day(1290, 480, [
          seg(480, 540, 'HOME', 'HOME', 'wake'),
          seg(540, 600, 'DINING', 'HOME', 'family-breakfast'),
          seg(600, 660, 'HOME', 'HOME'),
          seg(660, 705, 'COMMUTE', 'STREET', 'walk'),
          seg(705, 900, 'LEISURE', kidOut[0], kidOut[1]),
          seg(900, 945, 'COMMUTE', 'STREET', 'walk'),
          seg(945, 1005, 'DINING', 'HOME', 'lunch'),
          seg(1005, 1140, 'HOME', 'HOME', 'nap'),
          seg(1140, 1185, 'COMMUTE', 'STREET', 'walk'),
          seg(1185, 1260, 'LEISURE', 'PLAZA', 'evening-play'),
          seg(1260, 1290, 'COMMUTE', 'STREET', 'walk')
        ]);
      }
      if (role === 'student-u') {
        return day(1380, 540, [
          seg(540, 600, 'HOME', 'HOME', 'wake'),
          seg(600, 660, 'DINING', 'HOME', 'brunch'),
          seg(660, 780, 'HOME', 'HOME'),
          seg(780, 825, 'COMMUTE', 'STREET', 'walk'),
          seg(825, 1020, 'LEISURE', 'PLAZA', 'afternoon'),
          seg(1020, 1065, 'COMMUTE', 'STREET', 'walk'),
          seg(1065, 1125, 'DINING', 'HOME'),
          seg(1125, 1170, 'COMMUTE', 'STREET', 'walk'),
          seg(1170, 1320, 'DINING', v < 48 ? 'NIGHT' : 'MALL', v < 48 ? 'night-snack' : 'food-court'),
          seg(1320, 1380, 'COMMUTE', 'STREET', 'walk')
        ]);
      }
      // Adults: three outings a day, each split across the venues that are actually open
      // and actually have room. The bands are narrow on purpose — the first draft sent
      // everybody to the wholesale market at eleven and drew 235 people into a 90-stall
      // hall, which is the same mistake the bank's 49-person queue was, one level up: a
      // Sunday crowd has to be *distributed*, not just scheduled.
      var walk = function (from, to) { return seg(from, to, 'COMMUTE', 'STREET', 'walk'); };
      var morning = v < 15 ? ['MARKET', 'grocery'] : v < 30 ? ['MALL', 'shopping']
        : v < 42 ? ['ANNEX', 'shopping'] : ['PLAZA', 'stroll'];
      var afternoon = v < 30 ? ['MALL', 'shopping'] : v < 48 ? ['ANNEX', 'shopping']
        : v < 56 ? ['AMUSEMENT', 'with-the-kids'] : ['PLAZA', 'stroll'];
      return day(1350, 480, [
        seg(480, 540, 'HOME', 'HOME', 'wake'),
        seg(540, 600, 'DINING', 'HOME', 'family-breakfast'),
        walk(600, 645),
        seg(645, 780, morning[0] === 'PLAZA' ? 'LEISURE' : 'SHOPPING', morning[0], morning[1]),
        walk(780, 825),
        seg(825, 900, 'HOME', 'HOME'),
        seg(900, 960, 'DINING', 'HOME', 'lunch'),
        walk(960, 1005),
        seg(1005, 1170, afternoon[0] === 'PLAZA' ? 'LEISURE' : 'SHOPPING', afternoon[0], afternoon[1]),
        walk(1170, 1215),
        seg(1215, 1290, 'DINING', v < 26 ? 'NIGHT' : 'HOME', v < 26 ? 'night-snack' : 'supper'),
        seg(1290, 1350, 'HOME', 'HOME', 'tv')
      ]);
    },
    /* Sunday duty (§4.4.2): one person inside each building that would otherwise be
     * dark. The 校工 watering the yard, the tower's 运维 in the plant room, the 物业保安
     * at the block gate. Short shift, no counter, no public. The point is that a closed
     * building is not an abandoned one, so the film can show a lit window in a shut
     * school without lying about it: somebody really is in there. `DUTY` resolves to a
     * different building from the resident's own workplace, and the roster rotates by
     * week so it is not the same fifteen people working every Sunday forever. */
    duty: function () {
      return day(1320, 420, [
        seg(420, 480, 'HOME', 'HOME', 'wake'),
        seg(480, 510, 'COMMUTE', 'STREET', 'ride'),
        seg(510, 720, 'AT_WORK', 'DUTY', 'maintenance'),
        seg(720, 765, 'DINING', 'DUTY', 'duty-meal'),
        seg(765, 960, 'AT_WORK', 'DUTY', 'rounds'),
        seg(960, 990, 'COMMUTE', 'STREET', 'ride'),
        seg(990, 1140, 'HOME', 'HOME'),
        seg(1140, 1200, 'DINING', 'HOME'),
        seg(1200, 1320, 'HOME', 'HOME', 'tv')
      ]);
    }
  };

  // role → template + notes (shift users get their window from resident.shiftIndex).
  var ROLE_TEMPLATE = {
    preschooler: 'child',
    'student-p': 'student-p',
    'student-m': 'student-m',
    'student-u': 'student-u',
    teacher: 'teacher',
    'school-admin': 'office',
    office: 'office',
    worker: 'worker',
    shopkeeper: 'shopkeeper',
    driver: 'driver',
    'medical-doc': 'shift',
    'medical-nurse': 'shift',
    'hosp-admin': 'office',
    // W1.5c (§4.4.1): the three public-service trades. `officer` and `sanitation` are
    // shift roles like the hospital's; `clerk` is a single day shape shared by the two
    // counters, because a bank teller and a sub-district window open and shut together.
    officer: 'precinct',
    clerk: 'clerk',
    sanitation: 'sanitation',
    patient: 'patient',
    visitor: 'visitor',
    retiree: 'retiree',
    senior: 'senior',
    unemployed: 'idler'
  };

  /* Resolve the day-shape for one resident: the role table first, then two overrides
   * that come from *where* they work rather than what they are — the wholesale market
   * opens before dawn and the night market never sees it. A resident built without
   * workplaceKind (a test fixture, an M0 town, a hand-written plan) gets the plain
   * role template, so this stays a widening, never a breaking change.
   *
   * §4.4.2 adds the week: `dayType` is 'weekday' | 'saturday' | 'sunday' and `onDuty`
   * says this resident is on the weekend building roster. Both are decided by the
   * caller, because only `buildDay` knows which day it is composing. Omit them and
   * every day is a weekday, which is what the pre-W1.5d tests assumed. */
  function closesOn(policy, dayType) {
    if (!dayType || dayType === 'weekday') return false;
    if (policy === 'weekday') return true;
    return policy === 'sat-am' && dayType === 'sunday';
  }

  function halfDayOn(policy, dayType) {
    return policy === 'sat-am' && dayType === 'saturday';
  }

  function templateFor(resident, dayType, onDuty) {
    var name = ROLE_TEMPLATE[resident.role];
    if (!name) throw new Error('no schedule template for role ' + resident.role);
    // Duty beats everything: the person watering the school yard on Sunday is not
    // having a weekend, whatever their trade.
    if (onDuty) return TEMPLATES.duty;
    // Three-shift roster (§6.2): early and mid share the generic shift shape,
    // night sleeps by day so it needs its own.
    if (name === 'shift' && resident.shiftIndex === 2) name = 'shift-night';
    if (resident.workplaceKind === 'market') return TEMPLATES['market-early'];
    if (resident.workplaceKind === 'night-market') return TEMPLATES['night-market'];
    if (closesOn(resident.venuePolicy, dayType)) return TEMPLATES.weekend;
    return TEMPLATES[name];
  }

  // Templates that branch on the per-resident variant draw, for the tests that want
  // to prove both branches exist and both are legal. `sanitation` and `precinct` are
  // deliberately not here: their splits come from the shift window and the roster
  // number, which are duties rather than habits, and a duty that depends on a coin
  // flip is how the school gate ended up unmanned on a showcase seed.
  var VARIANT_TEMPLATES = ['office', 'worker', 'student-u', 'idler', 'retiree', 'senior',
    'clerk', 'shopkeeper', 'weekend', 'student-p'];

  return {
    STATES: STATES,
    TEMPLATES: TEMPLATES,
    ROLE_TEMPLATE: ROLE_TEMPLATE,
    VARIANT_TEMPLATES: VARIANT_TEMPLATES,
    templateFor: templateFor,
    closesOn: closesOn,
    halfDayOn: halfDayOn,
    seg: seg,
    day: day
  };
});
