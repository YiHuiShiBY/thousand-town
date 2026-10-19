/* 千人小镇 · 平面图集（atlas.html 的数据与交互）
 *
 * 目的：给镇上每条街、每栋楼、每个摆件一个稳定编号和名字，改东西时能点名定位。
 * 数据全部来自现有模块的同一条构建管线（与 sketch.js / map-edges 测试一致），
 * 路灯、摊位、座椅等只在渲染器里存在的摆件从右侧 iframe 的 cityStudio 实时读取。
 * 街道与桥的名字是初版提案——只改下面 NAMES 一张表即可全页生效。 */
(function () {
  'use strict';
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ---------- 命名表（唯一的改名入口） ----------
   * 道路分段是自动的：横街每半条在大道中线切成 西2|西1|东1|东2（1段靠河、2段向外，
   * 路口归街道），大道按五条横街切成 北3|北2|北1|南1|南2|南3（1段近镇中心）。
   * 这里只改基础名，段的编号与边界由 drawRoads/lampGroupOf 按 city.roads 推导。 */
  var NAMES = {
    streets: [
      { z: -160, code: 'E1', name: '北环路' },
      { z: -80, code: 'E2', name: '北大街' },
      { z: 0, code: 'E3', name: '中街' },
      { z: 80, code: 'E4', name: '南大街' },
      { z: 160, code: 'E5', name: '南环路' }
    ],
    avenues: [
      { x: -175, code: 'N3', name: '西环路' },
      { x: -96, code: 'N1', name: '西堤大道' },
      { x: 96, code: 'N2', name: '东堤大道' },
      { x: 175, code: 'N4', name: '东环路' }
    ],
    bridges: [
      { z: -80, code: 'B1', name: '北桥' },
      { z: 80, code: 'B2', name: '南桥' },
      { z: -40, code: 'B3', name: '北月桥', ped: true },
      { z: 40, code: 'B4', name: '南月桥', ped: true }
    ],
    expressways: [
      { z: -245, code: 'X1', name: '北外环快速路' },
      { z: 245, code: 'X2', name: '南外环快速路' }
    ],
    tunnels: [
      { z: -160, code: 'S1', name: '北环隧道' },
      { z: 160, code: 'S2', name: '南环隧道' }
    ],
    canal: { code: 'W1', name: '贯城河' },
    promenade: { code: 'P1', name: '滨河步道' },
    towers: { 't-one': '一号写字楼', 't-two': '二号写字楼', 't-three': '三号写字楼', 't-four': '四号写字楼' },
    rings: [
      { key: 0, code: 'R1', name: '车行内环' },
      { key: 1, code: 'R2', name: '车行外环' },
      { key: 2, code: 'R4', name: '贯城环' },
      { key: 3, code: 'R5', name: '快速外环' },
      { key: 'rider', code: 'R3', name: '骑行环' }
    ]
  };
  var LOT_XS = [-132, -60, 60, 132], LOT_ZS = [-200, -120, -40, 40, 120, 200];
  var savedNames = CityResidentNames.loadRoster(function () { return localStorage; });
  // Appearance preferences must not prevent name management from opening when
  // browser storage is disabled. Roster writes report errors through their own API.
  function readPreference(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function writePreference(key, value) {
    try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch (e) { /* Keep this session's appearance. */ }
  }

  /* ---------- 小镇构建（与 tests/map-edges.test.cjs 同一条管线） ---------- */
  function buildTown(seed) {
    var settings = { density: .8, skyline: 1, housing: true, playground: true };
    var city = CityLayout.apply(CityHousingPlan.decorate(CityPlaces.decorate(
      CityFacilities.decorate(CityModel.createCity(seed, settings))), {}), CityLayout.normalize(null));
    // sketch.js:126 在同一条管线之后挂 waterfront（摊位规划与办事处位置的唯一来源）；
    // 图集复刻同一行，保证与主视图逐点一致。
    if (CityWaterfront && CityWaterfront.plan) {
      city.waterfront = { stalls: CityWaterfront.plan(city), civic: CityWaterfront.civicSite(city) };
    }
    var town = CityResidents.create({ seed: city.seed, roster: savedNames.roster });
    if (CityLighting && CityLighting.bindBuildings) CityLighting.bindBuildings(city, town.buildings);
    return { city: city, town: town };
  }

  var seed = (function () {
    var raw = new URLSearchParams(location.search).get('seed');
    return raw && /^\d{1,10}$/.test(raw) ? Number(raw) : 20260818;
  })();
  var built = buildTown(seed);
  var city = built.city, town = built.town;
  var rowsById = {};
  town.buildings.forEach(function (row) { rowsById[row.id] = row; });

  /* ---------- Residents: 只读花名册（导入/编辑/保存等写入口已按站内展示需求移除） ---------- */
  var namesDialog = document.getElementById('resident-names-dialog');
  var nameStatus = document.getElementById('names-status'), nameRows = document.getElementById('names-rows');
  var nameSearch = document.getElementById('names-search'), nameSummary = document.getElementById('names-summary');
  var nameList = document.getElementById('names-list');
  var previewResidents = [];
  var ROLE_NAMES = {'preschooler':'学龄前儿童','student-p':'小学生','student-m':'中学生','student-u':'大学生',office:'职员',worker:'工人',shopkeeper:'店主',driver:'司机',teacher:'教师','school-admin':'学校行政','medical-doc':'医生','medical-nurse':'护士','hosp-admin':'医院行政',officer:'警员',clerk:'办事员',sanitation:'环卫人员',unemployed:'待业居民',patient:'住院居民',retiree:'退休居民',senior:'长者'};
  var HOME_NAMES = {'h-courtyard':'庭院住宅','h-slab':'花园板楼','h-terrace':'退台公寓','h-point':'双塔住区','c-hospital':'社区医院'};
  function nameText(tag, text) { var node = document.createElement(tag); node.textContent = text; return node; }
  function namesMessage(text, error) { nameStatus.textContent = text; nameStatus.classList.toggle('is-error', !!error); }
  function updateNameBadge() {
    document.getElementById('resident-names-count').textContent = savedNames.error ? '读取异常' : savedNames.roster.length ? savedNames.roster.length + ' 人' : '系统';
    document.getElementById('resident-names-open').dataset.warning = String(!!savedNames.error);
    nameList.replaceChildren();
    [{ id: 'system', label: '系统默认姓名', roster: town.residents }].concat(savedNames.lists).forEach(function (list) {
      var button = document.createElement('button'); button.type = 'button'; button.className = 'names-card';
      button.dataset.roster = list.id; button.setAttribute('aria-pressed', String(list.id === savedNames.activeId));
      button.appendChild(nameText('strong', list.label));
      button.appendChild(nameText('span', list.roster.length + ' 人 · ' + (list.id === savedNames.activeId ? '正在使用' : '点击查看')));
      button.addEventListener('click', function () { switchSavedNames(list.id); }); nameList.appendChild(button);
    });
  }
  function renderNameRows() {
    var query = nameSearch.value.trim().toLowerCase();
    var rows = previewResidents.filter(function (r) { return !query || r.name.toLowerCase().includes(query) || r.id.toLowerCase().includes(query); });
    var fragment = document.createDocumentFragment();
    rows.forEach(function (r) {
      var row = document.createElement('tr'); row.dataset.resident = r.id;
      [r.name, r.id, ROLE_NAMES[r.role] || r.role, HOME_NAMES[r.home] || r.home].forEach(function (value) { row.appendChild(nameText('td', value)); });
      fragment.appendChild(row);
    });
    nameRows.replaceChildren(fragment);
    var empty = document.getElementById('names-empty'); empty.hidden = rows.length > 0;
    empty.textContent = previewResidents.length ? '没有匹配的姓名或居民编号。' : '暂无居民数据。';
  }
  function switchSavedNames(id) {
    var result = CityResidentNames.selectRoster(function () { return localStorage; }, id, town.residents.length);
    if (!result.ok) { namesMessage(result.error, true); return; }
    refreshStoredNames();
    namesDialog.scrollTop = 0;
    if (id === 'system') namesMessage('已切换到系统默认姓名。');
    var api = studio(); if (api && api.refreshResidentNames) api.refreshResidentNames();
  }
  function refreshStoredNames() {
    savedNames = CityResidentNames.loadRoster(function () { return localStorage; }, town.residents.length);
    var next = CityResidents.create({ seed: town.seed, roster: savedNames.roster });
    CityResidentNames.copyNameFields(town, next); updateNameBadge();
    previewResidents = savedNames.roster.length ? town.residents.filter(function (r) { return r.fan; }) : town.residents;
    renderNameRows();
    nameSummary.textContent = savedNames.roster.length ? '当前已应用 ' + savedNames.roster.length + ' 个姓名。' : '共 ' + town.residents.length + ' 位居民，全部使用系统姓名。';
    namesMessage(savedNames.error || '', !!savedNames.error);
  }
  nameSearch.addEventListener('input', renderNameRows);
  document.getElementById('resident-names-open').addEventListener('click', function () {
    refreshStoredNames();
    namesDialog.showModal();
  });
  document.getElementById('names-close').addEventListener('click', function () { namesDialog.close(); });
  window.addEventListener('storage', function (event) {
    if (event.key === CityResidentNames.STORAGE_KEY || event.key === CityResidentNames.LEGACY_STORAGE_KEY || event.key === null) refreshStoredNames();
  });
  document.getElementById('atlas-main-view').href = './index.html?seed=' + town.seed;
  refreshStoredNames();

  /* ---------- SVG 工具与目录 ---------- */
  var svg = document.getElementById('plan');
  var tooltip = document.getElementById('plan-tooltip');
  var CATALOG = [];   // {code,name,kind,x,z,ledger,lines[]}
  var byCode = {};

  function el(tag, attrs, parent) {
    var node = document.createElementNS(SVGNS, tag);
    for (var key in attrs) node.setAttribute(key, attrs[key]);
    (parent || svg).appendChild(node);
    return node;
  }
  function pad(number, width) {
    var text = String(number);
    while (text.length < width) text = '0' + text;
    return text;
  }
  function register(entry, node) {
    entry.el = node;
    node.setAttribute('data-code', entry.code);
    CATALOG.push(entry);
    byCode[entry.code] = entry;
    return entry;
  }
  function buildingName(building) {
    if (building.name) return building.name;
    var row = rowsById[building.ledgerId];
    if (row && row.kind === 'tower') return NAMES.towers[row.id] || row.id;
    if (building.label) return building.label;
    return building.ledgerId || building.kind || '建筑';
  }
  function lotOf(building) {
    for (var row = 0; row < 6; row++) for (var col = 0; col < 4; col++) {
      var lx = LOT_XS[col], lz = LOT_ZS[row];
      if (Math.abs(building.x - lx) < 33 && Math.abs(building.z - lz) < 36) return { no: row * 4 + col + 1, x: lx, z: lz };
    }
    return null;
  }
  var KIND_CN = { glass: '玻璃塔楼', sand: '沙色楼', stone: '石面楼', housing: '住宅', facility: '公共设施' };
  function openCN(policy) { return policy === 'weekday' ? '工作日' : policy === 'sat-am' ? '工作日+周六上午' : '每天'; }

  /* ---------- 分层绘制 ---------- */
  var layers = {};
  function layer(name) {
    if (!layers[name]) layers[name] = el('g', { id: 'layer-' + name });
    return layers[name];
  }

  function drawBase() {
    el('rect', { x: -190, y: -258, width: 380, height: 516, fill: '#141a22', stroke: '#2a3543', 'stroke-width': .8 });
    // 地块网格（参考虚线；边界是近似值，以建筑摆放为准）
    var grid = layer('lots');
    for (var row = 0; row < 6; row++) for (var col = 0; col < 4; col++) {
      var lx = LOT_XS[col], lz = LOT_ZS[row], no = row * 4 + col + 1;
      var rect = el('rect', { x: lx - 33, y: lz - 36, width: 66, height: 72, fill: 'none', stroke: '#3a4654', 'stroke-width': .35, 'stroke-dasharray': '2 2.4' }, grid);
      var lotEntry = register({ code: 'B' + pad(no, 2), name: '地块 ' + pad(no, 2), kind: '地块', x: lx, z: lz,
        lines: ['第 ' + (row + 1) + ' 行 · 第 ' + (col + 1) + ' 列', '坐标 (' + lx + ', ' + lz + ')'] }, rect);
      lotEntry.lot = { row: row, col: col };
      el('text', { x: lx - 31, y: lz - 32.5, 'class': 'lot-label' }, grid).textContent = 'B' + pad(no, 2);
    }
    // 水系
    var water = el('rect', { x: -15, y: -258, width: 30, height: 516, fill: '#22405a', stroke: '#31506e', 'stroke-width': .5 });
    register({ code: NAMES.canal.code, name: NAMES.canal.name, kind: '水系', x: 0, z: 0, lines: ['宽 30 · 贯穿全盘（z=-258…258）', '两岸 z=±40 各一座人行桥，z=±80 车行桥'] }, water);
    // 滨河步道（两片示意）
    [-1, 1].forEach(function (side) {
      var walk = el('rect', { x: side > 0 ? 7.5 : -23, y: -258, width: 15.5, height: 516, fill: '#26313d', opacity: .8 });
      register({ code: NAMES.promenade.code, name: NAMES.promenade.name + (side > 0 ? '（东岸）' : '（西岸）'), kind: '步道', x: side * 15, z: 0, lines: ['x ∈ ' + (side > 0 ? '[7.5, 23]' : '[-23, -7.5]'), 'z ∈ [-258, 258]'] }, walk);
    });
  }

  var SEG_CN = { W2: '西2段', W1: '西1段', E1: '东1段', E2: '东2段',
    N3: '北3段', N2: '北2段', N1: '北1段', S1: '南1段', S2: '南2段', S3: '南3段' };
  // 分段规则：横街每半条在大道中线（x=±96）切成两段，1段靠河、2段向外，路口归街道；
  // 大道按五条横街切成六段，1段近镇中心，向北/南依次 2、3 段（z 的路界取街缘 ±6）。
  function streetSegment(x) { return x < 0 ? (x < -96 ? 'W2' : 'W1') : (x > 96 ? 'E2' : 'E1'); }
  function avenueSegment(z) { return z < -166 ? 'N3' : z < -86 ? 'N2' : z < -6 ? 'N1' : z < 86 ? 'S1' : z < 166 ? 'S2' : 'S3'; }

  function drawRoads() {
    var group = layer('roads');
    // 底层铺装：整块路面不带编号，点击与悬停都落在其上的分段热区。
    city.roads.forEach(function (road) {
      el('rect', { x: road.x - road.w / 2, y: road.z - road.d / 2, width: road.w, height: road.d,
        fill: '#333b44', stroke: '#46515e', 'stroke-width': .3 }, group);
      // 中街步行段：与场景同一决议，带内画成人行道色。
      if (road.walkOnlyTo) [-1, 1].forEach(function (side) {
        el('rect', { x: side === -1 ? -road.walkOnlyTo : 15, y: road.z - road.d / 2,
          width: road.walkOnlyTo - 15, height: road.d, fill: '#4a4f52' }, group);
      });
    });
    var AVENUE_X = 96, STREET_EDGE = 6, CANAL_EDGE = 15;
    // 横街分段（每条 4 段）。快速路接地段（z=±245）不是横街，走下方快速路条目。
    // 外沿取实际路矩形：大街与快速路接地段到板边（195），中街与北/南环路止于
    // 环路外沿（180，2026-09-21 拍板：不再连接市外）。
    city.roads.filter(function (road) {
      return road.axis === 'x' && NAMES.streets.some(function (item) { return item.z === road.z; });
    }).forEach(function (road) {
      var def = NAMES.streets.reduce(function (best, item) { return Math.abs(item.z - road.z) < Math.abs(best.z - road.z) ? item : best; });
      var west = road.x < 0;
      var outer = Math.abs(road.x) + road.w / 2;
      var closedNote = road.closed ? ' · 止于环路，不接市外' : '';
      var bands = west ? [[-outer, -AVENUE_X, 'W2'], [-AVENUE_X, -CANAL_EDGE, 'W1']]
                       : [[CANAL_EDGE, AVENUE_X, 'E1'], [AVENUE_X, outer, 'E2']];
      bands.forEach(function (band) {
        var code = '街-' + def.code + band[2], cn = SEG_CN[band[2]];
        var rect = el('rect', { x: band[0], y: road.z - STREET_EDGE, width: band[1] - band[0], height: STREET_EDGE * 2,
          fill: '#3b444e', stroke: '#46515e', 'stroke-width': .3, 'class': 'b-rect' }, group);
        register({ code: code, name: def.name + cn, kind: '道路段', x: (band[0] + band[1]) / 2, z: road.z,
          lines: ['东西向 · z=' + road.z + ' · x ∈ [' + band[0] + ', ' + band[1] + ']',
            (road.walkOnlyTo && (band[2] === 'W1' || band[2] === 'E1')
              ? '步行街 · 行人优先，已去车道（2026-09-21 拍板）'
              : '1段靠河（城内），2段向外（出城方向）') + closedNote,
            '宽 12 · ' + (west ? '西半幅' : '东半幅')] }, rect);
        var label = el('text', { x: (band[0] + band[1]) / 2, y: road.z - 7.4, 'class': 'segment-label', 'text-anchor': 'middle' }, layer('labels'));
        label.textContent = def.name + cn;
      });
    });
    // 大道分段（每条 6 段）
    city.roads.filter(function (road) { return road.axis === 'z'; }).forEach(function (road) {
      var def = NAMES.avenues.reduce(function (best, item) { return Math.abs(item.x - road.x) < Math.abs(best.x - road.x) ? item : best; });
      var bands = [[-258, -166, 'N3'], [-166, -86, 'N2'], [-86, -6, 'N1'], [6, 86, 'S1'], [86, 166, 'S2'], [166, 258, 'S3']];
      bands.forEach(function (band) {
        var code = '街-' + def.code + band[2], cn = SEG_CN[band[2]];
        var rect = el('rect', { x: road.x - road.w / 2, y: band[0], width: road.w, height: band[1] - band[0],
          fill: '#3b444e', stroke: '#46515e', 'stroke-width': .3, 'class': 'b-rect' }, group);
        register({ code: code, name: def.name + cn, kind: '道路段', x: road.x, z: (band[0] + band[1]) / 2,
          lines: ['南北向 · x=' + road.x + ' · z ∈ [' + band[0] + ', ' + band[1] + ']',
            '1段近镇中心，向北/南依次 2、3 段', '宽 10'] }, rect);
        var label = el('text', { x: road.x + 3.5, y: (band[0] + band[1]) / 2, 'class': 'segment-label', 'text-anchor': 'middle',
          transform: 'rotate(-90 ' + (road.x + 3.5) + ' ' + ((band[0] + band[1]) / 2) + ')' }, layer('labels'));
        label.textContent = def.name + cn;
      });
    });
    // 桥
    NAMES.bridges.forEach(function (def) {
      var bridge = city.bridges.filter(function (b) { return b.z === def.z; })[0];
      if (!bridge) return;
      var rect = el('rect', { x: -bridge.w / 2, y: bridge.z - bridge.d / 2, width: bridge.w, height: bridge.d, fill: '#4b5663', stroke: '#6a7887', 'stroke-width': .5 }, group);
      register({ code: '桥-' + def.code, name: def.name, kind: def.ped ? '人行桥' : '车行桥', x: 0, z: bridge.z,
        lines: ['宽 ' + bridge.w + ' · 深 ' + bridge.d, def.ped ? '仅行人通过' : '车辆 · 骑手 · 行人'] }, rect);
      el('text', { x: 26, y: bridge.z + 2, 'class': 'lot-label' }, layer('labels')).textContent = def.name;
    });
    // 外环快速路（V4）：一条走廊画一条——中段高架（虚线框）+ 两端接地段（底层
    // 铺装已画）。数据行只写 city.viaducts 的纵断数与走廊长度，不另存坐标。
    (city.viaducts || []).forEach(function (viaduct) {
      var def = NAMES.expressways.reduce(function (best, item) {
        return Math.abs(item.z - viaduct.z) < Math.abs(best.z - viaduct.z) ? item : best;
      });
      var rect = el('rect', { x: -(viaduct.flatX + viaduct.rampX), y: viaduct.z - 6,
        width: (viaduct.flatX + viaduct.rampX) * 2, height: 12,
        fill: '#55606e', stroke: '#7d8a99', 'stroke-width': .5, 'stroke-dasharray': '6 2.5', 'class': 'b-rect' }, group);
      register({ code: '速-' + def.code, name: def.name, kind: '快速路', x: 0, z: viaduct.z,
        lines: ['东西向走廊 · z=' + viaduct.z + ' · 高架段 |x| ≤ ' + viaduct.flatX + '，引桥落至 |x|=' + (viaduct.flatX + viaduct.rampX),
          '净高 ' + (viaduct.height - .25).toFixed(2) + '（路面基准 .25 之上）· 跨西堤大道 / 河面 / 东堤大道',
          '接地段接西环路 / 东环路路口，出板边收尾',
          '临城侧沿满高段六色灯带（自持夜光，12 单位一段循环）'] }, rect);
      el('text', { x: -118, y: viaduct.z - 8.5, 'class': 'segment-label', 'text-anchor': 'middle' }, layer('labels')).textContent = def.name;
    });
    // 隧道（V4）：环路的穿河暗埋段。图上画盖板带（虚线框＝顶面是人行道），
    // 数据行写出纵断三数，与 city.tunnels 一处同源。
    (city.tunnels || []).forEach(function (tunnel) {
      var def = NAMES.tunnels.reduce(function (best, item) { return Math.abs(item.z - tunnel.z) < Math.abs(best.z - tunnel.z) ? item : best; });
      var deck = el('rect', { x: -tunnel.coverX, y: tunnel.z - 9.5, width: tunnel.coverX * 2 - 34, height: 19,
        fill: '#3f4a55', stroke: '#5d6b7a', 'stroke-width': .4, 'stroke-dasharray': '3 2', 'class': 'b-rect' }, group);
      register({ code: '隧-' + def.code, name: def.name, kind: '车行隧道', x: 0, z: tunnel.z,
        lines: ['暗埋段 |x| ≤ ' + tunnel.coverX + ' · 路面沉至 ' + (0.25 - tunnel.drop),
          '洞口 x=±' + tunnel.portalX + ' · 过堤大道后开始下沉',
          '只保留隧道 · 河面下顶板沉入水下，无步道过河（行人走 ±40 月桥 / ±80 车桥）'] }, deck);
      el('text', { x: -13, y: tunnel.z + 2.5, 'class': 'lot-label' }, layer('labels')).textContent = def.name;
    });
  }

  function drawBuildings() {
    var group = layer('buildings');
    var labelCount = {};
    city.buildings.forEach(function (building) {
      var row = rowsById[building.ledgerId];
      var code = building.ledgerId || ('map-' + building.x + '/' + building.z);
      var name = buildingName(building);
      labelCount[name] = (labelCount[name] || 0) + 1;
      var displayName = labelCount[name] > 1 ? name + '·' + code : name;
      var fill = building.kind === 'glass' ? '#6da9c4' : building.housing ? '#b99a63'
        : building.name ? '#7fae85' : '#8d99a3';
      var rect = el('rect', { x: building.x - building.w / 2, y: building.z - building.d / 2, width: building.w, height: building.d,
        fill: fill, stroke: 'rgba(255,255,255,.28)', 'stroke-width': .4, rx: 1.2, 'class': 'b-rect' }, group);
      var lot = lotOf(building);
      var lines = [
        '类型 ' + (KIND_CN[building.kind] || building.kind) + (building.facility ? ' · ' + building.facility : ''),
        '位置 (' + building.x + ', ' + building.z + ') · ' + building.w + '×' + building.d + ' · ' + building.floors + ' 层'
      ];
      if (row) lines.unshift('台账 ' + row.kind + ' · 容量 ' + row.capacity + ' · 营业 ' + openCN(row.open));
      if (lot) lines.push('所在地块 B' + pad(lot.no, 2));
      var entry = register({ code: code, name: displayName, kind: '建筑', x: building.x, z: building.z, ledger: !!row, lines: lines }, rect);
      entry.building = building;
      var label = el('text', { x: building.x, y: building.z + 2, 'class': 'building-label', 'text-anchor': 'middle' }, group);
      label.textContent = building.w > 34 ? displayName : code;
    });
    // 场所：车站 / 游乐场 / 广场。台账里都有对应行（c-station / c-amusement /
    // c-plaza），条目直接绑台账 id，点击走主视图的门口特写机位。
    var rowByKind = {};
    town.buildings.forEach(function (row) { if (!rowByKind[row.kind]) rowByKind[row.kind] = row; });
    (city.places || []).forEach(function (place, index) {
      var row = rowByKind[place.kind];
      var code = row ? row.id : '场所-' + pad(index + 1, 2);
      var rect = el('rect', { x: place.x - place.w / 2, y: place.z - place.d / 2, width: place.w, height: place.d,
        fill: '#8d7fae', stroke: '#b3a3d6', 'stroke-width': .5, 'stroke-dasharray': '4 2.5', rx: 1.5, 'class': 'b-rect' }, group);
      var lines = [];
      if (row) lines.push('台账 ' + row.kind + ' · 容量 ' + row.capacity + ' · 营业 ' + openCN(row.open));
      lines.push(place.label + ' · ' + place.kind, '位置 (' + place.x + ', ' + place.z + ') · ' + place.w + '×' + place.d);
      var entry = register({ code: code, name: place.name || place.label || code, kind: '场所 · ' + (place.label || place.kind),
        x: place.x, z: place.z, ledger: !!row, lines: lines }, rect);
      el('text', { x: place.x, y: place.z + 2, 'class': 'building-label', 'text-anchor': 'middle', fill: '#b3a3d6' }, group).textContent = place.name || place.label;
    });
    // 公园与游乐场：公园 1/2 有台账行（c-park-a 绑地块 5、c-park-b 绑地块 12，
    // 与 town-view.js 的 parkSources 同源），按地块索引反查；体育公园无台账，
    // 点击走特写级俯视（跑道与球场充满画面）。
    city.parks.forEach(function (park, index) {
      var lot = lotOf(park), lotIndex = lot ? lot.no - 1 : -1;
      var row = lotIndex === 4 ? rowsById['c-park-a'] : lotIndex === 11 ? rowsById['c-park-b'] : null;
      var rect = el('rect', { x: park.x - park.w / 2, y: park.z - park.d / 2, width: park.w, height: park.d,
        fill: '#2c4a35', stroke: '#3f6b4c', 'stroke-width': .5, 'stroke-dasharray': '3 2' }, group);
      var isSports = park.use === 'sports';
      var name = isSports ? '体育公园（含游乐场）' : '公园 ' + (index + 1);
      var lines = [];
      if (row) lines.push('台账 ' + row.kind + ' · 容量 ' + row.capacity, '所在地块 B' + pad(lot.no, 2));
      lines.push(isSports ? 'use=sports · 跑道与球场' : '草坪与环园步道', '位置 (' + park.x + ', ' + park.z + ') · ' + park.w + '×' + park.d);
      var entry = register({ code: row ? row.id : 'G' + pad(index + 1, 2), name: name, kind: '公园', x: park.x, z: park.z,
        ledger: !!row, grade: isSports ? [4.5, .85] : null, lines: lines }, rect);
      el('text', { x: park.x, y: park.z + 2, 'class': 'building-label', 'text-anchor': 'middle', fill: '#7fae85' }, group).textContent = name;
    });
  }

  /* 合署体与河畔办事处：位置全部取自权威接口——CityFacilities.annexSites(city)
   * 与 city.waterfront.civic，不在图集侧存第二份坐标（AGENTS.md 硬约束）。 */
  function drawAnnexes() {
    var group = layer('annexes');
    var sites = [];
    try { sites = CityFacilities.annexSites(city).slice(); } catch (error) { sites = []; }
    var civic = city.waterfront && city.waterfront.civic;
    if (civic) sites.push(Object.assign({ label: '便民服务' }, civic));
    sites.forEach(function (site, index) {
      var code = site.id || 'annex-' + (index + 1);
      var row = rowsById[code];
      var ground = site.footprint || { x: site.x, z: site.z, w: site.w, d: site.d };
      var rect = el('rect', { x: ground.x - ground.w / 2, y: ground.z - ground.d / 2,
        width: Math.max(3, ground.w), height: Math.max(3, ground.d),
        fill: '#d8b45a', stroke: '#f2d488', 'stroke-width': .45, rx: .6, 'class': 'b-rect' }, group);
      var host = city.buildings.filter(function (b) { return b.id === site.host; })[0];
      var lines = [
        (site.label || site.facility || site.kind || '合署体') + (row ? ' · 台账 ' + row.kind + ' · 容量 ' + row.capacity : ''),
        '位置 (' + site.x.toFixed(1) + ', ' + site.z.toFixed(1) + ') · ' + site.w + '×' + site.d,
        host ? '宿主 ' + buildingName(host) + '（' + host.id + '）· 跟随宿主移动' : '河畔独立体块'
      ];
      var entry = register({ code: code, name: site.name || site.label || code, kind: '合署配件', x: site.x, z: site.z, ledger: !!row, lines: lines }, rect);
      var label = el('text', { x: site.x, y: site.z - ground.d / 2 - 1.5, 'class': 'building-label', 'text-anchor': 'middle', fill: '#f2d488' }, group);
      label.textContent = site.name || code;
      // 命中范围放宽到 6×6，方便点中小体块
      el('rect', { x: site.x - 3, y: site.z - 3, width: 6, height: 6, fill: 'transparent', 'class': 'hit', 'data-code': code }, group);
      entry.annex = true;
    });
    return sites.length;
  }

  function drawRings() {
    var group = layer('rings');
    function ringPath(halfX, halfZ) {
      return 'M' + -halfX + ' ' + -halfZ + 'H' + halfX + 'V' + halfZ + 'H' + -halfX + 'Z';
    }
    NAMES.rings.forEach(function (def) {
      var extent = def.key === 'rider' ? city.riderLaneExtents : city.vehicleLaneExtents[def.key];
      var path = el('path', { d: ringPath(extent.halfX, extent.halfZ), fill: 'none', stroke: def.key === 'rider' ? '#9c86c9' : '#62b6cb',
        'stroke-width': .7, 'stroke-dasharray': '5 4', opacity: .75 }, group);
      register({ code: '环-' + def.code, name: def.name, kind: '车流环线', x: 0, z: 0,
        lines: ['环半宽 ' + extent.halfX + ' × ' + extent.halfZ, def.key === 'rider' ? '6 名骑手 · 靠外侧车道外沿' :
          def.key === 2 ? '每环 10 车 · 每圈过北隧道与南隧道（环路车流）' :
          def.key === 3 ? '每环 10 车 · 跑西环路/东环路，过河走北/南外环高架（V4）' : '每环 10 车 · 每圈过北桥与南桥'] }, path);
    });
  }

  function drawTrees() {
    var group = layer('trees');
    var sorted = city.trees.slice().sort(function (a, b) { return a.x - b.x || a.z - b.z; });
    sorted.forEach(function (tree, index) {
      var dot = el('circle', { cx: tree.x, cy: tree.z, r: Math.max(.8, tree.r * .18), fill: '#3d6b46' }, group);
      register({ code: '树-T' + pad(index + 1, 3), name: '树木 #' + pad(index + 1, 3), kind: '树木', x: tree.x, z: tree.z,
        lines: ['冠半径 ' + tree.r.toFixed(1), '位置 (' + tree.x + ', ' + tree.z + ')'] }, dot);
      el('circle', { cx: tree.x, cy: tree.z, r: 4.5, 'class': 'hit', 'data-code': '树-T' + pad(index + 1, 3) }, layer('hits-trees'));
    });
  }

  /* ---------- 活数据层（来自 iframe 的真实渲染结果） ---------- */
  function lampGroupOf(lamp) {
    if (lamp.axis === 'z') {
      var street = NAMES.streets.reduce(function (best, item) { return Math.abs(item.z - lamp.z) < Math.abs(best.z - lamp.z) ? item : best; });
      var seg = streetSegment(lamp.x);
      return { code: '街-' + street.code + seg, name: street.name + SEG_CN[seg], kind: 'street' };
    }
    if (Math.abs(lamp.x) < 40) return { code: 'W1', name: NAMES.canal.name + '步道', kind: 'canal' };
    var avenue = NAMES.avenues.reduce(function (best, item) { return Math.abs(item.x - lamp.x) < Math.abs(best.x - lamp.x) ? item : best; });
    var aSeg = avenueSegment(lamp.z);
    return { code: '街-' + avenue.code + aSeg, name: avenue.name + SEG_CN[aSeg], kind: 'avenue' };
  }
  function drawLamps(anchors) {
    var group = layer('lamps'), hitLayer = layer('hits-lamps');
    var groups = { canal: 0, avenue: 1, street: 2 };
    var sorted = anchors.slice().sort(function (a, b) {
      var ga = groups[lampGroupOf(a).kind], gb = groups[lampGroupOf(b).kind];
      return ga - gb || a.z - b.z || a.x - b.x;
    });
    sorted.forEach(function (lamp, index) {
      var info = lampGroupOf(lamp);
      var code = '灯-L' + pad(index + 1, 3);
      var marker = el('path', { d: 'M' + lamp.x + ' ' + (lamp.z - 2) + 'L' + (lamp.x + 2) + ' ' + lamp.z + 'L' + lamp.x + ' ' + (lamp.z + 2) + 'L' + (lamp.x - 2) + ' ' + lamp.z + 'Z',
        fill: '#e0a458', opacity: .95 }, group);
      register({ code: code, name: '路灯 ' + code, kind: '路灯', x: lamp.x, z: lamp.z,
        lines: ['所属 ' + info.name + '（' + info.code + '）', '灯头 (' + lamp.x.toFixed(1) + ', ' + lamp.z.toFixed(1) + ')' + (lamp.axis === 'z' ? ' · 沿街伸臂' : '')] }, marker);
      el('circle', { cx: lamp.x, cy: lamp.z, r: 5, 'class': 'hit', 'data-code': code }, hitLayer);
    });
    return sorted.length;
  }
  function drawStalls(footprints) {
    var group = layer('stalls'), hitLayer = layer('hits-stalls');
    var east = footprints.filter(function (f) { return f.x > 0; }).sort(function (a, b) { return a.z - b.z; });
    var west = footprints.filter(function (f) { return f.x < 0; }).sort(function (a, b) { return a.z - b.z; });
    function draw(list, tag) {
      list.forEach(function (stall, index) {
        var code = '摊-' + tag + pad(index + 1, 2);
        var rect = el('rect', { x: stall.x - stall.w / 2, y: stall.z - stall.d / 2, width: stall.w, height: stall.d,
          fill: '#c77b45', stroke: '#e8a06a', 'stroke-width': .3, rx: .6, 'class': 'b-rect' }, group);
        // 特写机位按岸别定向：相机站到运河上空看向岸线——东岸默认 yaw 即可，
        // 西岸需要 yaw=π/2（相机在正东），否则视线穿过摊位背后的楼群。
        var entry = register({ code: code, name: stall.name || code, kind: '夜市摊位', x: stall.x, z: stall.z,
          grade: tag === 'W' ? [14, .7, Math.PI / 2] : [14, .7],
          lines: [(tag === 'E' ? '东岸' : '西岸') + ' 第 ' + (index + 1) + ' 摊', '位置 (' + stall.x.toFixed(1) + ', ' + stall.z.toFixed(1) + ') · ' + stall.w + '×' + stall.d] }, rect);
        entry.ledger = false;
      });
    }
    draw(east, 'E'); draw(west, 'W');
    return footprints.length;
  }  function drawBenches(seating) {
    var group = layer('benches'), hitLayer = layer('hits-benches');
    var counter = 0;
    (seating || []).forEach(function (park, parkIndex) {
      (park.benches || []).forEach(function (bench, index) {
        counter++;
        var code = '凳-' + pad(parkIndex + 1, 2) + '-' + (index + 1);
        var rect = el('rect', { x: bench.x - bench.w / 2, y: bench.z - bench.d / 2, width: bench.w, height: bench.d,
          fill: '#7a5c3e', stroke: '#9a7852', 'stroke-width': .25 }, group);
        register({ code: code, name: '长椅 ' + code, kind: '座椅', x: bench.x, z: bench.z,
          lines: ['公园 ' + (parkIndex + 1) + ' · 第 ' + (index + 1) + ' 位', '位置 (' + bench.x.toFixed(1) + ', ' + bench.z.toFixed(1) + ')'] }, rect);
        el('circle', { cx: bench.x, cy: bench.z, r: 4.5, 'class': 'hit', 'data-code': code }, hitLayer);
      });
    });
    return counter;
  }
  function drawBins(anchors) {
    var group = layer('bins'), hitLayer = layer('hits-bins');
    var sorted = anchors.slice().sort(function (a, b) { return a.x - b.x || a.z - b.z; });
    sorted.forEach(function (can, index) {
      var code = '桶-B' + pad(index + 1, 3);
      var marker = el('rect', { x: can.x - 1.4, y: can.z - 1.4, width: 2.8, height: 2.8,
        fill: '#5d7186', stroke: '#9db3c8', 'stroke-width': .35, rx: .4, 'class': 'b-rect' }, group);
      register({ code: code, name: '垃圾桶 ' + code, kind: '垃圾桶', x: can.x, z: can.z,
        lines: ['位置 (' + can.x.toFixed(1) + ', ' + can.z.toFixed(1) + ')',
          '最近道路 ' + (function () {
            var best = null, bd = 1e9;
            city.roads.forEach(function (road) {
              var d = Math.max(Math.abs(can.x - road.x) - road.w / 2, Math.abs(can.z - road.z) - road.d / 2);
              if (d < bd) { bd = d; best = road; }
            });
            return best ? (best.axis === 'x' ? 'z=' + best.z + ' 横街' : 'x=' + best.x + ' 纵路') + '（外 ' + bd.toFixed(1) + '）' : '—';
          })()] }, marker);
      el('circle', { cx: can.x, cy: can.z, r: 4.5, 'class': 'hit', 'data-code': code }, hitLayer);
    });
    return sorted.length;
  }
  // 路面小件（2026-09-21 拍板，docs/street-props-plan.md）：公交站 6（亭 3 牌 3）、
  // 贩卖机 8、邮箱 3——全部沿用活数据层的画法与登记节奏。
  function drawBusStops(stops) {
    var group = layer('bus-stops'), hitLayer = layer('hits-bus-stops');
    var sorted = stops.slice().sort(function (a, b) { return a.x - b.x || a.z - b.z; });
    sorted.forEach(function (stop, index) {
      var code = '站-S' + pad(index + 1);
      var marker = stop.shelter
        ? el('rect', { x: stop.x - 6, y: stop.z - 1.5, width: 12, height: 3,
            fill: '#3f6d8e', stroke: '#7fa8c4', 'stroke-width': .35, rx: .6, 'class': 'b-rect' }, group)
        : el('path', { d: 'M' + (stop.x - 1.6) + ' ' + stop.z + 'L' + stop.x + ' ' + (stop.z - 2.2) + 'L' + (stop.x + 1.6) + ' ' + stop.z + 'Z',
            fill: '#3f6d8e', opacity: .95 }, group);
      register({ code: code, name: '公交站 ' + code, kind: '公交站', x: stop.x, z: stop.z,
        lines: [stop.shelter ? '候车亭站' : '站牌站', '位置 (' + stop.x.toFixed(1) + ', ' + stop.z.toFixed(1) + ')'] }, marker);
      el('circle', { cx: stop.x, cy: stop.z, r: 4.5, 'class': 'hit', 'data-code': code }, hitLayer);
    });
    return sorted.length;
  }
  function drawVending(anchors) {
    var group = layer('vending'), hitLayer = layer('hits-vending');
    var sorted = anchors.slice().sort(function (a, b) { return a.x - b.x || a.z - b.z; });
    sorted.forEach(function (machine, index) {
      var code = '贩-V' + pad(index + 1, 2);
      var marker = el('rect', { x: machine.x - .9, y: machine.z - .7, width: 1.8, height: 1.4,
        fill: '#b8544c', stroke: '#e2b6ae', 'stroke-width': .3, rx: .3, 'class': 'b-rect' }, group);
      register({ code: code, name: '贩卖机 ' + code, kind: '自动贩卖机', x: machine.x, z: machine.z,
        lines: ['位置 (' + machine.x.toFixed(1) + ', ' + machine.z.toFixed(1) + ')', '夜面随灯光快照同亮'] }, marker);
      el('circle', { cx: machine.x, cy: machine.z, r: 4, 'class': 'hit', 'data-code': code }, hitLayer);
    });
    return sorted.length;
  }
  function drawMailboxes(anchors) {
    var group = layer('mailboxes'), hitLayer = layer('hits-mailboxes');
    var sorted = anchors.slice().sort(function (a, b) { return a.x - b.x || a.z - b.z; });
    sorted.forEach(function (box, index) {
      var code = '箱-M' + (index + 1);
      var marker = el('rect', { x: box.x - .8, y: box.z - .6, width: 1.6, height: 1.2,
        fill: '#4b5320', stroke: '#7c8a58', 'stroke-width': .3, rx: .25, 'class': 'b-rect' }, group);
      register({ code: code, name: '邮箱 ' + code, kind: '邮箱', x: box.x, z: box.z,
        lines: ['位置 (' + box.x.toFixed(1) + ', ' + box.z.toFixed(1) + ')', '军绿认路地标（2026-09-21 拍板）'] }, marker);
      el('circle', { cx: box.x, cy: box.z, r: 4, 'class': 'hit', 'data-code': code }, hitLayer);
    });
    return sorted.length;
  }

  /* ---------- 悬停 / 选中 / 面板 ---------- */
  var selected = null, hoverRing = null, selOutline = null;
  svg.addEventListener('mousemove', function (event) {
    var target = event.target.closest && event.target.closest('[data-code]');
    if (!target) { tooltip.hidden = true; if (hoverRing) hoverRing.remove(), hoverRing = null; return; }
    var entry = byCode[target.getAttribute('data-code')];
    if (!entry) return;
    tooltip.innerHTML = '<span class="tt-code">' + entry.code + '</span>' + entry.name +
      '<div class="tt-line">' + entry.kind + ' · (' + Math.round(entry.x) + ', ' + Math.round(entry.z) + ')</div>' +
      entry.lines.map(function (line) { return '<div class="tt-line">' + line + '</div>'; }).join('');
    tooltip.hidden = false;
    var box = document.getElementById('plan-canvas').getBoundingClientRect();
    var x = event.clientX - box.left + 14, y = event.clientY - box.top + 14;
    if (x + tooltip.offsetWidth > box.width - 8) x = event.clientX - box.left - tooltip.offsetWidth - 10;
    if (y + tooltip.offsetHeight > box.height - 8) y = event.clientY - box.top - tooltip.offsetHeight - 10;
    tooltip.style.left = x + 'px'; tooltip.style.top = y + 'px';
  });
  svg.addEventListener('mouseleave', function () { tooltip.hidden = true; });

  function select(entry, focus3d) {
    selected = entry;
    document.getElementById('sel-badge').hidden = false;
    document.getElementById('sel-name').textContent = entry.name;
    document.getElementById('sel-code').textContent = entry.code;
    document.getElementById('sel-props').innerHTML =
      entry.lines.map(function (line) { return '<dd>' + line + '</dd>'; }).join('') ||
      '<dd>' + entry.kind + ' · (' + entry.x + ', ' + entry.z + ')</dd>';
    if (selOutline) selOutline.remove();
    if (entry.el && entry.el.getBBox) {
      var box = entry.el.getBBox();
      selOutline = el('rect', { x: box.x - 2, y: box.y - 2, width: box.width + 4, height: box.height + 4, 'class': 'selected-outline' }, layer('selection'));
    }
    var live = document.getElementById('sel-live');
    if (entry.ledger) {
      if (viewerOn) {
        live.hidden = false;
        live.textContent = '已联动三维观测 · 点击角标里的时段/形态查看不同状态';
        if (focus3d !== false) focusBuilding(entry.code);
      } else {
        live.hidden = true;
      }
    } else {
      live.hidden = true;
      // 严格指引：任何非台账景物（街、灯、树、摊、桥、地块、车环…）也把三维
      // 视图飞到它所在的位置。倍数与俯仰按物件大小分级——视觉实测标定：
      // 0.6 单位的灯在 10×/陡俯视下恰好充满画面，深缩放低角度只会被楼挡住。
      if (focus3d !== false && viewerOn) {
        var api = studio();
        if (api && api.flyTo) {
          var grade = entry.grade || { '路灯': [10, 1.1], '树木': [8, 1.05], '座椅': [16, 1.1], '垃圾桶': [16, 1.1], '夜市摊位': [14, .7],
            '道路段': [3.5, 1.05], '地块': [3, .9], '公园': [3.2, .9], '场所': [3, .9],
            '人行桥': [2.2, .95], '车行桥': [2.2, .95], '快速路': [1.4, .8], '车行隧道': [2.4, .8], '水系': [1.3, .8], '车流环线': [1.2, .8] }[entry.kind] || [1.6, .85];
          api.flyTo(entry.x, entry.z, grade[0], grade[1], grade[2]);
          document.getElementById('viewer-state').textContent = '定位 ' + entry.code + ' · ' + entry.name;
        } else {
          document.getElementById('viewer-state').textContent = '主视图暂不可用';
        }
      }
    }
    refreshLive();
  }
  document.getElementById('sel-close').addEventListener('click', function () {
    document.getElementById('sel-badge').hidden = true;
  });
  svg.addEventListener('click', function (event) {
    var target = event.target.closest && event.target.closest('[data-code]');
    if (!target) return;
    var entry = byCode[target.getAttribute('data-code')];
    if (entry) select(entry);
  });

  /* ---------- 三维观测（iframe 内的 cityStudio） ---------- */
  var frame = document.getElementById('viewer-frame');
  function studio() { return frame.contentWindow && frame.contentWindow.cityStudio; }
  function focusBuilding(id) {
    var api = studio();
    if (!api) return;
    if (api.observe(id)) {
      document.getElementById('viewer-state').textContent = '聚焦 ' + id;
    }
  }
  var liveTimer = null;
  function refreshLive() {
    // setSimTime 之后 iframe 的派生视图要一到两帧才更新，稍等再读，避免读到旧分钟。
    if (liveTimer) clearTimeout(liveTimer);
    liveTimer = setTimeout(function () {
      liveTimer = null;
      var api = studio();
      if (!api || !selected || !selected.ledger) return;
      try {
        var view = api.townState();
        var entry = view.byBuilding && view.byBuilding[selected.code];
        if (!entry) return;
        var clock = api.dayClock();
        var live = document.getElementById('sel-live');
        live.hidden = false;
        live.textContent = '当前 ' + pad(Math.floor(clock.minute), 0) + ' 分钟 · ' + (entry.open ? '营业中' : '已闭门') +
          ' · 在场 ' + (entry.presentIds ? entry.presentIds.length : 0) + ' 人 · 亮度 ' + (entry.lightLevel || 0).toFixed(2);
      } catch (error) { /* iframe 尚未就绪时静默 */ }
    }, 350);
  }
  document.querySelectorAll('[data-minute]').forEach(function (button) {
    button.addEventListener('click', function () {
      var api = studio(); if (!api) return;
      api.setSimTime({ day: 1, minute: Number(button.getAttribute('data-minute')) });
      document.getElementById('viewer-state').textContent = '时段 ' + button.textContent;
      document.querySelectorAll('[data-minute]').forEach(function (other) { other.classList.remove('active'); });
      button.classList.add('active');
      refreshLive();
    });
  });
  document.getElementById('btn-building').addEventListener('click', function () {
    var api = studio(); if (!api) return;
    api.renderAt(api.getState().duration * .35);
    document.getElementById('viewer-state').textContent = '建造中（35% 进度）';
    refreshLive();
  });
  document.getElementById('btn-complete').addEventListener('click', function () {
    var api = studio(); if (!api) return;
    api.renderAt(api.getState().duration);
    document.getElementById('viewer-state').textContent = '建成';
    refreshLive();
  });
  document.getElementById('btn-overview').addEventListener('click', function () {
    var api = studio(); if (!api) return;
    api.observe('neighborhood');
    document.getElementById('viewer-state').textContent = '全景';
  });

  /* ---------- 搜索 ---------- */
  var searchInput = document.getElementById('atlas-search');
  var searchResults = document.getElementById('search-results');
  function runSearch() {
    var query = searchInput.value.trim().toLowerCase();
    if (!query) { searchResults.hidden = true; return; }
    var hits = CATALOG.filter(function (entry) {
      return entry.code.toLowerCase().indexOf(query) >= 0 || entry.name.toLowerCase().indexOf(query) >= 0;
    }).slice(0, 14);
    if (!hits.length) { searchResults.hidden = false; searchResults.innerHTML = '<div class="hit"><span class="code">无匹配</span></div>'; return; }
    searchResults.hidden = false;
    searchResults.innerHTML = '';
    hits.forEach(function (entry) {
      var row = document.createElement('div');
      row.className = 'hit';
      row.innerHTML = '<span class="code">' + entry.code + '</span><span>' + entry.name + '</span><span class="kind">' + entry.kind + '</span>';
      row.addEventListener('click', function () { searchResults.hidden = true; select(entry); });
      searchResults.appendChild(row);
    });
  }
  searchInput.addEventListener('input', runSearch);
  searchInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      var first = searchResults.querySelector('.hit');
      if (first && !searchResults.hidden) first.click();
    }
    if (event.key === 'Escape') { searchResults.hidden = true; }
  });
  document.addEventListener('click', function (event) {
    if (!event.target.closest('.search-wrap')) searchResults.hidden = true;
  });

  /* ---------- 平面图视图：滚轮缩放 + 拖拽平移 ---------- */
  var PLAN_BASE = { x: -212, y: -278, w: 424, h: 580 };
  var planView = Object.assign({}, PLAN_BASE);
  function applyPlanView() {
    svg.setAttribute('viewBox', planView.x + ' ' + planView.y + ' ' + planView.w + ' ' + planView.h);
  }
  function planScale() {
    var rect = svg.getBoundingClientRect();
    return Math.max(planView.w / rect.width, planView.h / rect.height);
  }
  function planClamp() {
    var mx = PLAN_BASE.w * .5, my = PLAN_BASE.h * .5;
    planView.x = Math.max(PLAN_BASE.x - mx, Math.min(planView.x, PLAN_BASE.x + PLAN_BASE.w - planView.w + mx));
    planView.y = Math.max(PLAN_BASE.y - my, Math.min(planView.y, PLAN_BASE.y + PLAN_BASE.h - planView.h + my));
  }
  function planReset() { planView = Object.assign({}, PLAN_BASE); applyPlanView(); }
  function svgPoint(event) {
    var rect = svg.getBoundingClientRect(), scale = planScale();
    // preserveAspectRatio="xMidYMid meet"：内容等比缩放并居中，先扣掉两侧留边。
    var contentW = planView.w / scale, contentH = planView.h / scale;
    return { x: planView.x + (event.clientX - rect.left - (rect.width - contentW) / 2) * scale,
      y: planView.y + (event.clientY - rect.top - (rect.height - contentH) / 2) * scale };
  }
  svg.addEventListener('wheel', function (event) {
    event.preventDefault();
    var factor = Math.exp(event.deltaY * .0016);
    // 级别 = viewBox 宽 / 基准宽：1 是整板，越小越放大。
    var current = planView.w / PLAN_BASE.w;
    var target = Math.min(1, Math.max(.1, current * factor));
    var next = target / current;
    var point = svgPoint(event);
    planView.x = point.x - (point.x - planView.x) * next;
    planView.y = point.y - (point.y - planView.y) * next;
    planView.w *= next; planView.h *= next;
    planClamp(); applyPlanView();
  }, { passive: false });
  var planDrag = null, planSuppressClick = false;
  svg.addEventListener('pointerdown', function (event) {
    if (event.button !== 0) return;
    planDrag = { x: event.clientX, y: event.clientY, vx: planView.x, vy: planView.y, moved: false };
  });
  window.addEventListener('pointermove', function (event) {
    if (!planDrag) return;
    var dx = event.clientX - planDrag.x, dy = event.clientY - planDrag.y;
    if (!planDrag.moved && Math.hypot(dx, dy) < 4) return;
    planDrag.moved = true;
    var scale = planScale();
    planView.x = planDrag.vx - dx * scale;
    planView.y = planDrag.vy - dy * scale;
    planClamp(); applyPlanView();
  });
  window.addEventListener('pointerup', function () {
    if (planDrag) planSuppressClick = planDrag.moved;
    planDrag = null;
  });
  svg.addEventListener('click', function (event) {
    // 一次拖拽动过就吞掉紧随的 click，平移不该改变选中。
    if (planSuppressClick) { event.stopPropagation(); planSuppressClick = false; }
  }, true);
  svg.addEventListener('dblclick', planReset);

  /* ---------- 图层开关 ---------- */
  var LAYER_DEFS = [['lots', '地块'], ['trees', '树木'], ['lamps', '路灯'], ['hits-lamps', '灯热点', 'lamps'],
    ['hits-trees', '树热点', 'trees'], ['stalls', '摊位'], ['benches', '座椅'], ['hits-benches', '凳热点', 'benches'],
    ['bins', '垃圾桶'], ['hits-bins', '桶热点', 'bins'], ['rings', '车环']];
  var chipsBox = document.getElementById('layer-chips');
  LAYER_DEFS.forEach(function (def) {
    var name = def[0], label = def[1], mirror = def[2];
    var chip = document.createElement('span');
    chip.className = 'layer-chip on';
    chip.textContent = label;
    chip.addEventListener('click', function () {
      var on = chip.classList.toggle('on');
      [layers[name], mirror && layers[mirror]].forEach(function (layerNode) {
        if (layerNode) layerNode.style.display = on ? '' : 'none';
      });
    });
    chipsBox.appendChild(chip);
  });
  var resetChip = document.createElement('span');
  resetChip.className = 'layer-chip';
  resetChip.textContent = '复位视图';
  resetChip.title = '滚轮缩放 · 拖拽平移 · 双击平面图复位';
  resetChip.addEventListener('click', planReset);
  chipsBox.appendChild(resetChip);

  /* ---------- 拖拽分隔条 ---------- */
  var SPLIT_KEY = 'atlas-inspect-width', SPLIT_DEFAULT = 400;
  var splitter = document.getElementById('pane-splitter');
  var inspectPane = document.querySelector('.inspect-pane');
  function clampWidth(px) {
    return Math.round(Math.max(320, Math.min(px, window.innerWidth * .75)));
  }
  function applyWidth(px) {
    document.documentElement.style.setProperty('--inspect-w', px + 'px');
  }
  (function restoreWidth() {
    var saved = Number(readPreference(SPLIT_KEY));
    if (saved) applyWidth(clampWidth(saved));
  })();
  splitter.addEventListener('pointerdown', function (event) {
    event.preventDefault();
    var startPointer = event.clientX, startWidth = inspectPane.getBoundingClientRect().width;
    splitter.classList.add('dragging');
    document.body.classList.add('resizing');
    splitter.setPointerCapture(event.pointerId);
    var pending = null;
    function onMove(move) {
      pending = clampWidth(startWidth + (startPointer - move.clientX));
      if (pending !== null) {
        requestAnimationFrame(function () {
          if (pending === null) return;
          applyWidth(pending); pending = null;
        });
      }
    }
    function onUp() {
      splitter.classList.remove('dragging');
      document.body.classList.remove('resizing');
      splitter.removeEventListener('pointermove', onMove);
      splitter.removeEventListener('pointerup', onUp);
      splitter.removeEventListener('pointercancel', onUp);
      var width = clampWidth(inspectPane.getBoundingClientRect().width);
      applyWidth(width);
      writePreference(SPLIT_KEY, String(width));
    }
    splitter.addEventListener('pointermove', onMove);
    splitter.addEventListener('pointerup', onUp);
    splitter.addEventListener('pointercancel', onUp);
  });
  splitter.addEventListener('dblclick', function () {
    applyWidth(SPLIT_DEFAULT);
    writePreference(SPLIT_KEY, null);
  });

  /* ---------- 时段/形态面板：可拖拽悬浮 ---------- */
  var BADGE_POS_KEY = 'atlas-state-badge-pos';
  var stateBadge = document.getElementById('state-badge');
  var stateGrip = document.getElementById('state-grip');
  function badgeRestore() {
    try {
      var saved = JSON.parse(readPreference(BADGE_POS_KEY) || 'null');
      if (!saved) return;
      var canvas = document.getElementById('plan-canvas').getBoundingClientRect();
      stateBadge.style.left = Math.min(Math.max(0, saved.left), Math.max(0, canvas.width - 60)) + 'px';
      stateBadge.style.top = Math.min(Math.max(0, saved.top), Math.max(0, canvas.height - 40)) + 'px';
      stateBadge.style.bottom = 'auto';
    } catch (error) { /* 损坏的存档按默认位置处理 */ }
  }
  stateGrip.addEventListener('pointerdown', function (event) {
    if (event.button !== 0) return;
    event.preventDefault();
    var canvas = document.getElementById('plan-canvas').getBoundingClientRect();
    var rect = stateBadge.getBoundingClientRect();
    var offsetX = event.clientX - rect.left, offsetY = event.clientY - rect.top;
    stateGrip.setPointerCapture(event.pointerId);
    function onMove(move) {
      // 允许拖出大半但永远留一个可抓的角在画布内
      var left = Math.min(Math.max(-rect.width + 56, move.clientX - canvas.left - offsetX), canvas.width - 56);
      var top = Math.min(Math.max(0, move.clientY - canvas.top - offsetY), canvas.height - 34);
      stateBadge.style.left = left + 'px';
      stateBadge.style.top = top + 'px';
      stateBadge.style.bottom = 'auto';
    }
    function onUp() {
      stateGrip.removeEventListener('pointermove', onMove);
      stateGrip.removeEventListener('pointerup', onUp);
      stateGrip.removeEventListener('pointercancel', onUp);
      var final = stateBadge.getBoundingClientRect();
      writePreference(BADGE_POS_KEY, JSON.stringify({ left: final.left - canvas.left, top: final.top - canvas.top }));
    }
    stateGrip.addEventListener('pointermove', onMove);
    stateGrip.addEventListener('pointerup', onUp);
    stateGrip.addEventListener('pointercancel', onUp);
  });
  badgeRestore();

  /* ---------- 种子（站内展示：只读编号，不提供重建入口） ---------- */
  document.getElementById('seed-input').textContent = String(seed);

  /* ---------- 启动 ---------- */
  drawBase();
  drawRoads();
  drawBuildings();
  drawAnnexes();
  drawRings();
  drawTrees();

   /* ---------- 右侧三维观测开关 ----------
   * 关 = 右栏整体退场，且 iframe 真正卸载（换成 about:blank 才会释放内嵌页面的
   * WebGL/p5 预算，只改 display 是"看不见却照常烧卡"）。开 = 重新装载并继续等就绪。
   * 活数据层（路灯/摊位/座椅/垃圾桶/公交站/贩卖机/邮箱）只在首次就绪时绘制
   * 一次（liveDrawn），开关来回拨不会往目录里重复登记。开关状态存
   * localStorage，刷新保持。 */
  var VIEWER_KEY = 'atlas-viewer-on';
  var BASE_NOTE = '悬停查看编号 · 点击建筑联动三维观测';
  var loading = document.getElementById('plan-loading');
  var headerNote = document.querySelector('.header-note');
  var viewerToggle = document.getElementById('viewer-toggle');
  var viewerOn = readPreference(VIEWER_KEY) !== '0';
  var liveDrawn = false, poll = null, giveUp = null;
  function pollViewer() {
    var doc = null;
    try { doc = frame.contentDocument; } catch (error) { /* 跨域异常按未就绪处理 */ }
    var api = studio();
    if (!doc || doc.documentElement.getAttribute('data-ready') !== 'true' || !api) return;
    clearInterval(poll); clearTimeout(giveUp); poll = null; giveUp = null;
      var renderer = api.getState().renderer || {};
      var lamps = (renderer.lighting && renderer.lighting.streetLampAnchors) || [];
      var stalls = (renderer.places && renderer.places.waterfront && renderer.places.waterfront.footprints) || [];
      var benches = renderer.parkSeating || [];
      var binAnchors = (renderer.streetExtras && renderer.streetExtras.binAnchors) || [];
      var stops = (renderer.streetExtras && renderer.streetExtras.busStops) || [];
      var vending = (renderer.streetExtras && renderer.streetExtras.vendingAnchors) || [];
      var mailboxes = (renderer.streetExtras && renderer.streetExtras.mailboxAnchors) || [];
      if (!liveDrawn) {
        liveDrawn = true;
        drawLamps(lamps); drawStalls(stalls); drawBenches(benches); drawBins(binAnchors);
        drawBusStops(stops); drawVending(vending); drawMailboxes(mailboxes);
      }
      loading.hidden = true;
      var note = '活数据已接入：路灯 ' + lamps.length + ' · 摊位 ' + stalls.length + ' · 座椅 ' + benches.reduce(function (n, park) { return n + (park.benches || []).length; }, 0) + ' · 垃圾桶 ' + binAnchors.length + ' · 公交站 ' + stops.length + ' · 贩卖机 ' + vending.length + ' · 邮箱 ' + mailboxes.length;
    headerNote.textContent = note + ' · ' + BASE_NOTE;
  }
  function startViewer() {
    if (poll) return;
    loading.hidden = false;
    loading.textContent = '正在构建小镇与三维观测…';
    headerNote.textContent = BASE_NOTE;
    frame.src = './index.html?sample=district&embed=1&seed=' + seed;
    giveUp = setTimeout(function () {
      loading.textContent = '三维观测未就绪——路灯/摊位/座椅层需要右侧页面完成初始化后显示（可先使用其余图层）';
      setTimeout(function () { loading.hidden = true; }, 4000);
    }, 45000);
    poll = setInterval(pollViewer, 350);
  }
  function stopViewer() {
    if (poll) { clearInterval(poll); poll = null; }
    if (giveUp) { clearTimeout(giveUp); giveUp = null; }
    loading.hidden = true;
    frame.src = 'about:blank';
    document.getElementById('viewer-state').textContent = '默认视角';
    headerNote.textContent = '三维观测已关闭 · ' + BASE_NOTE;
  }
  viewerToggle.checked = viewerOn;
  viewerToggle.addEventListener('change', function () {
    viewerOn = viewerToggle.checked;
    writePreference(VIEWER_KEY, viewerOn ? '1' : '0');
    document.body.classList.toggle('viewer-off', !viewerOn);
    if (viewerOn) startViewer(); else stopViewer();
  });
  if (viewerOn) startViewer();
  else { document.body.classList.add('viewer-off'); stopViewer(); }
})();
