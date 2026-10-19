/* 国庆氛围模块 · 喷泉编排层（纯计算，零渲染）。
 *
 * 与 city-festival.js 的分工：那一层回答「今天布置到什么程度」（level 0..1），
 * 本模块回答「喷泉这一刻该喷成什么样」。所以本模块不读日历、不读 CityFestival，
 * 只吃一个已有的 level —— 谁调用、什么时候调用，是接线阶段的事。
 *
 * 两条纪律，改动前先读：
 *
 * 1. **常设景观，不是节庆挂件**。喷泉和纪念碑、游乐场是同一类东西：关掉它，
 *    小镇仍然是那个小镇，只是广场空了一块。它每天按时刻表放节目，国庆只是
 *    曲目升级。所以它没有「窗口外不渲染」这条验收线——那是 city-festival.js
 *    那层装饰才需要（设计稿 §5 的逐像素一致线管的是花/旗/灯笼，不是这里）。
 *    真正被这条线管住的是 fireworks：level=0 时它一颗粒子都不产生。
 *
 * 2. **只存偏移，不存坐标**。本模块所有输出都是**相对广场 site 原点**的局部偏移，
 *    落地由 siteGroup 的 position 完成。绝不存绝对世界坐标——AGENTS.md §5 那条
 *    「诊所的数据站在夜市里」的教训，对本模块同样成立：场地一旦搬家，存了绝对
 *    坐标的水柱会留在原地。
 *
 * 输出形状与 city-ground.js 的 batch() items 严格同构
 * （[x, y, z, sx, sy, sz, rotY, tint]），所以接线阶段不需要任何形变层。
 *
 * 运动全部是绝对时间的纯函数：暂停、拖拽时间轴、导出序列都能逐帧复现。
 */
