/* Chinese resident naming (§2.3) plus fan-roster injection (§2.5). Names are drawn
 * era-layered so a 52-year-old reads 建国 not 梓涵; uniqueness is enforced across
 * the whole town, and fan nicknames claim resident slots before the pool runs. */
(function (root, factory) {
  'use strict';
  var api = factory(
    (typeof CityRandom === 'object' && CityRandom) ? CityRandom :
    (typeof require === 'function' ? require('../city-random.js') : null)
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CityResidentNames = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (CityRandom) {
  'use strict';

  // 100 common surnames (§2.3), enough that 1000 residents never feel 王张伟式塑料感.
  var SURNAMES = ('李王张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾'
    + '萧田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹'
    + '孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤').split('');

  // Initial letter per surname for the pinyin sort key (§2.1). The parentheses are
  // load-bearing: without them `.split` binds to the last string chunk only and most
  // of the table silently disappears.
  var PINYIN_INITIAL = {};
  ('李l 王w 张z 刘l 陈c 杨y 黄h 赵z 吴w 周z 徐x 孙s 马m 朱z 胡h 郭g 何h 高g 林l 罗l '
  + '郑z 梁l 谢x 宋s 唐t 许x 韩h 冯f 邓d 曹c 彭p 曾z 萧x 田t 董d 袁y 潘p 于y 蒋j 蔡c '
  + '余y 杜d 叶y 程c 苏s 魏w 吕l 丁d 任r 沈s 姚y 卢l 姜j 崔c 钟z 谭t 陆l 汪w 范f 石s '
  + '廖l 贾j 夏x 韦w 付f 方f 白b 邹z 孟m 熊x 秦q 邱q 江j 尹y 薛x 段d 雷l 侯h 龙l 史s '
  + '陶t 黎l 贺h 顾g 毛m 郝h 龚g 邵s 万w 钱q 严y 武w 戴d 莫m 孔k 向x 汤t 金j 闫y 覃q')
    .split(' ').forEach(function (pair) {
      var s = pair.split('');
      PINYIN_INITIAL[s[0]] = s[1];
    });

  // Era × gender layers per §2.3. Entries carry their pinyin tail so §2.1's sort key
  // is real initials ("李建国" → ljg), and they are whole given names rather than
  // random character pairs — that is what keeps a 52-year-old man from reading 秀英.
  var GIVEN = {
    old: {
      male: '建国jg 建华jh 国强gq 卫东wd 永强yq 德福df 金山js 志强zq 学军xj 振华zh 国庆gq 春生cs 伟w 强q 磊l 勇y 军j 平p'.split(' '),
      female: '秀英xy 桂兰gl 淑珍sz 凤英fy 玉荣yr 秀兰xl 桂芳gf 淑华sh 宝珍bz 凤兰fl 秀云xy 兰英ly 芳f 娟j 英y 华h 敏m 静j'.split(' ')
    },
    mid: {
      male: '海涛ht 建军jj 晓东xd 明辉mh 志刚zg 海军hj 文斌wb 立平lp 宏伟hw 伟东wd 德明dm 国栋gd 杰j 俊j 涛t 明m 超c 辉h'.split(' '),
      female: '晓燕xy 丽萍lp 红梅hm 秀兰xl 雅静yj 淑敏sm 玉华yh 春霞cx 晓丽xl 桂香gx 素萍sp 燕y 红h 梅m 倩q 婷t 娜n'.split(' ')
    },
    young: {
      male: '梓涵zh 昊轩hx 子轩zx 浩然hr 一鸣ym 嘉宇jy 睿泽rz 宇辰yc 思远sy 梓豪zh 沐阳my 锦程jc 梓z 昊h 宇y 辰c 泽z 睿r'.split(' '),
      female: '雨萱yx 欣怡xy 梦琪mq 若曦rx 悦溪yx 梓萱zx 一诺yn 思瑶sy 语彤yt 芷若zr 雨桐yt 可欣kx 萱x 怡y 琪q 彤t 诺n 瑶y'.split(' ')
    }
  };

  // Older generations name more often with a single character.
  var SINGLE_RATE = { old: 0.3, mid: 0.22, young: 0.12 };

  function tierForAge(age) {
    return age >= 50 ? 'old' : age >= 27 ? 'mid' : 'young';
  }

  function pick(list, rng) {
    return list[Math.floor(rng() * list.length)];
  }

  // Pool for one resident; unknown gender falls back to the merged layer.
  function poolFor(age, gender) {
    var tier = GIVEN[tierForAge(age)];
    if (gender === 'M') return tier.male;
    if (gender === 'F') return tier.female;
    return tier.male.concat(tier.female);
  }

  // "建国jg" → {name:'建国', pinyin:'jg'}; the pinyin tail is exactly as long as the
  // name has characters, so the split is unambiguous for these CJK-only entries.
  function splitEntry(entry) {
    var i = entry.length;
    while (i > 0 && entry.charCodeAt(i - 1) >= 97 && entry.charCodeAt(i - 1) <= 122) i--;
    return { name: entry.slice(0, i), pinyin: entry.slice(i) };
  }

  // Sort key fallback for injected nicknames, which carry no readable pinyin: keep
  // the surname initial when the first character is a known surname.
  function pinyinOf(name) {
    return PINYIN_INITIAL[name.charAt(0)] || '';
  }

  // generate(count, rng, profiles): one {name, pinyin} per resident, profiles[i] =
  // {age, gender} driving the era and gender layer. Uniqueness is by retry — the
  // pools hold far more than 1000 combinations.
  function generate(count, rng, profiles) {
    var used = new Set();
    var names = [];
    for (var i = 0; i < count; i++) {
      var profile = (profiles && profiles[i]) || {};
      var age = typeof profile.age === 'number' ? profile.age : 5;
      var tier = tierForAge(age);
      var pool = poolFor(age, profile.gender);
      var name = null;
      var pinyin = '';
      for (var attempt = 0; attempt < 64 && !name; attempt++) {
        var surname = pick(SURNAMES, rng);
        var singles = pool.filter(function (entry) { return splitEntry(entry).name.length === 1; });
        var doubles = pool.filter(function (entry) { return splitEntry(entry).name.length > 1; });
        var choice = rng() < SINGLE_RATE[tier] ? pick(singles, rng) : pick(doubles, rng);
        var parts = splitEntry(choice);
        var candidate = surname + parts.name;
        if (!used.has(candidate) || attempt === 63) {
          name = candidate;
          pinyin = (PINYIN_INITIAL[surname] || '') + parts.pinyin;
        }
      }
      used.add(name);
      names.push({ name: name, pinyin: pinyin });
    }
    return names;
  }

  // Roster injection §2.5: fans claim resident slots (role preference honoured when
  // the census still has one), nicknames win over the pool for those slots. Seats are
  // spread by a fixed stride so a roster of ten does not land as ten neighbours.
  function applyRoster(residents, roster) {
    if (!roster || !roster.length) return { applied: 0, unseated: [] };
    var taken = new Set();
    var applied = 0;
    var unseated = [];
    roster.forEach(function (entry, index) {
      if (!entry || !entry.name) return;
      var pool = residents.filter(function (r) { return !taken.has(r.id); });
      var wanted = entry.role ? pool.filter(function (r) { return r.role === entry.role; }) : [];
      var candidates = wanted.length ? wanted : pool;
      var target = candidates.length ? candidates[(index * 37) % candidates.length] : null;
      if (!target) { unseated.push(entry.name); return; }
      taken.add(target.id);
      target.name = entry.name;
      // A nickname has no pinyin to sort by; UI groups fans separately instead.
      target.pinyin = '';
      target.fan = true;
      applied += 1;
    });
    return { applied: applied, unseated: unseated };
  }

  // Import/storage helpers deliberately have no DOM dependency. Callers supply
  // storage (or a getter, since accessing localStorage itself can be denied).
  var STORAGE_KEY = 'tianjiang-zhucheng:v4:resident-roster:v2';
  var LEGACY_STORAGE_KEY = 'tianjiang-zhucheng:v4:resident-roster:v1';
  var MAX_IMPORT_BYTES = 1024 * 1024;
  var NAME_CONTROLS = /[\t\r\n\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
  function utf8Size(text) {
    var bytes = 0;
    for (var ch of text) {
      var cp = ch.codePointAt(0);
      bytes += cp <= 127 ? 1 : cp <= 2047 ? 2 : cp <= 65535 ? 3 : 4;
    }
    return bytes;
  }
  function parseCsvRow(line) {
    var cells = [], index = 0;
    while (true) {
      while (line[index] === ' ') index++;
      var value = '';
      if (line[index] === '"') {
        index++;
        var closed = false;
        while (index < line.length) {
          if (line[index] === '"') {
            if (line[index + 1] === '"') { value += '"'; index += 2; continue; }
            index++;
            closed = true;
            break;
          }
          value += line[index++];
        }
        if (!closed) return null;
        while (line[index] === ' ') index++;
        if (index < line.length && line[index] !== ',') return null;
      } else {
        var start = index;
        while (index < line.length && line[index] !== ',') {
          if (line[index] === '"') return null;
          index++;
        }
        value = line.slice(start, index);
      }
      cells.push(value);
      if (index >= line.length) break;
      index++;
      if (index === line.length) { cells.push(''); break; }
    }
    return cells;
  }
  function parseRoster(text, format, capacity) {
    var result = { roster: [], errors: [] }, seen = new Map();
    var limit = capacity === undefined ? 1000 : capacity;
    function error(line, message) { result.errors.push({ line: line, message: message }); }
    function add(value, line) {
      if (typeof value !== 'string') { error(line, '姓名必须是文字。'); return; }
      // Tabs represent extra Excel columns, even an empty trailing column.
      if (NAME_CONTROLS.test(value)) {
        error(line, '只接受单列姓名，姓名内不能包含制表符、换行或控制字符。'); return;
      }
      var name = value.trim();
      if (!name) return;
      if (Array.from(name).length > 40) { error(line, '姓名不能超过 40 个 Unicode 字符。'); return; }
      if (seen.has(name)) { error(line, '姓名重复，与第 ' + seen.get(name) + ' 行／项相同。'); return; }
      seen.set(name, line);
      result.roster.push({ name: name });
    }
    if (typeof text !== 'string') { error(0, '请选择文字文件。'); return result; }
    if (utf8Size(text) > MAX_IMPORT_BYTES) { error(0, '文件不能超过 1 MB。'); return result; }
    text = text.replace(/^\ufeff/, '');
    if (format === 'json') {
      try {
        var data = JSON.parse(text);
        if (!Array.isArray(data)) error(0, 'JSON 必须是姓名数组。');
        else data.forEach(function (entry, i) {
          if (typeof entry === 'string') add(entry, i + 1);
          else if (entry && typeof entry === 'object' && !Array.isArray(entry) &&
            Object.keys(entry).length === 1 && Object.prototype.hasOwnProperty.call(entry, 'name')) add(entry.name, i + 1);
          else error(i + 1, '每项只接受姓名文字或仅含 name 的对象。');
        });
      } catch (e) { error(0, 'JSON 格式错误，请检查括号、引号和逗号。'); }
    } else if (format === 'csv' || format === 'txt' || format === undefined) {
      var first = true, fanNameColumn = -1;
      text.split(/\r\n|\n|\r/).forEach(function (line, i) {
        // Validate raw cells before unquoting: outer CSV whitespace must never
        // swallow Excel's empty extra column or a forbidden control character.
        if (NAME_CONTROLS.test(line)) { add(line, i + 1); first = false; return; }
        if (!line.trim()) return;
        var value = line;
        if (format === 'csv') {
          if (first) {
            var headerCells = parseCsvRow(line);
            if (headerCells && headerCells.length === 2) {
              var firstHeader = headerCells[0].trim();
              var secondHeader = headerCells[1].trim();
              if (firstHeader === '编号' && secondHeader === '粉丝昵称') fanNameColumn = 1;
              else if (firstHeader === '粉丝昵称' && secondHeader === '编号') fanNameColumn = 0;
              if (fanNameColumn !== -1) { first = false; return; }
            }
          }
          if (fanNameColumn !== -1) {
            var fanCells = parseCsvRow(line);
            if (!fanCells) { error(i + 1, '粉丝名单 CSV 格式错误，请检查引号。'); first = false; return; }
            if (fanCells.length !== 2) { error(i + 1, '此格式每行必须恰好包含“编号”和“粉丝昵称”两列。'); first = false; return; }
            if (!fanCells[fanNameColumn].trim()) { error(i + 1, '粉丝昵称不能为空。'); first = false; return; }
            first = false;
            add(fanCells[fanNameColumn], i + 1);
            return;
          }
          // A valid one-cell CSV row is either unquoted without commas/quotes,
          // or fully quoted with doubled quotes. Embedded newlines are invalid names.
          var match = /^\s*"((?:[^"]|"")*)"\s*$/.exec(line);
          if (match) value = match[1].replace(/""/g, '"');
          else if (/[,\"]/.test(line)) { error(i + 1, 'CSV 只接受单列，且引号必须完整配对。'); first = false; return; }
          if (first && /^(name|姓名|昵称)$/i.test(value.trim())) { first = false; return; }
        }
        first = false;
        add(value, i + 1);
      });
    } else error(0, '仅支持 TXT、单列 CSV 和 JSON。');
    if (result.roster.length > limit) error(0, '有效姓名 ' + result.roster.length + ' 个，超过当前居民总数 ' + limit + '。');
    if (!result.roster.length && !result.errors.length) error(0, '名单为空；请点击“系统默认姓名”卡片切换。');
    return result;
  }
  function getStorage(source) { return typeof source === 'function' ? source() : source; }
  function checkedRoster(roster, capacity) {
    var checked = parseRoster(JSON.stringify(roster), 'json', capacity);
    if (checked.errors.length) throw new Error(checked.errors[0].message);
    return checked.roster;
  }
  function checkedLabel(label) {
    if (typeof label !== 'string' || !label.trim() || NAME_CONTROLS.test(label) || Array.from(label.trim()).length > 40) {
      throw new Error('名单名称须为 1–40 个字符，不能包含换行或控制字符');
    }
    label = label.trim();
    if (label === '系统默认姓名') throw new Error('系统默认姓名是保留名称');
    return label;
  }
  function readLibrary(storage, capacity) {
    var raw = storage.getItem(STORAGE_KEY);
    if (raw === null) raw = storage.getItem(LEGACY_STORAGE_KEY);
    if (raw === null) return { version: 2, activeId: 'system', lists: [] };
    var data = JSON.parse(raw);
    if (data && data.version === 1) {
      return { version: 2, activeId: 'imported', lists: [
        { id: 'imported', label: '已导入名单', roster: checkedRoster(data.roster, capacity) }
      ] };
    }
    if (!data || data.version !== 2 || !Array.isArray(data.lists)) throw new Error('名单版本或结构不支持');
    var ids = new Set(), labels = new Set();
    var lists = data.lists.map(function (list) {
      if (!list || typeof list.id !== 'string' || !list.id || list.id.length > 80 || list.id === 'system' || ids.has(list.id)) {
        throw new Error('名单编号无效或重复');
      }
      var label = checkedLabel(list.label);
      if (labels.has(label)) throw new Error('名单名称重复');
      ids.add(list.id); labels.add(label);
      return { id: list.id, label: label, roster: checkedRoster(list.roster, capacity) };
    });
    if (data.activeId !== 'system' && !ids.has(data.activeId)) throw new Error('当前名单不存在');
    return { version: 2, activeId: data.activeId, lists: lists };
  }
  function loadRoster(source, capacity) {
    try {
      var library = readLibrary(getStorage(source), capacity);
      var active = library.lists.find(function (list) { return list.id === library.activeId; });
      return { roster: active ? active.roster : [], lists: library.lists, activeId: library.activeId, error: null };
    } catch (e) {
      return { roster: [], lists: [], activeId: 'system', error: '无法读取已保存名单，已使用系统姓名。' + (e.message || '') };
    }
  }
  // Read the latest library immediately before each synchronous, single-key commit.
  // v1 migration is only persisted when this write succeeds; quota failures retain it.
  function saveNamedRoster(source, entry, capacity) {
    try {
      var storage = getStorage(source), library = readLibrary(storage, capacity);
      var roster = checkedRoster(entry.roster, capacity), label = checkedLabel(entry.label);
      var existing = entry.id ? library.lists.find(function (list) { return list.id === entry.id; }) : null;
      if (entry.id && !existing) throw new Error('这份名单已不存在，请另存为新名单');
      if (library.lists.some(function (list) { return list.label === label && list !== existing; })) throw new Error('已有同名名单，请换一个名单名称');
      var id = existing ? existing.id : 'list-1', serial = 1;
      if (!existing) while (library.lists.some(function (list) { return list.id === id; })) id = 'list-' + (++serial);
      if (existing) { existing.label = label; existing.roster = roster; }
      else library.lists.push({ id: id, label: label, roster: roster });
      library.activeId = id;
      storage.setItem(STORAGE_KEY, JSON.stringify(library));
      return { ok: true, error: null, activeId: id };
    } catch (e) { return { ok: false, error: '名单未保存，当前姓名未改变。' + (e.message || '') }; }
  }
  function selectRoster(source, id, capacity) {
    try {
      var storage = getStorage(source), library = readLibrary(storage, capacity);
      if (id !== 'system' && !library.lists.some(function (list) { return list.id === id; })) throw new Error('这份名单已不存在，请刷新列表');
      library.activeId = id;
      storage.setItem(STORAGE_KEY, JSON.stringify(library));
      return { ok: true, error: null };
    } catch (e) { return { ok: false, error: '切换未保存，当前姓名未改变。' + (e.message || '') }; }
  }
  // Compatibility for callers that replace the active roster without naming it.
  function saveRoster(source, roster, capacity) {
    var current = loadRoster(source, capacity);
    var active = current.lists.find(function (list) { return list.id === current.activeId; });
    var label = '已导入名单', suffix = 1;
    if (!active) while (current.lists.some(function (list) { return list.label === label; })) label = '已导入名单 ' + (++suffix);
    return saveNamedRoster(source, { id: active ? active.id : null, label: active ? active.label : label, roster: roster }, capacity);
  }
  function clearRoster(source) {
    try { getStorage(source).setItem(STORAGE_KEY, JSON.stringify({ version: 2, activeId: 'system', lists: [] })); return { ok: true, error: null }; }
    catch (e) { return { ok: false, error: '恢复失败，当前姓名未改变。' + (e.message || '') }; }
  }
  function serializeRoster(roster) { return JSON.stringify(roster.map(function (r) { return { name: r.name }; }), null, 2); }
  function copyNameFields(target, candidate) {
    if (target.residents.length !== candidate.residents.length || target.residents.some(function (r, i) {
      return r.id !== candidate.residents[i].id;
    })) throw new Error('姓名更新的居民 ID 不一致');
    target.residents.forEach(function (r, i) {
      var next = candidate.residents[i];
      r.name = next.name; r.pinyin = next.pinyin;
      if (Object.prototype.hasOwnProperty.call(next, 'fan')) r.fan = next.fan;
      else delete r.fan;
    });
    target.stats.fans = candidate.stats.fans;
    target.stats.unseatedFans = candidate.stats.unseatedFans;
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    LEGACY_STORAGE_KEY: LEGACY_STORAGE_KEY,
    MAX_IMPORT_BYTES: MAX_IMPORT_BYTES,
    parseRoster: parseRoster,
    loadRoster: loadRoster,
    saveRoster: saveRoster,
    saveNamedRoster: saveNamedRoster,
    selectRoster: selectRoster,
    clearRoster: clearRoster,
    serializeRoster: serializeRoster,
    copyNameFields: copyNameFields,
    SURNAMES: SURNAMES,
    GIVEN: GIVEN,
    generate: generate,
    applyRoster: applyRoster,
    pinyinOf: pinyinOf,
    poolFor: poolFor,
    tierForAge: tierForAge
  };
});
