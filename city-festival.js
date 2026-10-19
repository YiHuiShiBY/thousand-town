/* 国庆换装层 · 布置度计算。
 *
 * 纯计算模块：不 import 任何渲染，不产生任何 Plan，不读任何居民状态。
 * 它只回答一个问题——今天这个小镇该布置到什么程度（level 0..1）。
 *
 * 2026-09-28 用户拍板两条：
 *   1. 装饰层与居民系统**完全解耦**。`dayType(day)` 是被 23 套日程模板、
 *      值班花名册和休闲席位发号同时消费的纯函数，给它加一档 'national'
 *      等于全镇重排座（AGENTS.md §6 第 1 条）。所以本模块**不碰 dayType**，
 *      不碰容量，不碰 Plan——§4.4.2 周表 / 31 栋台账 / 年龄段三张表不受影响。
 *   2. 真实日历驱动，另给手动锁定开关。
 *
 * 2026-10-09 用户拍板：取消节日概念，装饰全量并入日常（sketch.js 的
 * resolveFestival 恒定 level 1）。本模块的日历/锁定路径不再驱动页面，
 * 但 REST 常态色与 axisColor 梯度仍被 city-ground 的换装层消费，
 * 纯函数与其测试原样保留，留给「换一份窗口表」的将来复用。
 *
 * 形状上照抄 daily-clock.js 的 UMD + globalThis，好让 Node 套件不需要浏览器。
 */