(function (root) {
  'use strict';

  var TAU = Math.PI * 2;

  function clamp01(v) {
    if (!isFinite(v)) return 0;
    return v < 0 ? 0 : (v > 1 ? 1 : v);
  }

  /* 确定性随机源。不用 Math.random：同 seed 必须给出同一套舞，
   * 否则截图对比、视觉回归和「暂停后拖回去」全都会漂。
   * 与仓库其余模块同源（city-random.js），Node 与浏览器两条路径都能拿到。 */
  function randomGenerator(seed) {
    if (typeof CityRandom === 'object' && CityRandom && CityRandom.randomGenerator) {
      return CityRandom.randomGenerator(seed);
    }
    if (typeof require === 'function') {
      try { return require('./city-random.js').randomGenerator(seed); } catch (e) { /* 纯浏览器 */ }
    }
    // 兜底：mulberry32。与 CityRandom 数值不同，但仍然是确定性的，
    // 只在两个源都拿不到的极端环境（内联 <script> 且无 require）生效。
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------------------------------------------------------- 池体
   * 落位依据是广场实测几何（city-landmarks.js monumentPlaza），不是估的：
   *   碑座   box(pale, 0, .54, 0, 11.4, .5, 11.4)   → 半宽 5.7，外接半径 8.06
   *   同心环 ring(stone, 11.8) / ring(stone, 17.75) → 广场自有铺装环
   *   铺装面 ring(pale, 0, 18.25, .281)            → 地面在 y ≈ .28
   * 内沿取 11.8 是因为它已经是一道既有石环，池壁压在它上面不新增任何缝；
   * 碑座（外接 8.06）与池壁之间留 3.7 的干地，站着看得到碑。
   * 外沿取 14.6 而不是 17.75，是要让 17.75 那道石环留在池外当池边压条——
   * 环池宽 2.8 是真实市政喷泉的常见尺度，压到最外环会让广场少一圈装饰。
   */
  var BASIN = {
    inner: 11.8,
    outer: 14.6,
    floorY: 0.30,      // 池底，贴着铺装面
    surfaceY: 0.46,   // 水面：高出铺装 .18，形成可见的池壁
    wallY: 0.30,       // 池壁高
    segments: 64       // 环池分段。64 段 × 2 面 = 256 tri，环看上去仍然是圆的。
  };

  /* 喷口留在实际水域中：截面与散滴落点都不能越过内外池壁。
   * 两圈共 28 个喷口。columns 仍保留 100 个相接的分段给旧接线使用；
   * 新接线使用 jets 的连续水束，再叠加独立的飞升/回落散滴。 */
  var RINGS = [
    { radius: 12.65, count: 16, segmentsPerColumn: 4, baseHeight: 8.4, spread: 0.28, tier: 'main' },
    { radius: 13.75, count: 12, segmentsPerColumn: 3, baseHeight: 4.3, spread: 0.34, tier: 'low' }
  ];

  /* 每日节目表（当日分钟，0..1440）。
   * 依据小镇作息而不是凭空排：居民 22:00 睡（daily-clock ANCHORS.sleep=1320），
   * 所以高潮必须在 21:30 前收干净，否则夜里还喷水喷到���点就是「一眼假」。
   * 高潮窗口刻意与烟花秀（19:30–21:10）重叠——地面水幕 + 空中烟花是同一个高潮，
   * 两层错开反而像两个不相干的功能。 */
  var PROGRAM = [
    { from: 330, to: 420, level: 0.35, name: 'dawn' },        // 05:30 晨起，低而柔
    { from: 420, to: 1080, level: 0.45, name: 'daytime' },   // 白天维持，路过能看
    { from: 1080, to: 1110, level: 0.6, name: 'dusk-ramp' },  // 18:00 起势
    { from: 1110, to: 1140, level: 0.9, name: 'ramp-up' },    // 灯亮同时拉满
    { from: 1140, to: 1270, level: 1.0, name: 'show' },       // 19:00–21:10 高潮
    { from: 1270, to: 1320, level: 0.55, name: 'wind-down' }, // 21:10 起收
    { from: 1320, to: 1440, level: 0.0, name: 'off' },        // 22:00 停泵
    { from: 0, to: 330, level: 0.0, name: 'off' }
  ];

  /* 一天的强度包络。跨 0 点的那两段靠取模接上，
   * 所以调用方传 1439 与传 0 得到的是连续的曲线，不是断崖。 */
  function dayLevel(minute) {
    var m = ((Math.floor(minute) % 1440) + 1440) % 1440;
    for (var i = 0; i < PROGRAM.length; i++) {
      var p = PROGRAM[i];
      if (m >= p.from && m < p.to) return p.level;
    }
    return 0;
  }

  /* 节目边界左右各六分钟平滑过渡；停泵仍在 22:00 准时归零。
   * 直接遍历真实节目边界，保留小数分钟。按整数分钟搜索会让每一秒的
   * 连续时间在整分处断开，1270 分曾因此让柱顶突然掉下 0.57 米。 */
  var SMOOTH_WINDOW = 6;
  function dayLevelSmooth(minute) {
    var base = dayLevel(minute);
    if (base <= 0) return 0;
    var m = mod1440(minute);
    for (var i = 0; i < PROGRAM.length; i++) {
      var boundary = PROGRAM[i].from;
      var before = dayLevel(boundary - 1);
      var after = PROGRAM[i].level;
      if (before <= 0 || after <= 0 || before === after) continue;
      var distance = mod1440(m - boundary + 720) - 720;
      if (Math.abs(distance) >= SMOOTH_WINDOW) continue;
      var t = (distance + SMOOTH_WINDOW) / (2 * SMOOTH_WINDOW);
      return before + (after - before) * t;
    }
    return base;
  }

  function mod1440(v) { return ((v % 1440) + 1440) % 1440; }

  /* 相位沿环池推进，一圈中同时有抬升与回落的喷口。
   * 时间明确用绝对秒；三组缓慢呼吸叠加，避免过去数十分钟才动一轮，
   * 也避免全部水柱机械地齐升齐落。 */
  function wave(seconds, phase) {
    return 0.68
      + 0.17 * Math.sin(seconds * TAU / 9.8 - phase * 2)
      + 0.09 * Math.sin(seconds * TAU / 15.2 + phase)
      + 0.06 * Math.sin(seconds * TAU / 4.8 - phase * 3);
  }

  function jetHeight(ring, index, seconds, level, festival) {
    return ring.baseHeight * (1 + ring.heightVar[index])
      * wave(seconds, ring.phase[index]) * level * (1 + festival * 0.18);
  }

  function smooth01(value) {
    var t = clamp01(value);
    return t * t * (3 - 2 * t);
  }

  /* 旧 batch 接口仍是 100 行；分段首尾相接，不再留机械的等距空隙。 */
  function appendColumns(columns, ring, jet, angle) {
    var segments = ring.segmentsPerColumn;
    var height = jet.height / segments;
    for (var s = 0; s < segments; s++) {
      var ratio = (s + 1) / segments;
      var width = jet.radius * 2 * (1 - 0.3 * ratio);
      columns.push([
        jet.x, BASIN.surfaceY + height * (s + 0.5), jet.z,
        width, height, width, angle, jet.tint
      ]);
    }
  }

  /* 每滴只由绝对时间和固定发射参数求出，缓存中没有运动状态。
   * 轨迹从水面上升后落回环池；落点偏移限在池宽中。出生/消亡时先
   * 缩到不可见再换周期，不能让看得见的水珠瞬移回喷口。
   * 飞行高度取发射时刻的柱高，因此正在飞的水滴不会随泵压突然伸缩。 */
  function appendDroplets(droplets, ring, index, jet, angle, seconds, festival) {
    var drops = ring.drops[index];
    var radialX = Math.sin(angle), radialZ = Math.cos(angle);
    for (var i = 0; i < drops.length; i++) {
      var drop = drops[i];
      var clock = seconds / drop.lifetime + drop.phase;
      var cycle = Math.floor(clock);
      var progress = clock - cycle;
      var born = (cycle - drop.phase) * drop.lifetime;
      var launchLevel = dayLevelSmooth(born / 60);
      var apex = jetHeight(ring, index, born, launchLevel, festival);
      var rise = 4 * progress * (1 - progress);
      var spread = progress * progress * (3 - 2 * progress);
      var sideways = Math.sin(progress * Math.PI * 0.5);
      var visibility = smooth01(progress / 0.1) * smooth01((1 - progress) / 0.16);
      var size = Math.max(0.00001, drop.size * visibility * Math.min(1, launchLevel * 2));
      droplets.push([
        jet.x + radialX * drop.drift * spread + radialZ * drop.tangent * sideways,
        BASIN.surfaceY + apex * rise,
        jet.z + radialZ * drop.drift * spread - radialX * drop.tangent * sideways,
        size, size * (1.55 + 0.7 * Math.abs(1 - 2 * progress)), size,
        angle, 0.84 + 0.14 * Math.sin(progress * Math.PI)
      ]);
    }
  }

  /* 两枚错开的细涟漪，半径包含在水面里。透明度在重生前后均为零。 */
  function appendRipples(ripples, ring, index, jet, angle, seconds, level) {
    for (var r = 0; r < 2; r++) {
      var clock = seconds / (1.6 + index * 0.013) + r * 0.5 + ring.phase[index] / TAU;
      var progress = clock - Math.floor(clock);
      var radial = r === 0 ? 0.12 : -0.12;
      ripples.push({
        x: jet.x + Math.sin(angle) * radial,
        z: jet.z + Math.cos(angle) * radial,
        radius: 0.06 + 0.35 * progress,
        opacity: 0.22 * level * smooth01(progress / 0.12) * (1 - progress) * (1 - progress)
      });
    }
  }

  /* 编排主入口。minute 允许跨日与小数；所有动态物按 minute * 60 求值。
   * jets: {x,z,height,radius,tint}，底部固定 BASIN.surfaceY。
   * droplets / columns: [x,y,z,sx,sy,sz,rotY,tint]，最多 336 / 100 行。
   * ripples: {x,z,radius,opacity}，最多 56 枚，位于 BASIN.surfaceY。
   * 全部坐标均是相对广场 site 的局部偏移。 */
  function choreography(minute, opts) {
    var options = opts || {};
    var seed = options.seed == null ? 20260818 : options.seed;
    var festival = clamp01(options.festival);
    var level = dayLevelSmooth(minute);
    var name = programName(minute);
    var columns = [], jets = [], droplets = [], ripples = [];
    var basin = {
      inner: BASIN.inner,
      outer: BASIN.outer,
      floorY: BASIN.floorY,
      surfaceY: BASIN.surfaceY,
      segments: BASIN.segments,
      level: level
    };
    var result = {
      basin: basin, columns: columns, jets: jets, droplets: droplets, ripples: ripples,
      level: level, festival: festival, name: name
    };
    // 水池是常建设施；停泵时所有动态物直接清空。
    if (level <= 0.001) return result;

    var seconds = minute * 60;
    var rings = buildRings(seed);
    for (var r = 0; r < rings.length; r++) {
      var ring = rings[r];
      for (var i = 0; i < ring.count; i++) {
        var angle = (i / ring.count) * TAU + ring.offset;
        var radius = ring.radius + ring.wobble[i];
        var jet = {
          x: Math.sin(angle) * radius,
          z: Math.cos(angle) * radius,
          height: jetHeight(ring, i, seconds, level, festival),
          radius: (ring.tier === 'main' ? 0.105 : 0.08) * (0.85 + 0.15 * level),
          tint: ring.tier === 'main' ? 0.96 : 0.90
        };
        jets.push(jet);
        appendColumns(columns, ring, jet, angle);
        appendDroplets(droplets, ring, i, jet, angle, seconds, festival);
        appendRipples(ripples, ring, i, jet, angle, seconds, level);
      }
    }
    return result;
  }

  function programName(minute) {
    var m = ((Math.floor(minute) % 1440) + 1440) % 1440;
    for (var i = 0; i < PROGRAM.length; i++) {
      var p = PROGRAM[i];
      if (m >= p.from && m < p.to) return p.name;
    }
    return 'off';
  }

  /* seed 缓存只保存喷口与发射参数，不保存任何随帧改变的状态。 */
  var ringCache = Object.create(null);
  function buildRings(seed) {
    if (ringCache[seed]) return ringCache[seed];
    var rand = randomGenerator((seed ^ 0x504F4E54) >>> 0);
    var rings = [];
    for (var i = 0; i < RINGS.length; i++) {
      var def = RINGS[i];
      var ring = {
        radius: def.radius,
        count: def.count,
        segmentsPerColumn: def.segmentsPerColumn,
        baseHeight: def.baseHeight,
        tier: def.tier,
        phase: [], heightVar: [], wobble: [], drops: []
      };
      for (var k = 0; k < def.count; k++) {
        ring.phase.push((k / def.count) * TAU + (rand() - 0.5) * 0.22);
        ring.heightVar.push((rand() - 0.5) * 0.14);
        ring.wobble.push((rand() - 0.5) * def.spread * 0.42);
        var drops = [];
        for (var d = 0; d < 12; d++) {
          drops.push({
            phase: d / 12 + rand() * 0.045,
            lifetime: (def.tier === 'main' ? 2.5 : 1.9) + rand() * 0.25,
            drift: (rand() - 0.5) * (def.tier === 'main' ? 0.78 : 0.62),
            tangent: (rand() - 0.5) * 0.32,
            size: 0.033 + rand() * 0.026
          });
        }
        ring.drops.push(drops);
      }
      ring.offset = rand() * TAU;
      rings.push(ring);
    }
    ringCache[seed] = rings;
    return rings;
  }

  /* 水面在夜里该有的反射色。接线条用它在 MeshStandardMaterial 的
   * color 与 emissive 之间取值，省得把「夜里水该多暗」这件事写死在渲染层。 */
  function surfaceTint(level, daylight, festival) {
    var night = 1 - clamp01(daylight);
    var warm = clamp01(festival);
    return {
      // 白天的水是天空的反照（偏冷），夜里是岸上灯火的反照（偏暖）
      r: 0.30 + 0.55 * night * (0.4 + 0.6 * warm),
      g: 0.42 + 0.42 * night * (0.3 + 0.5 * warm),
      b: 0.52 + 0.20 * night * (0.2 - 0.1 * warm),
      emissive: clamp01(night * (0.16 + 0.34 * level * (0.5 + 0.5 * warm)))
    };
  }

  /* Canvas 降级路径。city-light.js 那条 2D 栈没有 InstancedMesh，
   * 但「切渲染模式发现喷泉消失」是最伤的一种穿帮，所以这里给一条
   * 同样由 level 驱动的降级描述——不是同一套绘制，是同一份编排的 2D 投影。
   * 返回每一段的 {x, y, thickness, height, tint}，画法由接线层决定。 */
  function choreography2d(minute, opts) {
    var full = choreography(minute, opts);
    var columns = [];
    for (var i = 0; i < full.columns.length; i++) {
      var c = full.columns[i];
      columns.push({ x: c[0], z: c[2], y: c[1], thickness: c[3], height: c[4], tint: c[7] });
    }
    return {
      basin: full.basin,
      columns: columns,
      jets: full.jets,
      droplets: full.droplets,
      ripples: full.ripples,
      level: full.level,
      festival: full.festival,
      name: full.name
    };
  }

  /* 渠心专用预览：保留小镇十边石盆和七只既有铜喷口。这里没有广场坐标、
   * 材质或新几何；全部水流复用 city-ground 的 unit-sphere 实例批次。
   * seconds 是播放秒数，minute 只控制每日泵压，不能把小镇 96 倍时钟乘进来。
   * items: [x,y,z,sx,sy,sz,dx,dy,dz]；s 是球的半轴，d 是长轴单位方向。 */
  var CANAL = { innerRadius: 4.325, outerRadius: 4.9, surfaceY: -.55, capacity: 256 };
  var canalCache = Object.create(null);
  function canalPattern(seed) {
    if (canalCache[seed]) return canalCache[seed];
    var rand = randomGenerator((seed ^ 0x3AF7A1C6) >>> 0), nozzles = [];
    for (var n = 0; n < 7; n++) {
      var angle = (n - 1) * TAU / 6;
      var nozzle = { x: n ? 1.35 * Math.cos(angle) : 0, y: n ? 1.5 : 1.62,
        z: n ? 1.35 * Math.sin(angle) : 0, angle: angle, phase: rand() * TAU, drops: [] };
      for (var d = 0; d < 8; d++) nozzle.drops.push({ phase: d / 8 + rand() * .075,
        period: (n ? 1.27 : 2.5) + rand() * .16, radius: .028 + rand() * .018,
        angle: rand() * TAU, drift: .28 + rand() * .38 });
      nozzles.push(nozzle);
    }
    canalCache[seed] = nozzles;
    return nozzles;
  }
  function canalPressure(seconds, phase, level) {
    return (.72 + .28 * level) * (.94 + .035 * Math.sin(seconds * TAU / 9 + phase)
      + .025 * Math.sin(seconds * TAU / 14 - phase));
  }
  function canalPoint(nozzle, u, pressure, main) {
    if (main) return [0, nozzle.y + 6.28 * pressure * u, 0];
    var radius = 1.35 + 2.58 * u;
    return [Math.cos(nozzle.angle) * radius,
      nozzle.y + 4 * 2.35 * pressure * u * (1 - u) + (CANAL.surfaceY - nozzle.y) * u,
      Math.sin(nozzle.angle) * radius];
  }
  function canalItem(point, radius, length, dx, dy, dz) {
    var norm = Math.hypot(dx, dy, dz) || 1;
    return [point[0], point[1], point[2], radius, length, radius, dx / norm, dy / norm, dz / norm];
  }
  function canal(seconds, opts) {
    var options = opts || {}, seed = options.seed == null ? 20260818 : options.seed;
    var t = Number.isFinite(seconds) ? seconds : 0;
    var level = dayLevelSmooth(options.minute == null ? 720 : options.minute);
    var pattern = canalPattern(seed), items = [], streams = 0, droplets = [];
    var result = { items: items, nozzles: pattern.map(function (n) { return { x: n.x, y: n.y, z: n.z }; }),
      streams: 0, droplets: 0, level: level,
      basin: { innerRadius: CANAL.innerRadius, outerRadius: CANAL.outerRadius, surfaceY: CANAL.surfaceY } };
    if (level <= .001) return result;
    for (var n = 0; n < pattern.length; n++) {
      var nozzle = pattern[n], main = n === 0, pressure = canalPressure(t, nozzle.phase, level);
      var count = main ? 26 : 24;
      // 相接椭球沿细水束排布；保留一条连续流，不再让大球像珠链一样跳动。
      for (var s = 0; s < count; s++) {
        var start = canalPoint(nozzle, s / count, pressure, main);
        var end = canalPoint(nozzle, (s + 1) / count, pressure, main);
        var dx = end[0] - start[0], dy = end[1] - start[1], dz = end[2] - start[2];
        var center = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2];
        var width = (main ? .095 : .064) * (1 - .28 * (s + .5) / count);
        items.push(canalItem(center, width, Math.max(width, Math.hypot(dx, dy, dz) * .58), dx, dy, dz));
        streams++;
      }
      for (var d = 0; d < nozzle.drops.length; d++) {
        var drop = nozzle.drops[d], clock = t / drop.period + drop.phase;
        var cycle = Math.floor(clock), progress = clock - cycle, born = (cycle - drop.phase) * drop.period;
        var bornPressure = canalPressure(born, nozzle.phase, level);
        var fade = smooth01(progress / .09) * smooth01((1 - progress) / .15);
        var size = Math.max(.000001, drop.radius * fade);
        var point, vx, vy, vz;
        if (main) {
          // 起点是原喷口，终点是河面；稍向外落散，缩隐后才重生。
          var bend = Math.sin(progress * Math.PI / 2), drift = drop.drift * bend;
          point = [Math.cos(drop.angle) * drift,
            nozzle.y + 4 * 6.28 * bornPressure * progress * (1 - progress)
              + (CANAL.surfaceY - nozzle.y) * progress,
            Math.sin(drop.angle) * drift];
          vx = Math.cos(drop.angle) * drop.drift * Math.PI / 2 * Math.cos(progress * Math.PI / 2);
          vy = 4 * 6.28 * bornPressure * (1 - 2 * progress) + CANAL.surfaceY - nozzle.y;
          vz = Math.sin(drop.angle) * drop.drift * Math.PI / 2 * Math.cos(progress * Math.PI / 2);
        } else {
          point = canalPoint(nozzle, progress, bornPressure, false);
          vx = Math.cos(nozzle.angle) * 2.58;
          vy = 4 * 2.35 * bornPressure * (1 - 2 * progress) + CANAL.surfaceY - nozzle.y;
          vz = Math.sin(nozzle.angle) * 2.58;
          // 散滴离开流束后再回到盆内，不把单根侧喷变成粗水管。
          var scatter = Math.sin(progress * Math.PI) * .15 * Math.sin(drop.angle);
          point[0] += -Math.sin(nozzle.angle) * scatter;
          point[2] += Math.cos(nozzle.angle) * scatter;
        }
        droplets.push(canalItem(point, size, size * 1.8, vx, vy, vz));
      }
    }
    result.streams = streams; result.droplets = droplets.length;
    Array.prototype.push.apply(items, droplets);
    return result;
  }

  /* 外圈音乐喷泉。48 秒 = 80 BPM 的 16 小节，音谱与水型共用这一个秒钟。
   * 只输出渠心偏移，中央 canal()、原石盆、七只喷口和默认主城不参与此编排。
   * 16 喷口 × (14 连续段 + 2 散滴) = 256，仍沿用 unit-sphere 九字段契约。 */
  var MUSIC = { bpm: 80, beatSeconds: .75, duration: 48, capacity: 256,
    sections: [
      { from: 0, to: 12, name: 'awakening', label: '苏醒' },
      { from: 12, to: 24, name: 'response', label: '呼应' },
      { from: 24, to: 36, name: 'chase', label: '追逐' },
      { from: 36, to: 48, name: 'ensemble', label: '合奏收尾' }
    ] };
  function musicTime(seconds) {
    var t = Number.isFinite(seconds) ? seconds : 0;
    return ((t % MUSIC.duration) + MUSIC.duration) % MUSIC.duration;
  }
  function musicHeight(section, index, seconds) {
    var angle = index * TAU / 16, beat = seconds / MUSIC.beatSeconds - .25;
    var accent = .82 + .18 * Math.cos(beat * TAU);
    if (section === 0) return .7 + .85 * (.55 + .25 * Math.sin(seconds * TAU / 6)
      + .2 * Math.cos(angle * 2 - seconds * TAU / 12));
    if (section === 1) return .48 + 3.8 * Math.pow(.5 + .5 * Math.cos(angle * 2 - seconds * TAU / 6), 4) * accent;
    if (section === 2) return .4 + 4.8 * Math.pow(.5 + .5 * Math.cos(angle - seconds * TAU / 6), 10) * accent;
    var phrase = .58 + .42 * Math.cos(beat * TAU / 4 - angle * .25);
    return index % 2 ? .75 + 1.9 * phrase : 1.4 + 4.1 * phrase;
  }
  function musicCrest(index, seconds) {
    var section = Math.min(3, Math.floor(seconds / 12));
    var height = musicHeight(section, index, seconds);
    // 每个新乐段用 0.9 秒接住前段的水型，不能在小节线切换整个喷口位置。
    if (section > 0 && seconds - section * 12 < .9) {
      var blend = smooth01((seconds - section * 12) / .9);
      height = musicHeight(section - 1, index, seconds) * (1 - blend) + height * blend;
    }
    return height;
  }
  function musicPoint(index, progress, crest) {
    var angle = index * TAU / 16;
    var radius = 8 + (index % 2 ? -1.25 : 1.25) * progress;
    return [Math.cos(angle) * radius, -.55 + 4 * crest * progress * (1 - progress), Math.sin(angle) * radius];
  }
  function musical(seconds, opts) {
    var options = opts || {}, t = musicTime(seconds), beat = t / MUSIC.beatSeconds;
    var section = Math.min(3, Math.floor(t / 12));
    var level = options.minute === undefined ? 1 : dayLevelSmooth(options.minute);
    var envelope = smooth01(t / 1.5) * smooth01((MUSIC.duration - t) / 3) * Math.min(1, level * 2);
    var rand = randomGenerator(((options.seed == null ? 20260818 : options.seed) ^ 0x4D555349) >>> 0);
    var items = [], drops = [], nozzles = [];
    for (var n = 0; n < 16; n++) {
      var angle = n * TAU / 16, crest = musicCrest(n, t) * (.8 + .2 * Math.max(0, level)) * envelope;
      nozzles.push({ x: Math.cos(angle) * 8, y: -.55, z: Math.sin(angle) * 8 });
      for (var s = 0; s < 14; s++) {
        var a = musicPoint(n, s / 14, crest), b = musicPoint(n, (s + 1) / 14, crest);
        var dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
        var width = (.052 - .012 * (s + .5) / 14) * envelope;
        var length = Math.max(.052, Math.hypot(dx, dy, dz) * .58) * envelope;
        items.push(canalItem([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
          Math.max(.000001, width), Math.max(.000001, length), dx, dy, dz));
      }
      for (var d = 0; d < 2; d++) {
        var phase = d * .5 + rand() * .09;
        var period = MUSIC.beatSeconds * 2, clock = t / period + phase;
        var progress = clock - Math.floor(clock);
        var fade = smooth01(progress / .12) * smooth01((1 - progress) / .18) * envelope;
        var radius = Math.max(.000001, (.031 + rand() * .012) * fade);
        var point = musicPoint(n, progress, crest), radial = n % 2 ? -1.25 : 1.25;
        drops.push(canalItem(point, radius, radius * 1.7,
          Math.cos(angle) * radial, 4 * crest * (1 - 2 * progress), Math.sin(angle) * radial));
      }
    }
    Array.prototype.push.apply(items, drops);
    return { items: items, streams: 224, droplets: 32, nozzles: nozzles,
      section: MUSIC.sections[section].name, beat: beat, seconds: t, envelope: envelope };
  }

  /* 原创微缩小镇音谱，无采样文件。C / Am / F / G 四小节循环，五声音阶主旋律。
   * duration 含尾音；播放端直接按 time 调度，不能另用 Date.now 驱动水型。
   * 第 16 小节先保留 G 和声，再轻落 C，所有音尾在 48 秒前消散。 */
  function musicScore() {
    var events = [], roots = [48, 45, 41, 43], thirds = [4, 3, 4, 4];
    var pentatonic = [60, 62, 64, 67, 69, 72, 74, 76];
    var motifs = [[2, 4, 3, 1], [4, 5, 3, 2], [2, 3, 5, 4], [3, 1, 2, 0]];
    function note(time, duration, midi, gain, instrument, pan) {
      events.push({ time: time, duration: duration, midi: midi, gain: gain, instrument: instrument, pan: pan });
    }
    for (var bar = 0; bar < 16; bar++) {
      var section = Math.floor(bar / 4), start = bar * 3 + .1875, root = roots[bar % 4];
      var chord = [root, root + thirds[bar % 4], root + 7];
      var lift = [.68, .82, .94, .82][section];
      for (var c = 0; c < 3; c++) note(start, bar === 15 ? 1.45 : 2.65, chord[c], .036 * lift, 'pad', (c - 1) * .24);
      var pianoBeats = section === 0 ? [0, 2] : section === 1 ? [0, 1.5, 3] : [0, 1, 2, 3];
      if (bar === 15) pianoBeats = [0, 1];
      for (var p = 0; p < pianoBeats.length; p++) note(start + pianoBeats[p] * MUSIC.beatSeconds,
        .8, chord[p % 3] + 12, .105 * lift * (p ? .82 : 1), 'piano', p % 2 ? .18 : -.18);
      var melodyBeats = section === 0 ? [1] : section === 1 ? [1, 3] : section === 2 ? [.5, 1.5, 2.5, 3.5] : [.5, 2, 3];
      if (bar === 15) melodyBeats = [1.5];
      for (var m = 0; m < melodyBeats.length; m++) note(start + melodyBeats[m] * MUSIC.beatSeconds,
        bar === 15 ? 1.5 : .95, bar === 15 ? 72 : pentatonic[motifs[bar % 4][m] + (section === 2 ? 1 : 0)],
        .082 * lift, 'bell', Math.sin((bar + m) * 1.7) * .38);
      if (section > 0 && bar < 15) {
        var pulseBeats = section === 2 ? [0, 1, 2, 3] : [0, 2];
        for (var pulse = 0; pulse < pulseBeats.length; pulse++) note(start + pulseBeats[pulse] * MUSIC.beatSeconds,
          .2, root - (root >= 48 ? 12 : 0), .04 * lift, 'pulse', 0);
      }
    }
    [48, 52, 55].forEach(function (midi, index) { note(46.3125, 1.45, midi, .022, 'pad', (index - 1) * .2); });
    events.sort(function (a, b) { return a.time - b.time; });
    return events;
  }

  var api = {
    MUSIC: MUSIC,
    musical: musical,
    musicScore: musicScore,
    CANAL: CANAL,
    canal: canal,
    BASIN: BASIN,
    RINGS: RINGS,
    PROGRAM: PROGRAM,
    dayLevel: dayLevel,
    dayLevelSmooth: dayLevelSmooth,
    programName: programName,
    choreography: choreography,
    choreography2d: choreography2d,
    surfaceTint: surfaceTint,
    buildRings: buildRings
  };

  root.CityFountain = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
