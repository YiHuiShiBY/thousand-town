/* 24h daily clock (design doc §5). The sim day is 1440 minutes; wall time maps to
 * sim minutes as a pure function, so pausing, seeking and exporting stay consistent
 * with the construction timeline. One day = 900 real seconds (15 minutes) at the
 * default speed; the HUD 2×/4× buttons are what turn it into a 24h flyover shot. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CityDailyClock = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var MINUTES_PER_DAY = 1440;
  var SECONDS_PER_SIM_MINUTE = 0.625; // default: one sim day = 900 real seconds (§5.2)

  // Day-bound anchors from §5.3, in sim minutes since midnight.
  var ANCHORS = {
    dawn: 300,      // 05:00
    wake: 360,      // 06:00
    commute: 420,   // 07:00
    workStart: 480, // 08:00
    lunch: 720,     // 12:00
    afternoon: 840, // 14:00
    offWork: 1020,  // 17:00
    dinner: 1140,   // 19:00
    sleep: 1320     // 22:00
  };

  // Lamps run 18:30–06:00 (§5.4); dusk fades 18:30–19:30, then full night.
  var LAMP_ON = 1110;
  var LAMP_OFF = 360;
  var SUNRISE = 330;
  var DUSK_START = 1110;
  var NIGHT_START = 1170;

  function modulo(value, period) {
    return ((value % period) + period) % period;
  }

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  // Elapsed daily-mode seconds → whole sim minutes since day 1, 00:00.
  function totalMinutes(elapsedSeconds, secondsPerMinute) {
    var spm = secondsPerMinute || SECONDS_PER_SIM_MINUTE;
    return Math.floor(Math.max(0, elapsedSeconds) / spm);
  }

  function minuteOfDay(elapsedSeconds, secondsPerMinute) {
    return modulo(totalMinutes(elapsedSeconds, secondsPerMinute), MINUTES_PER_DAY);
  }

  // 1-based day counter; day 1 starts at 00:00 of daily mode.
  function dayIndex(elapsedSeconds, secondsPerMinute) {
    return Math.floor(totalMinutes(elapsedSeconds, secondsPerMinute) / MINUTES_PER_DAY) + 1;
  }

  function format(minute) {
    var m = modulo(Math.floor(minute), MINUTES_PER_DAY);
    var h = Math.floor(m / 60);
    var r = m % 60;
    return (h < 10 ? '0' : '') + h + ':' + (r < 10 ? '0' : '') + r;
  }

  // Daylight factor 0..1 for §5.4: dark below `dawn`, ramping to 1 by 07:00,
  // fading from 18:30 to complete darkness at 19:30. Pure function of the minute.
  function daylight(minute) {
    var m = modulo(minute, MINUTES_PER_DAY);
    if (m < SUNRISE || m >= NIGHT_START) return 0;
    if (m < ANCHORS.commute) return (m - SUNRISE) / (ANCHORS.commute - SUNRISE);
    if (m < DUSK_START) return 1;
    return 1 - (m - DUSK_START) / (NIGHT_START - DUSK_START);
  }

  function isNight(minute) {
    var m = modulo(minute, MINUTES_PER_DAY);
    return m >= LAMP_ON || m < LAMP_OFF;
  }

  // Three 8h shifts for rotating staff (§6.2): early 08–16, mid 16–24, night 00–08.
  var SHIFTS = [
    { start: 480, end: 960 },
    { start: 960, end: 1440 },
    { start: 0, end: 480 }
  ];

  function shiftWindow(index) {
    return SHIFTS[clamp(Math.floor(index) || 0, 0, SHIFTS.length - 1)];
  }

  /* The week (§4.4.2). Day 1 is a Monday, so the five days the tests and the first cut
   * of the film use are all weekdays and nothing about them changes; day 6 is Saturday
   * and day 7 Sunday. `dayType` is a pure function of the day number — no state, no
   * clock reading — so a snapshot keyed on (seed, day) still replays exactly, and a
   * Sunday rendered on Tuesday is the same Sunday.
   *
   * Why the town needs this at all: before it, every day was a working day, so the
   * street curve had one shape and the film had no way to show a place that rests. A
   * weekend is also the only honest reason for a building to be both shut and still
   * lit — the duty room. */
  var DAYS_PER_WEEK = 7;
  var DAY_TYPES = ['weekday', 'saturday', 'sunday'];

  // 0 = Monday … 6 = Sunday, matching the Chinese convention the film narrates in.
  function dow(day) {
    return modulo((day || 1) - 1, DAYS_PER_WEEK);
  }

  function dayType(day) {
    var d = dow(day);
    return d >= 5 ? DAY_TYPES[d - 4] : DAY_TYPES[0];
  }

  function isWeekend(day) {
    return dow(day) >= 5;
  }

  // Which week of the run this day falls in, so a duty roster can rotate instead of
  // sending the same fifteen people to work seven days a week forever.
  function weekIndex(day) {
    return Math.floor(((day || 1) - 1) / DAYS_PER_WEEK);
  }

  return {
    MINUTES_PER_DAY: MINUTES_PER_DAY,
    SECONDS_PER_SIM_MINUTE: SECONDS_PER_SIM_MINUTE,
    ANCHORS: ANCHORS,
    SHIFTS: SHIFTS,
    DAYS_PER_WEEK: DAYS_PER_WEEK,
    DAY_TYPES: DAY_TYPES,
    totalMinutes: totalMinutes,
    minuteOfDay: minuteOfDay,
    dayIndex: dayIndex,
    format: format,
    daylight: daylight,
    isNight: isNight,
    shiftWindow: shiftWindow,
    dow: dow,
    dayType: dayType,
    isWeekend: isWeekend,
    weekIndex: weekIndex,
    modulo: modulo
  };
});
