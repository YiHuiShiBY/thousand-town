/* 国庆氛围模块 · 烟花编排层（纯计算，零渲染）。
 *
 * 与 city-fountain.js 相反，这一层是**纯节庆**的：level = 0 时它一颗粒子都不产生，
 * 接线层也据 isActive() 判定不建 InstancedMesh —— 不是建了藏起来。
 * 那条「关掉装饰，小镇必须还是那个小镇」的逐像素验收线（设计稿 §5）管的就是这里。
 *
 * 物理全部是绝对时间的纯函数：
 *   弹道 = f(seed, 第几发, t - 发射时刻)
 * 没有累加积分、没有状态变量。所以暂停、倒拖时间轴、导出序列、截图对比，
 * 同一时刻永远给出同一帧——这是 AGENTS.md §5「Plan 是纯函数」那条纪律的同源要求，
 * 在渲染层重算日程会在接 LLM 时付出代价，这里的等价物是：渲染层不许驱动烟花。
 *
 * ---------------------------------------------------------------- 颜色为什么多带 3 个分量
 * city-ground.js 的 batch() 把 items 第 8 项 tint 当**灰度调制**用：
 *     color.setRGB(item[7]*.98, item[7], item[7]*.96)
 * 它撑不住逐粒子颜色。烟花的色温信息要逐粒保留（香槟金、暖白与少量冷蓝），
 * 所以本模块的 items 在 batch() 那 8 项之后额外带 [r, g, b]，
 * 接线层改用 setColorAt 逐粒写色。前面 8 项仍与 batch() 同构，形变逻辑可以照抄。
 *
 * 再往后是 [vx, vy, vz]：粒子**当前速度**。
 * 它是位置的解析导数，供物理验收使用。town 中每颗火星都是等轴点，
 * 绝不按速度拉伸；旧节目保持既有实例契约。
 *
 * ---------------------------------------------------------------- 亮度代替透明度
 * items 里没有 alpha。这是刻意的：烟花材质应当用 AdditiveBlending + depthWrite:false，
 * 在加色混合下「亮度趋零」与「透明淡出」是同一件事。于是淡出曲线可以写在这里、
 * 读数可以写进测试，而渲染层不需要额外的 uniform。
 */