(function (root) {
  'use strict';

  // 布置窗口（真实日历，月-日）。节前 1 天开始爬升，节后 2 天回落。
  // 国庆按 10-01 计；若逐年改期，改这一个表即可，不要散落到调用点。
  var WINDOWS = [
    { from: [9, 30], to: [10, 3], peak: [10, 1], name: 'national-day' }
  ];

  // level 0..1 的三段形状：爬升 / 平台 / 回落。纯查表，不含日期算术以外的分支。
  var RAMP_IN = 3;   // 从 0 涨到 1 用几天（含端点）
  var RAMP_OUT = 5;  // 从 1 落回 0 用几天
  // 窗口头日的起跳高度。不是 0：节前 1 天就要看见开始布置，
  // 0 意味着"节前一天和平时一模一样"，爬升段的头一格等于不存在。
  var START_LEVEL = 0.35;

  /* 日期一律编成**年内序号**（1..366），而不是 month*100+day。
   * 后者在年界不连续：12-31 编成 1231，第二天却是 101 而不是 1232 ——
   * 于是任何跨年的距离算术（"离峰值几天"）都会算出一个巨大的假距离，
   * 跨年窗口的 1 月段恒为 0。年内序号 + 循环距离是唯一自洽的编法。
   * 代价是不带年份；本项目按「每年同一个节」使用，正合适。 */
  var MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var YEAR_DAYS = 365;
  function leapYear(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
  function daysInMonth(month, year) {
    return (month === 2 && year != null && leapYear(year)) ? 29 : MONTH_DAYS[month - 1];
  }
  function toOrdinal(month, day, year) {
    var n = day;
    for (var m = 1; m < month; m++) n += daysInMonth(m, year);
    return n;
  }
  function toDayNumber(month, day) { return month * 100 + day; }

  /* 从 from 出发、沿年循环向前到 to 的距离。跨年自动成立，无需特判。 */
  function cycDist(from, to, span) {
    var d = (to - from) % span;
    return d < 0 ? d + span : d;
  }

  function monthDayOf(value) {
    // 接受 Date / 'YYYY-MM-DD' / {month, day} / [m, d]，统一成 {month, day}。
    if (value == null) return null;
    if (typeof value.getMonth === 'function') {
      return { month: value.getMonth() + 1, day: value.getDate() };
    }
    if (Array.isArray(value) && value.length >= 2) {
      return { month: Number(value[0]), day: Number(value[1]) };
    }
    if (typeof value === 'object' && value.month != null && value.day != null) {
      return { month: Number(value.month), day: Number(value.day) };
    }
    if (typeof value === 'string') {
      var parts = value.split('-');
      if (parts.length >= 2) {
        var m = Number(parts[1]), d = Number(parts[2]);
        if (m > 0 && d > 0) return { month: m, day: d };
      }
    }
    return null;
  }

  // 跨年安全：把窗口展开成有序的 [起, 峰, 止] 日序链，再算距离。
  // 不直接做 10301 - 931 那种算术，否则年末会得到负数。
  // 注意：跨年时**峰也要跟着进位**。只把 to 挪走而留下 peak < from，
  // 会让整条链恒不满足 —— 跨年窗口永远算不出任何 level（这就是那次红灯的成因）。
  function chainFor(window) {
    var year = window.year;
    var from = toOrdinal(window.from[0], window.from[1], year);
    var peak = toOrdinal(window.peak[0], window.peak[1], year);
    var to = toOrdinal(window.to[0], window.to[1], year);
    var span = year != null && leapYear(year) ? 366 : YEAR_DAYS;
    return { from: from, peak: peak, to: to, span: span };
  }

  function levelForDate(input) {
    var md = monthDayOf(input);
    if (!md) return 0;
    var year = (input && typeof input.getFullYear === 'function') ? input.getFullYear() : null;
    var today = toOrdinal(md.month, md.day, year);

    var best = 0;
    for (var i = 0; i < WINDOWS.length; i++) {
      best = Math.max(best, shape(today, chainFor(WINDOWS[i])));
    }
    return best;
  }

  /* 沿年内序号弧线求 level：先算「距窗口头几天」，超出弧长就是窗口外，
   * 再按位于峰值前/后分别走上升段与回落段。全程只做环上的加减，
   * 跨年自然成立——不再有"12 月往 1 月"那种手工补 10000 的分支。 */
  function shape(today, chain) {
    var span = chain.span;
    var head = cycDist(chain.from, today, span);
    var arc = cycDist(chain.from, chain.to, span);
    if (head > arc) return 0;

    var peakHead = cycDist(chain.from, chain.peak, span);
    if (head === peakHead) return 1;
    if (head < peakHead) {
      var up = START_LEVEL + (1 - START_LEVEL) * (head / Math.max(1, peakHead));
      return clamp01(up);
    }
    var down = 1 - (head - peakHead) / Math.max(1, RAMP_OUT);
    return clamp01(down);
  }

  function clamp01(n) { return n < 0 ? 0 : (n > 1 ? 1 : n); }

  /* 窗口里最长可能停留的天数，用来给 caller 一个"要不要开始建批"的判断。
   * 窗口外返回 0，调用方据此**完全不建装饰批**，而不是建了藏起来——
   * 这样常态画面与今天逐像素一致（设计稿 §5 的验收线）。 */
  function isInWindow(input) { return levelForDate(input) > 0; }

  /* 手动锁定。URL 上的 ?fest=1 压过日历，出片与评审不受系统日期影响。
   * 返回 {level, source}：source 告诉 caller 这值是日历算的还是人锁的，
   * 免得两个来源打架时看不出是哪来的。 */
  function resolve(options) {
    var opts = options || {};
    if (opts.lock != null) {
      var locked = Number(opts.lock);
      if (isFinite(locked)) {
        return { level: clamp01(locked), source: 'lock', name: null };
      }
    }
    var date = opts.date != null ? opts.date : new Date();
    return { level: levelForDate(date), source: 'calendar', name: activeName(date) };
  }

  function activeName(input) {
    var md = monthDayOf(input);
    if (!md) return null;
    var year = (input && typeof input.getFullYear === 'function') ? input.getFullYear() : null;
    var today = toOrdinal(md.month, md.day, year);
    for (var i = 0; i < WINDOWS.length; i++) {
      var c = chainFor(WINDOWS[i]);
      if (cycDist(c.from, today, c.span) <= cycDist(c.from, c.to, c.span)) return WINDOWS[i].name;
    }
    return null;
  }

  /* 花瓣沿中轴的颜色梯度（设计稿 §4「花」层）。
   * t 是沿轴的归一化位置 [-1, 1]：-1 是一端，+1 是另一端，中轴为 0。
   * 返回 [r, g, b]，0..1。调用方直接喂 setColorAt，不新增任何实例批。
   * 梯度是有意的：全场一个红才是一眼假，渐变才经得起看。 */
  var GRADIENT = [
    [0.86, 0.62, 0.24],  // 麦金（两端）
    [0.88, 0.44, 0.22],  // 橙红
    [0.76, 0.14, 0.13]   // 国红（中轴）
  ];
  function axisColor(t) {
    // NaN 与非数一律归零（中轴最红），不能让它进 Math.floor——索引越界会抛。
    var u = Number(t);
    if (!isFinite(u)) u = 0;
    if (u > 1) u = 1; else if (u < -1) u = -1;
    // |u| 驱动梯度：越靠中轴越红，t 的符号只表示"哪一端"，不改变颜色。
    // 早先写成 (1+u)/2，把 -1 映到 0、+1 映到 1，方向整个反了 ——
    // 中轴拿到橙红、两端拿到国红，正好与设计稿相反。
    var k = (1 - Math.abs(u)) * (GRADIENT.length - 1);
    var lo = Math.floor(k), hi = Math.min(GRADIENT.length - 1, lo + 1), f = k - lo;
    var a = GRADIENT[lo], b = GRADIENT[hi];
    return [
      a[0] + (b[0] - a[0]) * f,
      a[1] + (b[1] - a[1]) * f,
      a[2] + (b[2] - a[2]) * f
    ];
  }

  /* 常态色。level=0 时 caller 必须用它，否则花瓣批会从米白跳到暖金——
   * 那会让"关掉装饰等于没改过"这条验收线直接失效。 */
  var REST = { warm: ['#eee9d7', '#e8e2c8', '#f2eddf'], cool: ['#c8cf8a', '#d3d499', '#e5dfba'] };

  var api = {
    WINDOWS: WINDOWS,
    RAMP_IN: RAMP_IN,
    RAMP_OUT: RAMP_OUT,
    REST: REST,
    levelForDate: levelForDate,
    isInWindow: isInWindow,
    resolve: resolve,
    activeName: activeName,
    axisColor: axisColor,
    monthDayOf: monthDayOf
  };

  root.CityFestival = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