(function (root) {
  'use strict';

  var TAU = Math.PI * 2;
  var GOLDEN = Math.PI * (3 - Math.sqrt(5));   // 2.399963… 球面均匀分布的最优角

  function clamp01(v) {
    if (!isFinite(v)) return 0;
    return v < 0 ? 0 : (v > 1 ? 1 : v);
  }

  function randomGenerator(seed) {
    if (typeof CityRandom === 'object' && CityRandom && CityRandom.randomGenerator) {
      return CityRandom.randomGenerator(seed);
    }
    if (typeof require === 'function') {
      try { return require('./city-random.js').randomGenerator(seed); } catch (e) { /* 纯浏览器 */ }
    }
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------------------------------------------------------- 形态库
   * 名称用的是真实烟花术语，因为这些形态的**区别在尾迹**而不在球面：
   * 牡丹无尾、菊花带短尾、柳带长垂尾、冠是环形带垂。
   * 只有一两种形态的烟花秀读起来像同一发重复了 N 次。
   * 每种形态给出：粒子数、初速、寿命、重力、尾迹系数、闪烁频率与深度、是否环形。
   */
  var SHAPES = {
    peony: {
      name: 'peony', label: '牡丹', particles: 96,
      speed: 26, life: 2.6, gravity: 20, drag: 0.9,
      tail: 0.0, twinkle: 6.5, twinkleDepth: 0.30, ring: false, size: 0.34
    },
    chrysanthemum: {
      name: 'chrysanthemum', label: '菊花', particles: 108,
      speed: 25, life: 3.1, gravity: 18, drag: 0.85,
      tail: 0.55, twinkle: 9, twinkleDepth: 0.42, ring: false, size: 0.30
    },
    // 柳的重力最轻不是写错了：柳靠「初速低 + 寿命长」下落，
    // 主体 4.4s 掉约 30m，加尾迹系数后整条尾巴拖到 7s、能垂到接近地面。
    // 给它重力的牡丹会在 2.6s 内掉穿地面被剪掉，尾巴根本来不及垂下来。
    willow: {
      name: 'willow', label: '柳', particles: 120,
      speed: 19, life: 4.4, gravity: 13, drag: 0.7,
      tail: 1.0, twinkle: 3.2, twinkleDepth: 0.26, ring: false, size: 0.28
    },
    ring: {
      name: 'ring', label: '环', particles: 64,
      speed: 27, life: 2.8, gravity: 20, drag: 0.9,
      tail: 0.18, twinkle: 5, twinkleDepth: 0.30, ring: true, size: 0.27
    },
    crown: {
      name: 'crown', label: '冠', particles: 72,
      speed: 24, life: 3.4, gravity: 17, drag: 0.8,
      tail: 0.85, twinkle: 6, twinkleDepth: 0.34, ring: true, size: 0.30
    },
    palm: {
      name: 'palm', label: '棕榈', particles: 36,
      speed: 31, life: 2.9, gravity: 22, drag: 0.95,
      tail: 0.42, twinkle: 4, twinkleDepth: 0.50, ring: false, size: 0.42
    },
    heart: {
      name: 'heart', label: '心形', particles: 100, geometry: 'heart',
      speed: 29, life: 3.2, gravity: 11, drag: .72,
      tail: .2, twinkle: 5, twinkleDepth: .2, ring: false, size: .3
    },
    star: {
      name: 'star', label: '五角星', particles: 100, geometry: 'star',
      speed: 31, life: 3.0, gravity: 12, drag: .75,
      tail: .25, twinkle: 8, twinkleDepth: .25, ring: false, size: .29
    },
    saturn: {
      name: 'saturn', label: '土星环', particles: 120, geometry: 'saturn',
      speed: 29, life: 3.4, gravity: 12, drag: .74,
      tail: .2, twinkle: 6, twinkleDepth: .24, ring: false, size: .29
    },
    spiral: {
      name: 'spiral', label: '螺旋', particles: 96, geometry: 'spiral',
      speed: 30, life: 3.1, gravity: 11, drag: .7,
      tail: .42, twinkle: 7, twinkleDepth: .24, ring: false, size: .28
    },
    fan: {
      name: 'fan', label: '扇形', particles: 72, geometry: 'fan',
      speed: 28, life: 3.1, gravity: 16, drag: .8,
      tail: .48, twinkle: 5, twinkleDepth: .25, ring: false, size: .3
    },
    // Milestone glyphs share a short, readable hold; their strokes are actual sparks.
    thousand: {
      name: 'thousand', label: '1000', particles: 144, glyph: 'thousand',
      speed: 27, life: 2.65, gravity: .72, drag: 0,
      tail: 0, twinkle: 7, twinkleDepth: .08, ring: false, size: .32
    },
    like: {
      name: 'like', label: '\u70b9\u8d5e', particles: 112, glyph: 'like',
      speed: 27, life: 2.65, gravity: .72, drag: 0,
      tail: 0, twinkle: 7, twinkleDepth: .08, ring: false, size: .32
    },
    favorite: {
      name: 'favorite', label: '\u6536\u85cf', particles: 96, glyph: 'favorite',
      speed: 27, life: 2.65, gravity: .72, drag: 0,
      tail: 0, twinkle: 7, twinkleDepth: .08, ring: false, size: .32
    },
    coin: {
      name: 'coin', label: '\u6295\u5e01', particles: 112, glyph: 'coin',
      speed: 27, life: 2.65, gravity: .72, drag: 0,
      tail: 0, twinkle: 7, twinkleDepth: .08, ring: false, size: .32
    },
    salute: {
      name: 'salute', label: '蜂鸣', particles: 180,
      speed: 11, life: 0.9, gravity: 26, drag: 1.6,
      tail: 0.0, twinkle: 22, twinkleDepth: 0.75, ring: false, size: 0.27
    }
  };

  /* ---------------------------------------------------------------- 配色
   * 精致微缩以香槟金与暖白为主：色差清楚但不画成整片霓虹。
   * 仅转调段偶尔用冷蓝，终章回到金色。颜色为线性 RGB。 */
  var PALETTES = {
    warm: [
      { name: 'champagne', r: 1.00, g: 0.76, b: 0.43 },
      { name: 'warm-white', r: 1.00, g: 0.91, b: 0.72 },
      { name: 'amber', r: 1.00, g: 0.65, b: 0.27 }
    ],
    cool: [
      { name: 'champagne', r: 1.00, g: 0.76, b: 0.43 },
      { name: 'warm-white', r: 1.00, g: 0.91, b: 0.72 },
      { name: 'azure', r: 0.48, g: 0.70, b: 1.00 }
    ],
    finale: [
      { name: 'champagne', r: 1.00, g: 0.76, b: 0.43 },
      { name: 'warm-white', r: 1.00, g: 0.91, b: 0.72 },
      { name: 'gold', r: 1.00, g: 0.68, b: 0.29 }
    ]
  };

  /* ---------------------------------------------------------------- 节目单
   * 段落模板 + seed 决定发序：同 seed 必得同一场秀。
   * rate 单位仍是发/分钟。开场相隔约 7.5s，展开每发约 4–5s，
   * 终章才让少量长柳与菊冠叠层；留白来自真实发射间距，不靠截粒子。
   *
   * 窗口依据：喷泉高潮是 19:00–21:10（city-fountain.js PROGRAM）。
   * 烟花压在其后 19:30 起，因为烟花**要有背景黑**——
   * 19:00 天还没全黑，那时放烟花是灰底上的亮点，一眼假。
   * 终章落在 20:58–21:10，与居民 22:00 睡（ANCHORS.sleep）不冲突。 */
  var ACTS = [
    {
      name: 'overture', from: 1170, to: 1190,      // 19:30–19:50 试射
      rate: 8, palette: 'warm', shapes: ['peony', 'ring'],
      heights: [58, 76], spread: 46, level: 0.55
    },
    {
      name: 'first-movement', from: 1190, to: 1225, // 19:50–20:25 展开
      rate: 14, palette: 'warm', shapes: ['chrysanthemum', 'peony', 'palm'],
      heights: [64, 92], spread: 54, level: 0.8
    },
    {
      name: 'colour-shift', from: 1225, to: 1250,   // 20:25–20:50 少量冷蓝转调
      rate: 12, palette: 'cool', shapes: ['willow', 'ring', 'chrysanthemum'],
      heights: [70, 104], spread: 58, level: 0.9
    },
    {
      name: 'salute-run', from: 1250, to: 1258,     // 20:50–20:58 稀疏蜂鸣点奏
      rate: 10, palette: 'warm', shapes: ['salute'],
      heights: [62, 78], spread: 40, level: 0.95
    },
    {
      name: 'finale', from: 1258, to: 1270,         // 20:58–21:10 终章
      rate: 22, palette: 'finale', shapes: ['willow', 'crown', 'chrysanthemum', 'peony'],
      heights: [72, 112], spread: 62, level: 1.0, finale: true
    }
  ];

  /* 粒子硬上限。
   * 升空彗星与爆后余烬共同计入 1400 硬上限。当前编排用发射间隔控制
   * 密度，使单发形态可辨；硬上限继续兜底未来的节目参数改动。
   *
   * 2600 是照预算算的，但**实测画面**证明它过了观感线：
   * 1,224 粒在 1600×900 上占 100,740 个亮像素，整片糊成白，
   * 连红金本色都读不出来。真实烟花秀的观感是**星星点点**，
   * 密度到一定程度反而变成一团光斑。所以压到 1400。
   *
   * 上限写在 update() 里而不是靠调参凑——后面不管谁再调 rate，
   * 这条线都不该被静默越过。 */
  var MAX_PARTICLES = 1400;

  var WINDOW = { from: ACTS[0].from, to: ACTS[ACTS.length - 1].to };

  /* 是否需要建批。接线层在 level=0 或窗口外时**不建 InstancedMesh**，
   * 这是「完全不画，不是画了藏起来」那条验收线的唯一可测形式。 */
  function isActive(festivalLevel, minute) {
    if (!(festivalLevel > 0)) return false;
    return minuteOfDay(minute) >= WINDOW.from && minuteOfDay(minute) < WINDOW.to;
  }

  function minuteOfDay(minute) {
    var m = Math.floor(minute);
    return ((m % 1440) + 1440) % 1440;
  }

  /* 不取整的当日分钟。**弹道相位必须用它。**
   *
   * minuteOfDay 取整是有道理的——发射槽、段落边界、表演窗口都在整分钟上，
   * 用它们查表才对。
   * 但 sinceSeconds = (m − fireMinute) × 60 里的 m 不能取整：
   * 一取整，每颗粒子就在整整 60 秒里停在同一个位置不动，
   * 到下一分钟再整体跳一步——烟花秀于是变成一格一格的定格动画。
   *
   * 实测（seed 20260818，终章时刻）：
   *     m = 1263.000  第 0 颗 pos = (−5.989, 54.299, 12.025)
   *     m = 1263.500  第 0 颗 pos = (−5.989, 54.299, 12.025)   ← 一模一样
   *     m = 1264.000  第 0 颗 pos = (14.143, 81.584, −3.757)   ← 整段跳变
   * 这个 bug 不报错、不掉帧，探针报「全部可见」，
   * 只有把时间真的推过 60 秒才看得出来。 */
  function minuteOfDayExact(minute) {
    var m = minute % 1440;
    return m < 0 ? m + 1440 : m;
  }

  /* 段落强度：窗口两端各留一段淡入淡出。
   * 没有淡入的话第一发会在黑夜里凭空炸出来，观众读成「卡了」。
   *
   * 斜坡长度必须**跟着段落长度走**，不能写死：
   * 终章只有 12 分钟，若沿用 20 分钟的斜坡，它整段都还在爬升，
   * 强度上限只到 0.25——终章永远起不来。这不是"收敛"，这是高潮缺席。
   * 所以取「不超过 20 分钟，也不超过本段时长的三分之一」。 */
  function actIntensity(act, minute) {
    var ramp = Math.min(20, (act.to - act.from) / 3);
    if (ramp <= 0) return 0;
    var inRamp = (minute - act.from) / ramp;
    var outRamp = (act.to - minute) / ramp;
    return clamp01(Math.min(1, Math.min(inRamp, outRamp)));
  }

  function actAt(minute) {
    var m = minuteOfDay(minute);
    for (var i = 0; i < ACTS.length; i++) {
      if (m >= ACTS[i].from && m < ACTS[i].to) return ACTS[i];
    }
    return null;
  }

  /* ---------------------------------------------------------------- 弹道
   *
   * 上升段吃**指数阻力 + 重力**：
   *     s(t) = (v0 + g/k)·(1-e^(-k·t))/k - (g/k)·t
   * 阻力只做衰减，不做匀减速那样会在顶点留下速度硬切
   * （那读起来就是「升到顶突然顿一下」）。
   *
   * ---------------------------------------------------------------- 为什么必须有 g
   * 只用阻力的上式渐近于 v0/k。取 v0=46, k=0.85 时它**永远到不了 54.1 m**：
   * 跑满 5 秒只到 53.0 m，再等 20 秒也只到 54.0 m。
   * 早先把段落高度写成 58–112 m，于是全部爆点被这个上限压平成一条线，
   * 高度参数形同虚设。而画面上看不出原因——只表现为「所有烟花一样高」，
   * 于是每次都怀疑是参数没传进去，越调越离谱。
   *
   * 这类「渐近上限被当成取值范围」的坑很隐蔽：函数一直返回合理数字，
   * 没有异常、没有 NaN，只有画面对不上。加上 g 之后 v0=46 在 5 秒能上 76 m、
   * 6 秒 94 m，段落高度区间才真正铺开。
   *
   * 顶点时间要反解 s(t)=h。闭式解里 h 落在指数内，故用二分；
   * 区间取「仍在上升」的时段，二分 40 次足够收敛到亚微米。
   *
   * 爆炸后是重力 + 线性阻力。尾迹（tail）不是另画一层，而是把重力调低、
   * 寿命调长、尺寸调大——柳之所以是柳，正因为它落得慢、拖得久、亮得久。 */
  /* 常数不是随手取的：出筒初速必须大到**阻力不吃掉爆点高度**。
   *
   * 阻力+重力下可达顶点高度 ≈ v0·(1 + k/g 的修正)，v0=46 时只有 18 m ——
   * 段落要 58–112 m，整套高度参数全部落在可达范围之外，
   * 于是"调高度"这个旋钮完全失效，而且画面上只表现为"烟花都一样高"。
   *
   * v0=180 给出约 131 m 的顶点，段落区间 [58,112] 才真正落在曲线内部，
   * 各高度可达。此时顶点时刻约 2.0 秒，恰好是真实礼花弹从出筒到爆的量级。
   */
  var ASCENT_K = 0.85;        // 空气阻力系数
  var ASCENT_V0 = 180;        // 出筒初速。够大才有足够的爆点高度余量
  var ASCENT_G = 34;          // 上升段重力

  // 渐近项的速度部分，记一次免得每帧重算。
  var ASCENT_VT = ASCENT_V0 + ASCENT_G / ASCENT_K;

  function ascentHeight(t) {
    return ASCENT_VT * (1 - Math.exp(-ASCENT_K * t)) / ASCENT_K
      - (ASCENT_G / ASCENT_K) * t;
  }

  function ascentSpeed(t) {
    return ASCENT_VT * Math.exp(-ASCENT_K * t) - ASCENT_G / ASCENT_K;
  }

  /* 目标爆点高度 → 顶点时刻。对 s(t)=h 求根。
   * shell() 用它反解 apexT，必须与 ascentHeight 严格同源：
   * 两处各自写一份闭式解的话，改了阻力系数就有一处会悄悄失配，
   * 表现为爆点高度与粒子实际炸开高度对不上，整场烟花飘在半空。
   *
   * 目标超过可达顶点高度时**钳到顶点**，不返回更大的时间。
   * 钳位必须显式做：早先不钳时二分会在「速度早已转负」的死区里
   * 收敛到区间上界（实测 12.6s），而那时 s(t) 已经是 -400 m 的深坑，
   * 爆点会掉到地面以下。返回 12.6s 这种"看似合理其实荒谬"的数字，
   * 是这类反解函数最危险的一种失败方式：它不报错，只让画面静默地烂掉。 */
  function ascentApexTime(h) {
    if (!(h > 0)) return 0;
    var tApex = ascentApex();          // 解析解的顶点时刻（最高点）
    if (h >= ascentHeight(tApex)) return tApex;

    // 二分区间限定在 [0, tApex]——这一段 s(t) 单调递增，二分才有唯一解。
    var lo = 0, span = tApex;
    for (var i = 0; i < 60; i++) {
      var mid = lo + span / 2;
      if (ascentHeight(mid) < h) lo = mid; else span = mid - lo;
    }
    return lo;
  }

  /* 顶点时刻的解析解。s(t) 求极值 ⇒ v(t)=0：
   *     (v0 + g/k)·e^(-k·t) = g/k   ⇒   t_apex = ln(1 + k·v0/g) / k
   * 注意顶点是**最高点**，与速度过零点不是一回事。 */
  function ascentApex() {
    return Math.log(1 + ASCENT_K * ASCENT_V0 / ASCENT_G) / ASCENT_K;
  }

  /* 顶点的可达高度。这是段落高度区间的硬上限：
   * 超过它的目标会被钳到顶点，此时"调高度"这个旋钮不再有效果——
   * 改参数不报错、画面却不动，是最难查的那类假象。 */
  function ascentCeiling() {
    return ascentHeight(ascentApex());
  }

  /* 出筒后的横向漂移，吃同一套阻力，所以升空段的弹道没有折角。
   * vx / vz 是**速度**而非位移——和 ascentSpeed 同一量纲。
   * 这段位移必须计入爆点位置：真实烟花出筒是斜飞的，
   * 把它丢掉的话爆点会正好落在发射口正上方，整场秀变成原地开花。 */
  function ascentDrift(t, vx, vz) {
    var f = (1 - Math.exp(-ASCENT_K * t)) / ASCENT_K;
    return { x: vx * f, z: vz * f };
  }

  /* 一发烟花的完整描述。由 (seed, 全局发序) 唯一确定。 */
  function shell(seed, ordinal, act, minute) {
    var rand = randomGenerator((seed ^ (ordinal * 2654435761)) >>> 0);

    var shapeName = act.shapes[Math.floor(rand() * act.shapes.length)];
    var shape = SHAPES[shapeName];

    var palette = PALETTES[act.palette];
    var color = palette[Math.floor(rand() * palette.length)];

    // 位置：以 origin 为中心横向铺开，纵向在段落高度区间内取。
    // 横向用三角分布而非均匀分布：烟花秀的常见做法是中间密两边疏，
    // 均匀分布会读成一张网格。
    var spread = act.spread;
    var t = rand() + rand() - 1;               // 近似三角分布
    var lateral = t * spread;
    var sideways = rand() < 0.5 ? -1 : 1;
    var originX = lateral;
    var originZ = (rand() + rand() - 1) * spread * 0.42;

    var height = act.heights[0] + rand() * (act.heights[1] - act.heights[0]);
    // 顶点时刻交给 ascentApexTime 反解，别在这里另写一份闭式解。
    var apexT = ascentApexTime(height);

    return {
      ordinal: ordinal,
      shape: shape,
      shapeName: shapeName,
      color: color,
      originX: originX,
      originZ: originZ,
      driftX: sideways * (2.5 + rand() * 5),
      driftZ: (rand() - 0.5) * 4,
      apexT: apexT,
      apexY: height,
      // 发射频率已经负责段落渐入渐出，单发仍留足亮度表达完整形态。
      intensity: (0.55 + 0.45 * actIntensity(act, minute)) * (act.level || 1),
      finale: !!act.finale
    };
  }

  /* 升空彗核 + 六颗短尾，也走 14 项契约；没有累加轨迹缓冲。
   * 每颗取解析弹道的一个短延迟，速度也是该点位置的导数。
   * 爆开后尾端最多再留 0.18s，避免整条尾巴和彗核同时硬切。 */
  function launchScale(opts, axis) {
    var value = opts && opts.launchScale && opts.launchScale[axis];
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
  }

  // Town stars and exhaust embers obey dv/dt = -k(v-wind) + gravity.
  // Positions are closed-form functions of birth state and age, never easing.
  var TOWN_PHYSICS = Object.freeze({ gravity: 9.81, ascentDrag: 1,
    wind: Object.freeze({ x: .65, z: .22 }), emberInterval: .03, emberLife: .18,
    glyphDrag: .82, glyphReadTime: 1 });
  function townFlight(t, vx, vy, vz, k) {
    var e = Math.exp(-k * t), f = (1 - e) / k, g = TOWN_PHYSICS.gravity;
    var wx = TOWN_PHYSICS.wind.x, wz = TOWN_PHYSICS.wind.z;
    return [wx * t + (vx - wx) * f, (vy + g / k) * f - g / k * t,
      wz * t + (vz - wz) * f, wx + (vx - wx) * e,
      (vy + g / k) * e - g / k, wz + (vz - wz) * e];
  }
  function townAscent(sh, t) {
    return townFlight(t, sh.driftX, sh.ascentVelocity, sh.driftZ, TOWN_PHYSICS.ascentDrag);
  }
  function townApex(height) {
    var g = TOWN_PHYSICS.gravity, k = TOWN_PHYSICS.ascentDrag, lo = 0, hi = 6;
    for (var i = 0; i < 42; i++) {
      var t = (lo + hi) / 2, h = g / (k * k) * (Math.exp(k * t) - 1 - k * t);
      if (h < height) lo = t; else hi = t;
    }
    var apexT = (lo + hi) / 2;
    return { time: apexT, velocity: g / k * (Math.exp(k * apexT) - 1) };
  }
  function townComet(sh, t, opts) {
    var life = TOWN_PHYSICS.emberLife, interval = TOWN_PHYSICS.emberInterval;
    if (t < 0 || t >= sh.apexT + life) return [];
    var origin = opts.origin, out = [], level = sh.intensity * (.45 + .55 * opts.festival);
    function point(state, size, brightness) {
      if (brightness <= 0) return;
      out.push([origin.x + sh.originX * launchScale(opts, 'x') + state[0], origin.y + state[1],
        origin.z + sh.originZ * launchScale(opts, 'z') + state[2], size, size, size, 0,
        brightness, 1, .79, .47, state[3], state[4], state[5]]);
    }
    if (t < sh.apexT) {
      var ignition = clamp01(t / .04);
      point(townAscent(sh, t), .28 * ignition, .95 * ignition * level);
    }
    var last = Math.floor(Math.min(t, sh.apexT - 1e-9) / interval);
    for (var serial = last; serial > 0 && serial > last - 6; serial--) {
      var born = serial * interval, age = t - born;
      if (age < 0 || age >= life) continue;
      var source = townAscent(sh, born);
      var rand = randomGenerator((sh.ordinal * 90313 + serial * 7919) >>> 0);
      var state = townFlight(age, source[3] * .24 + (rand() - .5) * 2.2,
        source[4] * .24 - 2 - rand() * 2, source[5] * .24 + (rand() - .5) * 2.2, 2.2 + rand() * .8);
      for (var axis = 0; axis < 3; axis++) state[axis] += source[axis];
      var heat = Math.pow(1 - age / life, 1.45);
      point(state, .19 * Math.sqrt(heat), .52 * heat * level);
    }
    return out;
  }

  function comet(sh, t, opts) {
    if (sh.pyrotechnic) return townComet(sh, t, opts);
    if (t < 0 || t >= sh.apexT + 0.18) return [];
    var origin = opts.origin;
    var out = [];
    for (var i = 0; i < 7; i++) {
      var lag = i * 0.03;
      var flightT = t - lag;
      if (flightT < 0 || flightT >= sh.apexT) continue;
      var drift = ascentDrift(flightT, sh.driftX, sh.driftZ);
      var e = Math.exp(-ASCENT_K * flightT);
      var taper = Math.pow(1 - i / 7, 1.45);
      var tailFade = t < sh.apexT ? 1 : clamp01((sh.apexT + 0.18 - t) / 0.18);
      var ignition = clamp01(flightT / 0.04);
      var brightness = (i === 0 ? 0.95 : 0.52) * taper * tailFade * ignition
        * sh.intensity * (0.45 + 0.55 * opts.festival);
      if (brightness <= 0) continue;
      var width = (i === 0 ? 0.28 : 0.19) * Math.sqrt(taper * tailFade) * ignition;
      out.push([
        origin.x + sh.originX * launchScale(opts, 'x') + drift.x, origin.y + ascentHeight(flightT),
        origin.z + sh.originZ * launchScale(opts, 'z') + drift.z,
        width, width * (i === 0 ? 2.4 : 3.2), width, 0,
        brightness, 1, 0.79, 0.47,
        sh.driftX * e, ascentSpeed(flightT), sh.driftZ * e
      ]);
    }
    return out;
  }

  /* 一发的粒子。t 是距发射时刻的秒数。
   *
   * 球面分布用**黄金角螺旋**而不是随机方向：黄金角是球面均匀采样里
   * 最优的角度增量，随机方向必然成团，而成团正是「一眼假」的第一来源。 */
  /* 图案礼花的初速度就是轮廓。保留径向长度，不能统一归一化成圆。
   * 旧七形态完全不走此分支，其随机采样顺序与球面方向保持原样。 */
  function contourDirection(kind, index, count) {
    var u = index / count, angle = u * TAU, x, y, z = .025 * Math.sin(index * GOLDEN);
    if (kind === 'heart') {
      x = 16 * Math.pow(Math.sin(angle), 3) / 17;
      y = (13 * Math.cos(angle) - 5 * Math.cos(2 * angle)
        - 2 * Math.cos(3 * angle) - Math.cos(4 * angle)) / 17;
    } else if (kind === 'star') {
      var edge = Math.floor(u * 10), along = u * 10 - edge;
      var a = Math.PI / 2 - edge * TAU / 10, b = a - TAU / 10;
      var ra = edge % 2 ? .43 : 1, rb = edge % 2 ? 1 : .43;
      x = Math.cos(a) * ra * (1 - along) + Math.cos(b) * rb * along;
      y = Math.sin(a) * ra * (1 - along) + Math.sin(b) * rb * along;
    } else if (kind === 'saturn') {
      var ringCount = Math.floor(count * 2 / 3);
      if (index < ringCount) {
        angle = index / ringCount * TAU;
        x = Math.cos(angle); y = Math.sin(angle) * .38; z = Math.sin(angle) * Math.sqrt(1 - .38 * .38);
      } else {
        var body = index - ringCount, bodyCount = count - ringCount;
        var phi = Math.acos(1 - 2 * ((body + .5) / bodyCount));
        angle = body * GOLDEN;
        x = .42 * Math.sin(phi) * Math.cos(angle); y = .42 * Math.cos(phi); z = .42 * Math.sin(phi) * Math.sin(angle);
      }
    } else if (kind === 'spiral') {
      u = index / (count - 1); angle = u * TAU * 2.4;
      var radius = .15 + .85 * u;
      x = Math.cos(angle) * radius; y = Math.sin(angle) * radius;
    } else {
      // Nine complete ribs; extra town particles densify each rib without adding
      // unintended ribs beyond the original fan's opening angle.
      var perRib = count / 9, rib = Math.floor(index / perRib), reach = .2 + .8 * (index % perRib) / (perRib - 1);
      angle = -.9 + 1.8 * rib / 8;
      x = Math.sin(angle) * reach; y = Math.cos(angle) * reach;
    }
    return { x: x, y: y, z: z };
  }

  // Vector paths, not font rasters: each separate stroke receives its own
  // arc-length samples, so gaps between numerals and the coin's inner mark stay open.
  function ellipsePath(cx, cy, rx, ry) {
    var points = [];
    for (var i = 0; i <= 48; i++) {
      var a = i / 48 * TAU;
      points.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return points;
  }
  var GLYPH_PATHS = {
    thousand: [
      [[-1.46, .34], [-1.22, .60], [-1.22, -.60]],
      [[-1.46, -.60], [-.99, -.60]],
      ellipsePath(-.56, 0, .29, .60),
      ellipsePath(.25, 0, .29, .60),
      ellipsePath(1.06, 0, .29, .60)
    ],
    like: [
      [[-.76, -.62], [-.76, .04], [-.40, .04], [-.40, -.62], [-.76, -.62]],
      [[-.40, .02], [-.13, .27], [.02, .58], [.04, .83], [.21, .83],
        [.33, .68], [.31, .40], [.22, .22], [.64, .22], [.78, .09],
        [.64, -.49], [.49, -.62], [-.40, -.62]]
    ],
    favorite: [],
    coin: [
      ellipsePath(0, 0, .80, .80), ellipsePath(0, 0, .62, .62),
      [[-.16, .20], [.03, .38], [.03, -.36]],
      [[-.19, -.36], [.25, -.36]]
    ]
  };
  for (var corner = 0, starPath = []; corner <= 10; corner++) {
    var starAngle = Math.PI / 2 - corner * TAU / 10, starRadius = corner % 2 ? .40 : .86;
    starPath.push([Math.cos(starAngle) * starRadius, Math.sin(starAngle) * starRadius]);
  }
  GLYPH_PATHS.favorite = [starPath];
  var glyphSamplesCache = Object.create(null);
  function glyphSamples(kind, count) {
    var key = kind + ':' + count;
    if (glyphSamplesCache[key]) return glyphSamplesCache[key];
    var paths = GLYPH_PATHS[kind], lengths = paths.map(function (path) {
      var length = 0;
      for (var i = 1; i < path.length; i++) length += Math.hypot(path[i][0] - path[i-1][0], path[i][1] - path[i-1][1]);
      return length;
    });
    var total = lengths.reduce(function (sum, length) { return sum + length; }, 0);
    var counts = lengths.map(function (length) { return Math.max(2, Math.floor(count * length / total)); });
    var allocated = counts.reduce(function (sum, n) { return sum + n; }, 0);
    for (var extra = 0; allocated < count; extra++, allocated++) counts[extra % counts.length]++;
    var out = [];
    paths.forEach(function (path, index) {
      var closed = Math.hypot(path[0][0] - path[path.length-1][0], path[0][1] - path[path.length-1][1]) < 1e-9;
      for (var i = 0; i < counts[index]; i++) {
        var distance = lengths[index] * i / (closed ? counts[index] : counts[index] - 1), edge = 1;
        while (edge < path.length - 1) {
          var segment = Math.hypot(path[edge][0] - path[edge-1][0], path[edge][1] - path[edge-1][1]);
          if (distance <= segment) break;
          distance -= segment; edge++;
        }
        var a = path[edge-1], b = path[edge];
        var along = distance / Math.hypot(b[0] - a[0], b[1] - a[1]);
        out.push([a[0] + (b[0] - a[0]) * along, a[1] + (b[1] - a[1]) * along]);
      }
    });
    glyphSamplesCache[key] = out;
    return out;
  }
  function glyphBasis(options) {
    var given = options && options.glyphBasis, right = given && given.right, up = given && given.up;
    if (!right || !up || ![right.x, right.y, right.z, up.x, up.y, up.z].every(Number.isFinite)) {
      return { right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 } };
    }
    // Orthonormalize without reversing either requested screen direction.
    var rl = Math.hypot(right.x, right.y, right.z);
    if (rl < 1e-8) return glyphBasis();
    right = { x: right.x / rl, y: right.y / rl, z: right.z / rl };
    var dot = right.x * up.x + right.y * up.y + right.z * up.z;
    up = { x: up.x - dot * right.x, y: up.y - dot * right.y, z: up.z - dot * right.z };
    var ul = Math.hypot(up.x, up.y, up.z);
    if (ul < 1e-8) return glyphBasis();
    return { right: right, up: { x: up.x / ul, y: up.y / ul, z: up.z / ul } };
  }
  // Only the town score uses fuel variation and drifting contours. The public
  // legacy burst remains unchanged for existing captures and analytic clients.
  function pyroGlyphBurst(sh, t, apex, origin, level, options) {
    var shape = sh.shape, samples = glyphSamples(shape.glyph, shape.particles), basis = glyphBasis(options);
    var right = basis.right, up = basis.up;
    var normal = { x: right.y * up.z - right.z * up.y, y: right.z * up.x - right.x * up.z, z: right.x * up.y - right.y * up.x };
    var rand = randomGenerator((sh.ordinal * 90313 + 283) >>> 0), out = [];
    var carry = townAscent(sh, sh.apexT);
    for (var i = 0; i < samples.length; i++) {
      var jx = (rand() - .5) * .44, jy = (rand() - .5) * .44, depth = (rand() - .5) * .44;
      var fuel = rand(), flicker = rand(), size = .68 + rand() * .60;
      var life = shape.life * (.79 + .21 * fuel);
      if (t >= life) continue;
      var k = TOWN_PHYSICS.glyphDrag * (.91 + .18 * flicker);
      // A shaped charge distributes initial velocities, not target positions.
      // At one second the contour is legible; it keeps expanding and falling.
      var readGain = (1 - Math.exp(-k * TOWN_PHYSICS.glyphReadTime)) / k;
      var x = (samples[i][0] * shape.speed + jx) / readGain;
      var y = (samples[i][1] * shape.speed + jy) / readGain;
      var state = townFlight(t, carry[3] + right.x * x + up.x * y + normal.x * depth,
        carry[4] + right.y * x + up.y * y + normal.y * depth, carry[5] + right.z * x + up.z * y + normal.z * depth, k);
      var px = apex.x + state[0], py = apex.y + state[1], pz = apex.z + state[2];
      var fadeAge = clamp01((t - 1.25) / (life - 1.25)), fade = 1 - fadeAge * fadeAge * (3 - 2 * fadeAge);
      var groundFade = clamp01((py - origin.y - 1.5) / 8);
      var twinkle = .80 + .20 * Math.pow(Math.sin(flicker * TAU + t * (11 + fuel * 17)), 2);
      var brightness = fade * (.62 + .38 * clamp01(t / .08)) * twinkle * sh.intensity * (.45 + .55 * level) * groundFade;
      if (brightness <= 0) continue;
      var width = shape.size * size * Math.sqrt(fade * groundFade);
      out.push([px, py, pz, width, width, width, 0, brightness,
        sh.color.r, sh.color.g * (1 - .12 * fadeAge), sh.color.b * (1 - .40 * fadeAge), state[3], state[4], state[5]]);
    }
    return out;
  }

  function glyphBurst(sh, sinceBurst, apex, origin, level, options) {
    if (sh.pyrotechnic) return pyroGlyphBurst(sh, sinceBurst, apex, origin, level, options);
    var shape = sh.shape, samples = glyphSamples(shape.glyph, shape.particles), basis = glyphBasis(options);
    var u = clamp01(sinceBurst / .58);
    var expansion = 1 - Math.pow(1 - u, 3), rate = sinceBurst < .58 ? 3 * Math.pow(1 - u, 2) / .58 : 0;
    var fadeAge = clamp01((sinceBurst - 1.70) / (shape.life - 1.70));
    var fade = 1 - fadeAge * fadeAge * (3 - 2 * fadeAge);
    var ignition = .48 + .52 * clamp01(sinceBurst / .12), out = [];
    for (var i = 0; i < samples.length; i++) {
      var x = samples[i][0] * shape.speed, y = samples[i][1] * shape.speed;
      var dx = basis.right.x * x + basis.up.x * y;
      var dy = basis.right.y * x + basis.up.y * y;
      var dz = basis.right.z * x + basis.up.z * y;
      var px = apex.x + dx * expansion, py = apex.y + dy * expansion - .5 * shape.gravity * sinceBurst * sinceBurst;
      var pz = apex.z + dz * expansion;
      var groundFade = clamp01((py - origin.y - 1.5) / 8);
      var twinkle = 1 - shape.twinkleDepth * .5 * (1 + Math.sin(i * .7 + sinceBurst * shape.twinkle));
      var brightness = fade * ignition * twinkle * sh.intensity * (.45 + .55 * level) * groundFade;
      if (brightness <= 0) continue;
      var width = shape.size * Math.sqrt(fade * groundFade);
      out.push([px, py, pz, width, width, width, 0, brightness, sh.color.r, sh.color.g, sh.color.b,
        dx * rate, dy * rate - shape.gravity * sinceBurst, dz * rate]);
    }
    return out;
  }

  function burst(sh, t, opts) {
    var shape = sh.shape;
    var ascentT = sh.apexT;
    if (t < ascentT) return null;              // 还在升空，没有粒子

    var sinceBurst = t - ascentT;
    var lifetime = shape.life * (1 + shape.tail * 0.6);
    if (sinceBurst >= lifetime) return null;  // 完整余烬寿命，与回溯扫描同源

    var origin = opts && opts.origin ? opts.origin : { x: 0, y: 0, z: 0 };
    var level = clamp01(opts && opts.festival != null ? opts.festival : 1);

    var rise = sh.pyrotechnic ? townAscent(sh, ascentT) : null;
    var drift = rise ? { x: rise[0], z: rise[2] } : ascentDrift(ascentT, sh.driftX, sh.driftZ);
    var apex = {
      x: origin.x + sh.originX * launchScale(opts, 'x') + drift.x,
      y: origin.y + sh.apexY,
      z: origin.z + sh.originZ * launchScale(opts, 'z') + drift.z
    };

    if (shape.glyph) return glyphBurst(sh, sinceBurst, apex, origin, level, opts);

    var age = clamp01(sinceBurst / lifetime);
    var pyro = sh.pyrotechnic, fuelRand = pyro ? randomGenerator((sh.ordinal * 90313 + 617) >>> 0) : null;
    var out = [];
    var rand = randomGenerator((sh.ordinal * 40503 + 7919) >>> 0);

    for (var i = 0; i < shape.particles; i++) {
      // 方向。环形形态走赤道平面，其余走球面螺旋。
      var theta, phi;
      if (shape.ring) {
        theta = (i / shape.particles) * TAU;
        phi = Math.PI / 2 + (rand() - 0.5) * 0.16;   // 环要有一点厚度才不是纸片
      } else {
        theta = i * GOLDEN;
        phi = Math.acos(1 - 2 * ((i + 0.5) / shape.particles));
      }

      // Town shells occupy a volume instead of a uniformly spaced outer skin.
      // Outline directions keep their complete path; individual drag and fuel
      // break up the contour naturally under the same gravitational acceleration.
      var fuel = pyro ? fuelRand() : 1, grain = pyro ? fuelRand() : 1;
      var turbulence = pyro ? fuelRand() : .5, sparkSize = pyro ? .68 + fuelRand() * .65 : 1;
      var sparkLife = pyro ? lifetime * (.67 + .33 * fuel) : lifetime;
      var sparkAge = pyro ? clamp01(sinceBurst / sparkLife) : age;
      if (pyro && !shape.geometry) {
        theta += (turbulence - .5) * (shape.ring ? .045 : .68);
        if (!shape.ring) phi = Math.max(.015, Math.min(Math.PI - .015, phi + (grain - .5) * .24));
      }

      // 每粒一个初速抖动。完美对称的球在夜景里会读成 CG 感，
      // 这点抖动是「手放上去的」那种不齐。
      var jitter = 0.82 + rand() * 0.36;
      if (sinceBurst >= sparkLife) continue;
      var volume = pyro && !shape.ring && !shape.geometry ? (grain < .26 ? .37 + grain * 1.1 : .86 + turbulence * .28) : 1;
      var radialLayer = 0;
      if (pyro && sh.colorLayers && sh.colorLayers.length > 1) {
        // Slow stars make the warm core; faster stars form a larger, coloured outer layer.
        var radialScore = shape.geometry || shape.ring ? jitter : volume * jitter;
        radialLayer = radialScore >= (shape.geometry || shape.ring ? 1 : .94) ? 1 : 0;
        sparkSize *= radialLayer ? 1.22 : .82;
      }
      var speed = shape.speed * jitter * volume * (0.55 + 0.45 * sh.intensity);

      var vx = Math.sin(phi) * Math.cos(theta) * speed;
      var vy = Math.cos(phi) * speed;
      var vz = Math.sin(phi) * Math.sin(theta) * speed;
      if (shape.geometry) {
        var contour = contourDirection(shape.geometry, i, shape.particles);
        // 图案只作微小速差，强抖动会把星角与心形凹口抹成普通球。
        var radialSpeed = sh.colorLayers && sh.colorLayers.length > 1 ? (radialLayer ? 1.12 : .88) : 1;
        speed = shape.speed * (.98 + (jitter - .82) / .36 * .04) * radialSpeed * (.55 + .45 * sh.intensity);
        vx = contour.x * speed; vy = contour.y * speed; vz = contour.z * speed;
        theta = Math.atan2(contour.y, contour.x);
      }

      if (pyro) { vx += rise[3]; vy += rise[4]; vz += rise[5]; } // inherit the shell drift

      // 位移：重力 + 线性阻力。解析解而不是逐步积分——
      // 逐步积分会让结果依赖采样步长，而这里必须对任意 t 给确定值。
      var g = pyro ? TOWN_PHYSICS.gravity : shape.gravity;
      var k = shape.drag * (pyro ? .76 + turbulence * .54 : 1);
      var e = Math.exp(-k * sinceBurst);
      var px = apex.x + vx * (1 - e) / k;
      var pz = apex.z + vz * (1 - e) / k;
      var py = apex.y + (vy + g / k) * (1 - e) / k - (g / k) * sinceBurst;
      if (pyro) {
        px += TOWN_PHYSICS.wind.x * (sinceBurst - (1 - e) / k);
        pz += TOWN_PHYSICS.wind.z * (sinceBurst - (1 - e) / k);
      }

      // 余烬继续落到地面以下时要灭掉，否则会有粒子穿地。
      var groundY = origin.y + 1.5;
      if (py < groundY) continue;
      var groundFade = clamp01((py - groundY) / 8);

      // 年龄按包含尾迹的总寿命归一化。原先在基础寿命后 1-age 变负，
      // 非整数幂返回 NaN，柳尾会在 4.4s 整簇消失而不是自然垂落到 7.04s。
      var fade = Math.pow(1 - age, 1.1 + shape.tail * 0.3);
      if (pyro) {
        var burn = clamp01((sparkAge - .15) / .85);
        fade = 1 - burn * burn * (3 - 2 * burn);
      }
      var twinklePhase = i * 0.7 + sinceBurst * shape.twinkle;
      var twinkle = 1 - shape.twinkleDepth * 0.5 * (1 + Math.sin(twinklePhase));
      if (pyro) twinkle = .68 + .32 * Math.pow(Math.sin(turbulence * TAU + sinceBurst * (12 + grain * 24)), 2);
      var ember = shape.tail > 0 ? (1 + 0.55 * shape.tail * Math.sin(sinceBurst * 4 + i)) * 0.5 + 0.5 : 1;
      // 不设亮度硬底。加色亮度与尺寸一同趋零，寿命结束不留下可见截断。
      var brightness = clamp01(fade * twinkle * ember * sh.intensity * (0.45 + 0.55 * level) * groundFade);
      if (brightness <= 0) continue;

      // Current velocity is the derivative of position. The legacy show keeps
      // its stretched instances; town burning stars are always equal-axis points.
      var vnx = vx * e;
      var vnz = vz * e;
      var vny = vy * e - (g / k) * (1 - e);
      if (pyro) {
        vnx += TOWN_PHYSICS.wind.x * (1 - e);
        vnz += TOWN_PHYSICS.wind.z * (1 - e);
      }
      var speedNow = Math.sqrt(vnx * vnx + vny * vny + vnz * vnz);
      var shrink = Math.pow(1 - age, 0.55) * Math.sqrt(groundFade);
      var stretch = shape.size * (1 + shape.tail * 2.2) * (0.7 + 0.9 * clamp01(speedNow / 34)) * shrink;
      var width = shape.size * (0.62 + 0.38 * (1 - age)) * (1 - shape.tail * 0.18) * shrink;

      if (pyro) {
        shrink = Math.sqrt(fade * groundFade);
        width = shape.size * sparkSize * (.8 + .2 * (1 - sparkAge)) * shrink;
        stretch = width;
      }

      var c = sh.color;
      if (pyro && sh.colorLayers && sh.colorLayers.length > 1) c = sh.colorLayers[radialLayer];
      var fadeColor = 1 - 0.42 * age * shape.tail;   // 尾迹末端略降饱和，转成余烬色

      out.push([
        px, py, pz,
        width, stretch, width,
        pyro ? 0 : theta,
        brightness,
        c.r * fadeColor, c.g * fadeColor, c.b * fadeColor,
        vnx, vny, vnz              // 位置的解析导数，供轨迹验收
      ]);
    }
    return out;
  }

  /* 一段的最长弹道（秒）= 最慢的上升 + 最长的余烬。
   * 回溯扫描必须至少覆盖它，否则会出现「还在升空就没了」——
   * 扫描窗口短于上升时间是这一层最容易犯且最难看的错：
   * 画面上表现为烟花刚出筒就在半空凭空消失。 */
  function actSpan(act) {
    // 上升时长按**最高爆点**算：矮的那些早就散完了，
    // 用最高点算才不会在窗口边缘把还在升空的高弹误剪掉。
    var rise = ascentApexTime(act.heights[1]);
    var burn = 0;
    for (var i = 0; i < act.shapes.length; i++) {
      var s = SHAPES[act.shapes[i]];
      var life = s.life * (1 + s.tail * 0.6);
      if (life > burn) burn = life;
    }
    return rise + burn;
  }

  /* ---------------------------------------------------------------- 主入口
   * update(minute, opts) → items 数组，可直接 setMatrixAt + setColorAt。
   * level=0 或窗口外一律返回**长度 0 的数组**，且 isActive() 同步为 false，
   * 接线层据此跳过建批——这是验收清单里最容易赖掉的一条，必须两边都测。 */
  function update(minute, opts) {
    var options = opts || {};
    var festival = clamp01(options.festival);
    // 弹道相位走不取整的那个；下面的槽/段落查询会各自再取整，互不影响
    var m = minuteOfDayExact(minute);
    if (!isActive(festival, m)) return [];

    var seed = options.seed == null ? 20260818 : options.seed;
    var origin = options.origin || { x: 0, y: 0, z: 0 };
    var act = actAt(m);
    if (!act) return [];

    var items = [];

    /* 回溯 1 个分钟槽。槽 = 整整一分钟的发射窗口，而最长弹道约 12.4 秒，
     * 所以一个槽绰绰有余；多扫只会白烧 CPU。 */
    var base = Math.floor(m);
    for (var tm = base - 1; tm <= base; tm++) {
      var actAtTm = actAt(tm);
      if (!actAtTm) continue;
      // 发射槽只遍历一次，tm*1000+k 是跨段唯一发序。上一段仍在飞行
      // 的粒子必须沿用原弹道，不能因当前段落名称改变就清空。

      var span = actSpan(actAtTm);
      var perMinute = actAtTm.rate * actIntensity(actAtTm, tm);
      if (perMinute <= 0) continue;

      // 不足一发的余数也要发：用 seed 掷点决定这一分钟多不多发一发，
      // 绝不能用 Math.random —— 否则同 seed 两次跑出的发数不同，
      // 画面每帧都在变，视觉回归与截图对比全部失效。
      var count = Math.floor(perMinute);
      if (ordinalHit(seed, tm, perMinute - count)) count += 1;
      if (count <= 0) continue;

      for (var k = 0; k < count; k++) {
        var fireMinute = tm + (k + 0.5) / count;   // 均匀铺在这一分钟内

        /* 单位在这里必须转一次：fireMinute 与 m 都是「当日分钟」，
         * 而弹道常数（life / gravity / span）全是**秒**。
         * 漏掉这次 ×60 的后果不是报错，是整场烟花一颗都不出现——
         * 每分钟几十发的节奏会被误判成「全都还在升空」，
         * 而升空要 5 秒、要几十发分布在 60 秒里，两边一混就永远等不到爆开的那一刻。 */
        var sinceSeconds = (m - fireMinute) * 60;
        if (sinceSeconds < 0 || sinceSeconds > span) continue;

        var ordinal = tm * 1000 + k;               // 全局发序，喂 shell 的 seed
        var sh = shell(seed, ordinal, actAtTm, fireMinute);
        // 固定收场时刻仍然不激活；只排能在窗口内完整熄灭的弹道，
        // 不能等到 21:10 再把仍亮着的最后一发截断。
        var endMinute = fireMinute + (sh.apexT + sh.shape.life * (1 + sh.shape.tail * 0.6)) / 60;
        if (endMinute > WINDOW.to) continue;
        var particleOptions = { origin: origin, festival: festival, launchScale: options.launchScale };
        var particles = comet(sh, sinceSeconds, particleOptions);
        var sparks = burst(sh, sinceSeconds, particleOptions);
        if (sparks) particles = particles.concat(sparks);
        for (var p = 0; p < particles.length && items.length < MAX_PARTICLES; p++) {
          items.push(particles[p]);
        }
        if (items.length >= MAX_PARTICLES) return items;
      }
    }
    return items;
  }

  /* 小数概率的确定性掷点。用于「这一分钟要不要多发一发」——
   * 用 randomGenerator 而非 Math.random，否则同 seed 两次跑出的发数不同，
   * 画面每一帧都在变，视觉回归和截图对比全部失效。 */
  function ordinalHit(seed, minute, fraction) {
    if (fraction <= 0) return false;
    var r = randomGenerator((seed ^ (minute * 2246822519)) >>> 0);
    return r() < fraction;
  }

  /* 节目单摘要，给 HUD 与出片脚本读：这一场秀有哪些段落、什么时候。
   * 不含随机量，所以页面上的时间轴说明在任何 seed 下都一致。 */
  function script() {
    return {
      window: WINDOW,
      acts: ACTS.map(function (a) {
        return {
          name: a.name,
          from: a.from, to: a.to,
          rate: a.rate,
          palette: a.palette,
          shapes: a.shapes.map(function (n) { return SHAPES[n].label; }),
          finale: !!a.finale
        };
      })
    };
  }

  /* 同步给 Canvas 2D 路径（city-light.js 那条栈没有 InstancedMesh）。
   * 2D 下没有体积，把粒子退化成星点，仍由同一份 level 与同一批时刻驱动——
   * 「切渲染模式发现烟花消失」是最伤的一种穿帮。 */
  function update2d(minute, opts) {
    var items = update(minute, opts);
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      out.push({ x: it[0], y: it[1], z: it[2], size: it[3], tint: it[7], color: { r: it[8], g: it[9], b: it[10] } });
    }
    return out;
  }

  /* 全镇八点节目。宿主身份 + 局部偏移是唯一位置记录；实际发射点随
   * CityLayout 移动，不能把操场、公园或建筑搬家后的世界坐标缓存下来。 */
  var TOWN_SHOW = { duration: 96, maxParticles: 1400 };
  var TOWN_SPARK_DENSITY = 1.22; // town-only: fill blooms while keeping the existing 1,400-particle cap.
  var TOWN_PARTICLES = { peony: 128, chrysanthemum: 112, willow: 80, ring: 104,
    crown: 104, palm: 96, heart: 100, star: 100, saturn: 104, spiral: 104, fan: 108, salute: 144 };
  var SITE_LAYOUT = [
    { id: 'primary-court', label: '小学前院', host: { type: 'building', id: 'b-0-0', facility: 'primary' }, offset: { x: -8, y: 1.5, z: 18 } },
    { id: 'depot-court', label: '物流场站前庭', host: { type: 'building', id: 'b-2-0', facility: 'depot' }, offset: { x: -8, y: 1.5, z: 17 } },
    { id: 'west-park', label: '西园草地', host: { type: 'park', index: 0, sourceLot: 4 }, offset: { x: -18.5, y: .22, z: 10 } },
    { id: 'east-park', label: '东园草地', host: { type: 'park', index: 1, sourceLot: 11 }, offset: { x: 18.5, y: .22, z: 10 } },
    { id: 'sports-field', label: '运动场', host: { type: 'playground' }, offset: { x: 6, y: .405, z: 4 } },
    { id: 'amusement-side', label: '游乐场', host: { type: 'place', kind: 'amusement' }, offset: { x: 22, y: .37, z: -10 } },
    { id: 'university-court', label: '大学庭院', host: { type: 'building', id: 'b-20-0', facility: 'university' }, offset: { x: 12, y: 1.5, z: -18 } },
    { id: 'library-court', label: '图书馆前庭', host: { type: 'building', id: 'b-22-0', facility: 'library' }, offset: { x: 12, y: 1.5, z: -18 } }
  ];
  // A town score uses visibly different flame colours; the legacy nightly score
  // deliberately keeps its original warm palette and exact particle contract.
  var TOWN_COLORS = [
    { name: 'crimson', r: 1, g: .025, b: .055 },
    { name: 'tangerine', r: 1, g: .17, b: .018 },
    { name: 'azure', r: .025, g: .22, b: 1 },
    { name: 'emerald', r: .045, g: 1, b: .14 },
    { name: 'violet', r: .52, g: .035, b: 1 },
    { name: 'champagne', r: 1, g: .68, b: .22 },
    { name: 'rose', r: 1, g: .035, b: .38 }
  ];
  var TOWN_COLOR_LAYERS = [[5, 0], [5, 1], [5, 4], [5, 1], [5, 2], [5, 3], [5, 6]];
  var TOWN_SITE_ORDER = [0, 5, 2, 7, 1, 4, 3, 6];
  function launchSites(city) {
    if (!city) return [];
    return SITE_LAYOUT.map(function (site) {
      var h = site.host;
      var host = h.type === 'building' ? (city.buildings || []).find(function (b) { return b.id === h.id; })
        : h.type === 'park' ? (city.parks || [])[h.index]
        : h.type === 'playground' ? city.playground
        : (city.places || []).find(function (p) { return p.kind === h.kind; });
      if (!host || !Number.isFinite(host.x) || !Number.isFinite(host.z) || (h.facility && host.facility !== h.facility)) {
        throw new Error('Fireworks launch site ' + site.id + ': missing or invalid host ' + (h.id || h.kind || h.type));
      }
      return { id: site.id, label: site.label, host: Object.assign({}, h), offset: Object.assign({}, site.offset),
        x: host.x + site.offset.x, y: site.offset.y, z: host.z + site.offset.z };
    });
  }
  var townShellCache = Object.create(null);
  function townSchedule(seed, override) {
    var shapeOverride = Object.prototype.hasOwnProperty.call(SHAPES, override) ? override : '';
    var cacheKey = (seed >>> 0) + ':' + shapeOverride;
    if (townShellCache[cacheKey]) return townShellCache[cacheKey];
    var classics = ['peony', 'chrysanthemum', 'willow', 'palm', 'salute'];
    var accents = { 7: 'ring', 11: 'fan', 15: 'crown', 19: 'heart', 20: 'thousand',
      31: 'ring', 35: 'fan', 39: 'crown', 43: 'star', 44: 'like', 55: 'ring',
      59: 'fan', 63: 'crown', 67: 'spiral', 68: 'favorite', 79: 'ring', 83: 'fan',
      87: 'crown', 91: 'saturn', 92: 'coin', 107: 'heart', 111: 'crown', 115: 'star', 120: 'thousand' };
    var rand = randomGenerator((seed ^ 0x6f13ab79) >>> 0), times = [0], total = 0;
    // The last lift is fixed at 84s so even a full willow override burns out
    // naturally before the 94s rest. The seeded gaps remain uneven at every site.
    for (var slot = 1; slot < 128; slot++) {
      total += (slot < 32 ? .69 : slot < 96 ? .66 : .55) * (.64 + rand() * .72);
      times.push(total);
    }
    var colourOffset = Math.floor(rand() * TOWN_COLORS.length), events = [];
    function add(site, time, shape, height, phase) {
      var name = shapeOverride || shape;
      var act = { from: 0, to: 96, shapes: [name], heights: [height, height], spread: 0,
        palette: phase === 'weave' && name === 'saturn' ? 'cool' : phase === 'finale' ? 'finale' : 'warm', level: 1 };
      var ordinal = 1200000 + events.length, sh = shell(seed, ordinal, act, time);
      // Long willow overlap keeps 98 sparks; every town burst adds 22% density
      // while using the existing 1,400-point render pool.
      sh.shape = Object.assign({}, sh.shape, { particles: Math.ceil((sh.shape.glyph ? sh.shape.particles : TOWN_PARTICLES[name]) * TOWN_SPARK_DENSITY),
        gravity: TOWN_PHYSICS.gravity, drag: sh.shape.glyph ? TOWN_PHYSICS.glyphDrag : sh.shape.drag });
      sh.pyrotechnic = true;
      var rise = townApex(height);
      sh.apexT = rise.time; sh.ascentVelocity = rise.velocity;
      var shellColorIndex = (events.length * 3 + Math.floor(events.length / 8) + colourOffset) % TOWN_COLORS.length;
      sh.color = TOWN_COLORS[shellColorIndex];
      var layerIndices = TOWN_COLOR_LAYERS[shellColorIndex % TOWN_COLOR_LAYERS.length];
      sh.colorLayers = sh.shape.glyph ? null : layerIndices.map(function (index) { return TOWN_COLORS[index]; });
      sh.originX = 0; sh.originZ = 0; sh.driftX *= .25; sh.driftZ *= .25;
      sh.intensity = phase === 'ensemble' ? .86 : phase === 'weave' ? .94 : 1;
      sh.finale = phase === 'finale';
      var end = time + sh.apexT + sh.shape.life * (1 + sh.shape.tail * .6);
      events.push({ site: site, fireTime: time, endTime: end, sh: sh });
    }
    // 128 single lifts answer across the town, without four/eight-site volleys.
    // Overlapping flight and burn time keep several blooms in the air; classic
    // shells are 104/128 shots, while five single-site glyphs only mark the occasion.
    for (var index = 0; index < times.length; index++) {
      var time = Math.round(times[index] / total * 84 * 1e6) / 1e6;
      var block = Math.floor(index / 8), site = TOWN_SITE_ORDER[(index + block * 3) % 8];
      var phase = time < 24 ? 'ensemble' : time < 72 ? 'weave' : 'finale';
      var height = 100 + rand() * 23;
      var name = accents[index] || classics[(index * 3 + block) % classics.length];
      add(site, time, name, height, phase);
    }
    townShellCache[cacheKey] = events;
    return events;
  }
  function sitePreviewTime(siteId, opts) {
    var options = opts || {}, sites = launchSites(options.city);
    var index = sites.findIndex(function (site) { return site.id === siteId; });
    if (index < 0) throw new Error('Unknown fireworks launch site: ' + siteId);
    var schedule = townSchedule(options.seed == null ? 20260818 : options.seed, options.shape);
    var first = schedule.find(function (event) { return event.site === index; });
    return first.fireTime + first.sh.apexT + (first.sh.shape.glyph ? 1 : .65);
  }
  function townShow(seconds, opts) {
    var options = opts || {}, value = Number.isFinite(seconds) ? seconds : 0;
    // 纳秒精度消除 96.2 % 96 与 .2 的浮点尾差，回拨同一拍给出相同数组。
    var t = Math.round((((value % 96) + 96) % 96) * 1e9) / 1e9;
    if (t === 96) t = 0;
    var sites = launchSites(options.city), phase = t < 24 ? 'ensemble' : t < 72 ? 'weave' : t < 94 ? 'finale' : 'rest';
    var result = { items: [], sites: sites, activeSites: [], shells: [], lights: [], duration: 96, seconds: t, phase: phase };
    var festival = clamp01(options.festival);
    if (festival <= 0 || !sites.length) return result;
    var lightSums = [];
    function accumulateLight(siteIndex, particles, scale) {
      if (!particles || !particles.length) return;
      var light = lightSums[siteIndex];
      if (!light) light = lightSums[siteIndex] = { siteId: sites[siteIndex].id, x: 0, y: 0, z: 0, energy: 0, r: 0, g: 0, b: 0 };
      for (var j = 0; j < particles.length; j++) {
        var point = particles[j], weight = point[7] * scale;
        light.energy += weight;
        light.x += point[0] * weight; light.y += point[1] * weight; light.z += point[2] * weight;
        light.r += point[8] * weight; light.g += point[9] * weight; light.b += point[10] * weight;
      }
    }
    var schedule = townSchedule(options.seed == null ? 20260818 : options.seed, options.shape);
    for (var i = 0; i < schedule.length; i++) {
      var event = schedule[i];
      if (t < event.fireTime || t >= event.endTime) continue;
      var site = sites[event.site], age = t - event.fireTime;
      var particleOptions = { origin: site, festival: festival, glyphBasis: options.glyphBasis };
      var particles = comet(event.sh, age, particleOptions), sparks = burst(event.sh, age, particleOptions);
      // Light follows the burning stars, including their moving centre and colour.
      // A weak rising comet precedes the bloom; spent sparks leave no light behind.
      // Normalise each burst by its complete fuel count so density is not wattage.
      accumulateLight(event.site, particles, .035);
      accumulateLight(event.site, sparks, 1 / event.sh.shape.particles);
      if (sparks) Array.prototype.push.apply(particles, sparks);
      var particleStart = result.items.length;
      Array.prototype.push.apply(result.items, particles);
      result.shells.push(Object.assign({}, event.sh, { siteId: site.id, fireTime: event.fireTime, endTime: event.endTime,
        particleStart: particleStart, particleCount: particles.length }));
      if (result.activeSites.indexOf(site.id) < 0) result.activeSites.push(site.id);
    }
    lightSums.forEach(function (light) {
      if (light.energy <= 0) return;
      light.x /= light.energy; light.y /= light.energy; light.z /= light.energy;
      light.r /= light.energy; light.g /= light.energy; light.b /= light.energy;
      result.lights.push(light);
    });
    return result;
  }

  // The main town has a nightly show, independent of the legacy holiday preview.
  // This window is also consumed by the shared rooftop searchlight controller.
  var NIGHT_WINDOW = Object.freeze({ from: 1140, to: 1320 });
  var nightlyClock = root.CityDailyClock || (typeof require === 'function' ? require('./city-life-ext/daily-clock.js') : null);
  function nightlyState(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return { enabled: false, minute: 0, seconds: 0, day: 1 };
    var clock = nightlyClock || root.CityDailyClock, spm = clock ? clock.SECONDS_PER_SIM_MINUTE : .625;
    var total = Math.floor(seconds / spm), minute = total % 1440, day = Math.floor(total / 1440) + 1;
    var elapsed = seconds - (day - 1) * 1440 * spm - NIGHT_WINDOW.from * spm;
    var phase = Math.round((((elapsed % 96) + 96) % 96) * 1e9) / 1e9;
    return { enabled: minute >= NIGHT_WINDOW.from && minute < NIGHT_WINDOW.to, minute: minute, seconds: phase === 96 ? 0 : phase, day: day };
  }
  function towerLaunchPlan(city) {
    return ['t-one', 't-two', 't-three', 't-four'].flatMap(function (id, index) {
      var host = (city.buildings || []).find(function (b) { return b.ledgerId === id; });
      if (!host) return [];
      var height = host.floorHeight || 6, cut = host.floors >= 15 ? Math.floor(host.floors * .74) : host.floors;
      var nozzles = [];
      [Math.max(3, Math.floor(cut * .36)), Math.max(5, cut - 1), host.floors].forEach(function (floor, band) {
        var w = host.w * (band === 2 && cut < host.floors ? .8 : 1), d = host.d * (band === 2 && cut < host.floors ? .86 : 1);
        for (var axis = 0; axis < 2; axis++) for (var side = -1; side <= 1; side += 2) for (var end = -1; end <= 1; end += 2) {
          var local = axis === 0 ? [side * (w / 2 + .4), 1.4 + floor * height + .35, end * d * .29]
            : [end * w * .29, 1.4 + floor * height + .35, side * (d / 2 + .4)];
          nozzles.push({ band: band, local: local, normal: axis === 0 ? [side, 0, 0] : [0, 0, side] });
        }
      });
      return [{ host: host, index: index, nozzles: nozzles }];
    });
  }
  function towerJets(seconds, plan, seed) {
    var result = { items: [], jets: [], lights: [] }, sums = Object.create(null), slot = Math.floor(seconds / 8);
    var tower = plan.find(function (p) { return p.index === slot % 4; });
    if (!tower || slot >= 12) return result;
    tower.nozzles.forEach(function (n, nozzleIndex) {
      var fireTime = slot * 8 + .25 + n.band * .8, age = seconds - fireTime;
      if (age < 0 || age >= 1.94) return;
      var origin = [tower.host.x + n.local[0], n.local[1], tower.host.z + n.local[2]], start = result.items.length;
      var colour = TOWN_COLORS[(tower.index * 2 + n.band * 2 + 5) % TOWN_COLORS.length];
      var rand = randomGenerator((seed ^ Math.imul(slot + 1, 73856093) ^ Math.imul(nozzleIndex + 1, 19349663)) >>> 0);
      for (var star = 0; star < 4; star++) {
        var spread = (rand() - .5) * 8, speed = 20 + rand() * 5, lift = 12 + rand() * 5, phase = rand() * TAU;
        for (var tail = 0; tail < 2; tail++) {
          var t = age - star * .08 - tail * .045;
          if (t < 0 || t >= 1.7) continue;
          var v = (tail ? .84 : 1), flight = townFlight(t,
            (n.normal[0] * speed - n.normal[2] * spread) * v, lift * v,
            (n.normal[2] * speed + n.normal[0] * spread) * v, tail ? 1.65 : .9);
          var brightness = (tail ? .32 : .85) * Math.pow(1 - t / 1.7, 1.35) * (.9 + .1 * Math.sin(t * 27 + phase));
          var size = tail ? .095 : .13;
          var point = [origin[0] + flight[0], origin[1] + flight[1], origin[2] + flight[2], size, size, size, 0,
            brightness, colour.r, colour.g, colour.b, flight[3], flight[4], flight[5]];
          result.items.push(point);
          // Separate face centroids remain outside the facade, so their flash can
          // illuminate the wall instead of originating inside the tower.
          var key = n.normal.join(','), sum = sums[key];
          if (!sum) sum = sums[key] = { siteId: 'tower:' + tower.host.ledgerId, face: key, x: 0, y: 0, z: 0, energy: 0, r: colour.r, g: colour.g, b: colour.b };
          var weight = brightness / 8;
          sum.energy += weight; sum.x += point[0] * weight; sum.y += point[1] * weight; sum.z += point[2] * weight;
        }
      }
      if (result.items.length > start) result.jets.push({ hostId: tower.host.id, ledgerId: tower.host.ledgerId,
        band: n.band, fireTime: fireTime, origin: origin, normal: n.normal.slice(), particleStart: start, particleCount: result.items.length - start });
    });
    Object.values(sums).forEach(function (sum) { sum.x /= sum.energy; sum.y /= sum.energy; sum.z /= sum.energy; result.lights.push(sum); });
    return result;
  }
  function nightlyShow(seconds, opts) {
    var options = opts || {}, state = nightlyState(seconds), city = options.city;
    var empty = { ...state, items: [], sites: [], activeSites: [], shells: [], lights: [], towerJets: [], duration: 96, phase: 'off' };
    if (!state.enabled || !city || (Number.isFinite(options.constructionTime) && options.constructionTime < city.duration)) return empty;
    var seed = options.seed == null ? 20260818 : options.seed;
    var town = townShow(state.seconds, { ...options, festival: 1 });
    var jets = towerJets(state.seconds, options.towerPlan || towerLaunchPlan(city), seed);
    var count = Math.min(town.items.length, TOWN_SHOW.maxParticles - jets.items.length), selected = [], ranges = town.shells.map(function () { return 0; }), shellIndex = 0;
    for (var i = 0; i < count; i++) {
      var index = Math.floor(i * town.items.length / count);
      while (shellIndex + 1 < town.shells.length && index >= town.shells[shellIndex].particleStart + town.shells[shellIndex].particleCount) shellIndex++;
      ranges[shellIndex]++; selected.push(town.items[index]);
    }
    var offset = 0, shells = town.shells.map(function (sh, index) {
      var next = { ...sh, particleStart: offset, particleCount: ranges[index] }; offset += ranges[index]; return next;
    }).filter(function (sh) { return sh.particleCount > 0; });
    jets.jets.forEach(function (jet) { jet.particleStart += count; });
    var lights = town.lights.concat(jets.lights).sort(function (a, b) { return b.energy - a.energy || a.siteId.localeCompare(b.siteId) || (a.face || '').localeCompare(b.face || ''); }).slice(0, 8);
    return { ...town, ...state, items: selected.concat(jets.items), shells: shells, lights: lights, towerJets: jets.jets };
  }

  var api = {
    NIGHT_WINDOW: NIGHT_WINDOW,
    nightlyState: nightlyState,
    nightlyShow: nightlyShow,
    towerLaunchPlan: towerLaunchPlan,
    TOWN_SHOW: TOWN_SHOW,
    TOWN_PHYSICS: TOWN_PHYSICS,
    townAscent: townAscent,
    SITE_LAYOUT: SITE_LAYOUT,
    launchSites: launchSites,
    sitePreviewTime: sitePreviewTime,
    townShow: townShow,
    SHAPES: SHAPES,
    PALETTES: PALETTES,
    ACTS: ACTS,
    WINDOW: WINDOW,
    GOLDEN: GOLDEN,
    isActive: isActive,
    actAt: actAt,
    actIntensity: actIntensity,
    ascentHeight: ascentHeight,
    ascentSpeed: ascentSpeed,
    ascentDrift: ascentDrift,
    ascentApexTime: ascentApexTime,
    ascentApex: ascentApex,
    ascentCeiling: ascentCeiling,
    update: update,
    update2d: update2d,
    script: script,
    shell: shell,
    burst: burst
  };

  root.CityFireworks = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
