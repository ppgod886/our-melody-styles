/* ============================================================
   《我们的乐章》名单管理 —— 上传 / 解析 / 持久化
   ------------------------------------------------------------
   支持三种文件：
   - CSV（推荐，模板可在页面里一键下载）
   - JSON  [{name, role, quote, trait, section, pitch}] 或
           {sections:[...], members:[...]}
   - Excel(.xlsx/.xls)，按需联网加载解析组件
   名单保存在浏览器 localStorage，只影响本机；随时可恢复默认。
   ============================================================ */

const Roster = (() => {
  const LS_KEY = 'ourMelody.roster.v1';

  /* ---------- 本地持久化 ---------- */
  function loadStored() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d || !Array.isArray(d.members) || d.members.length < 3) return null;
      if (!Array.isArray(d.sections) || d.sections.length !== 3) d.sections = null;
      return d;
    } catch (e) { return null; }
  }
  function persist(data) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); return true; }
    catch (e) { return false; }
  }
  function clearStored() { try { localStorage.removeItem(LS_KEY); } catch (e) {} }

  /* ---------- CSV 解析（支持引号转义） ---------- */
  function parseCSV(text) {
    text = String(text).replace(/^\uFEFF/, '');
    const rows = []; let row = [], cur = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
        } else cur += c;
      } else if (c === '"') inQ = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = '';
        if (row.some(x => String(x).trim() !== '')) rows.push(row);
        row = [];
      } else cur += c;
    }
    row.push(cur);
    if (row.some(x => String(x).trim() !== '')) rows.push(row);
    return rows;
  }

  /* ---------- 表头与字段 ---------- */
  function rowsToRaw(rows) {
    if (!rows.length) return { error: '文件是空的' };
    const H = rows[0].map(h => String(h || '').trim().toLowerCase());
    const find = names => H.findIndex(h => names.some(n => h.includes(n)));
    const iName = find(['姓名', '名字', '成员', 'name']);
    if (iName < 0) return { error: '表格第一行需要包含「姓名」列（可从页面下载模板）' };
    const iRole  = find(['职责', '分工', '职务', '角色', 'role']);
    const iQuote = find(['简介', '一句话', '介绍', '签名', 'quote']);
    const iTrait = find(['特色', '彩蛋', '趣事', 'trait']);
    const iSec   = find(['声部', '分组', '组别', 'section', 'part']);
    const iPitch = find(['音高', 'pitch', 'note']);
    const members = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const name = String(row[iName] || '').trim();
      if (!name) continue;
      members.push({
        name,
        role:    iRole  >= 0 ? String(row[iRole]  || '').trim() : '',
        quote:   iQuote >= 0 ? String(row[iQuote] || '').trim() : '',
        trait:   iTrait >= 0 ? String(row[iTrait] || '').trim() : '',
        section: iSec   >= 0 ? row[iSec] : '',
        pitch:   iPitch >= 0 ? String(row[iPitch] || '').trim() : '',
      });
    }
    if (!members.length) return { error: '没有读到任何成员行' };
    return { members };
  }
  function rosterFromCSV(text) { return rowsToRaw(parseCSV(text)); }

  function pick(obj, keys, fallback) {
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') return obj[k];
    }
    return fallback;
  }
  function rosterFromJSON(text) {
    let d;
    try { d = JSON.parse(text); } catch (e) { return { error: 'JSON 格式有误：' + e.message }; }
    const arr = Array.isArray(d) ? d : (Array.isArray(d.members) ? d.members : null);
    if (!arr) return { error: 'JSON 需要是成员数组，或含 members 字段的对象' };
    const members = arr.map(x => ({
      name:    String(pick(x, ['name', '姓名', '名字'], '')).trim(),
      role:    String(pick(x, ['role', '职责', '分工'], '')).trim(),
      quote:   String(pick(x, ['quote', '简介', '一句话', '介绍'], '')).trim(),
      trait:   String(pick(x, ['trait', '特色', '个人特色'], '')).trim(),
      section: pick(x, ['section', '声部', '组别', '分组'], ''),
      pitch:   String(pick(x, ['pitch', '音高'], '')).trim(),
      timbre:  x.timbre && x.timbre.wave ? { wave: x.timbre.wave, cutoff: +x.timbre.cutoff || 1800, vol: +x.timbre.vol || 0.85 } : null,
    })).filter(m => m.name);
    if (!members.length) return { error: 'JSON 里没有可用的成员' };
    let sections = null;
    if (!Array.isArray(d) && Array.isArray(d.sections) && d.sections.length === 3) {
      sections = d.sections.map((s, i) => ({
        name: String(s.name || ['低音声部', '中音声部', '高音声部'][i]),
        en:   String(s.en   || ['ROOT SECTION', 'MELODY SECTION', 'LIGHT SECTION'][i]),
        desc: String(s.desc || ''),
      }));
    }
    return { members, sections };
  }

  /* ---------- Excel：按需加载解析组件 ---------- */
  let xlsxLoading = null;
  function ensureXLSX() {
    if (window.XLSX) return Promise.resolve(true);
    if (xlsxLoading) return xlsxLoading;
    xlsxLoading = new Promise(res => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload = () => res(true);
      s.onerror = () => res(false);
      document.head.appendChild(s);
    });
    return xlsxLoading;
  }

  async function rosterFromFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'json') return rosterFromJSON(await file.text());
    if (ext === 'csv' || ext === 'txt') return rosterFromCSV(await file.text());
    if (ext === 'xlsx' || ext === 'xls') {
      const ok = await ensureXLSX();
      if (!ok) return { error: 'Excel 组件需要联网加载，当前不可用。请把表格另存为 CSV 再上传。' };
      const wb = XLSX.read(await file.arrayBuffer());
      const ws = wb.Sheets[wb.SheetNames[0]];
      return rowsToRaw(parseCSV(XLSX.utils.sheet_to_csv(ws)));
    }
    return { error: '支持 CSV / JSON / Excel(.xlsx) 文件' };
  }

  /* ---------- 声部解析：1/2/3、低/中/高、组名都认 ---------- */
  function parseSectionVal(v) {
    if (v === undefined || v === null) return -1;
    const t = String(v).trim().toLowerCase();
    if (!t) return -1;
    if (/^(low|bass|root|低|低音|低声部|低音声部|根音|根音组|一|第一声部|第一组)/.test(t)) return 0;
    if (/^(mid|middle|melody|中|中音|中声部|中音声部|主旋律|主旋律组|二|第二声部|第二组)/.test(t)) return 1;
    if (/^(high|light|treble|高|高音|高声部|高音声部|灵光|灵光组|三|第三声部|第三组)/.test(t)) return 2;
    const n = parseInt(t, 10);
    if (!isNaN(n)) { if (n === 0) return 0; if (n >= 1 && n <= 3) return n - 1; }
    return -1;
  }

  /* ---------- 归一化：分声部 → 排序 → 配音高音色 ---------- */
  function normalize(raw, sectionsIn) {
    const members = [], unassigned = [];
    const counts = [0, 0, 0], list = [[], [], []];
    for (const r of raw) {
      const name = String(r.name || '').trim();
      if (!name) continue;
      const m = {
        name: name.slice(0, 12),
        role: String(r.role || '成员').trim().slice(0, 24) || '成员',
        quote: String(r.quote || '').trim().slice(0, 60),
        trait: String(r.trait || '').trim().slice(0, 60),
        section: -1,
        pitch: String(r.pitch || '').trim(),
        timbre: r.timbre || null,
      };
      const s = parseSectionVal(r.section);
      if (s >= 0) { m.section = s; counts[s]++; list[s].push(m); }
      else unassigned.push(m);
    }
    /* 没填声部的 → 轮流分给人最少的声部 */
    for (const m of unassigned) {
      const s = counts.indexOf(Math.min(...counts));
      m.section = s; counts[s]++; list[s].push(m);
    }
    const total = counts[0] + counts[1] + counts[2];
    if (total < 3) return { error: '至少需要 3 位成员（三个声部各要有人）' };
    /* 保证每个声部至少一人 */
    for (let s = 0; s < 3; s++) {
      if (counts[s] === 0) {
        const big = counts.indexOf(Math.max(...counts));
        if (counts[big] <= 1) return { error: '至少需要 3 位成员（三个声部各要有人）' };
        const moved = list[big].pop();
        moved.section = s; counts[big]--; counts[s]++; list[s].push(moved);
      }
    }
    list.forEach(l => members.push(...l));
    if (members.length > 40) return { error: '人数太多啦：最多支持 40 位成员' };

    /* 音高：有效就用填的，否则按声部音区自动分配；音色：循环预设 */
    const k = [0, 0, 0];
    members.forEach((m, i) => {
      if (!AudioEngine.noteFreq(m.pitch)) m.pitch = PITCH_POOLS[m.section][k[m.section] % 5];
      if (!m.timbre) m.timbre = { ...TIMBRE_PRESETS[i % TIMBRE_PRESETS.length] };
      k[m.section]++;
    });

    const sections = (sectionsIn && sectionsIn.length === 3)
      ? sectionsIn
      : SECTIONS_DEFAULT.map(s => ({ ...s }));
    return { members, sections };
  }

  /* ---------- 模板与导出 ---------- */
  const CSV_HEAD = '姓名,职责,一句话简介,个人特色,声部,音高';
  const csvCell = v => {
    const s = String(v == null ? '' : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  function makeTemplateCSV() {
    return '\uFEFF' + [
      CSV_HEAD,
      '张三,组长·统筹,把复杂的事情变得简单一点,口头禅：先定deadline再谈梦想,1,',
      '李四,视觉设计,美是秩序的另一种名字,看晚霞会自动取色,2,C4',
      '王五,前端开发,保持好奇,能把bug调成彩蛋的人,3,',
      '（从这里继续往下加人）,,,,,',
    ].join('\r\n');
  }
  function exportCSV(members) {
    const lines = members.map(m =>
      [m.name, m.role, m.quote, m.trait, m.section + 1, m.pitch].map(csvCell).join(','));
    return '\uFEFF' + CSV_HEAD + '\r\n' + lines.join('\r\n');
  }
  function download(filename, text) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  }

  /* ---------- 界面接线 ---------- */
  function initUI(hooks) {
    const modal = document.getElementById('rosterModal');
    const btn = document.getElementById('rosterBtn');
    const input = document.getElementById('rfile');
    const status = document.getElementById('rstatus');

    const refresh = () => {
      status.textContent = `当前名单：${hooks.getLabel()} · ${hooks.getMembers().length} 人`;
    };
    const close = () => modal.classList.remove('show');
    /* 热替换后即使面板开着，状态也立即跟上 */
    const apply = (...args) => { hooks.apply(...args); refresh(); };

    btn.addEventListener('click', e => { e.stopPropagation(); refresh(); modal.classList.add('show'); });
    document.getElementById('rosterClose').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    document.getElementById('rupload').addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      input.value = '';
      if (!file) return;
      hooks.toast('正在读取名单…');
      let raw;
      try { raw = await rosterFromFile(file); }
      catch (err) { hooks.toast('读取失败：' + err.message, true); return; }
      if (raw.error) { hooks.toast(raw.error, true); return; }
      const n = normalize(raw.members, raw.sections);
      if (n.error) { hooks.toast(n.error, true); return; }
      const label = file.name.replace(/\.(csv|json|xlsx|xls|txt)$/i, '') || '自定义名单';
      close();
      apply(n.members, n.sections, label);
    });

    document.getElementById('rtpl').addEventListener('click',
      () => download('我们的乐章-名单模板.csv', makeTemplateCSV()));
    document.getElementById('rexport').addEventListener('click',
      () => download('我们的乐章-当前名单.csv', exportCSV(hooks.getMembers())));
    document.getElementById('rreset').addEventListener('click', () => { close(); hooks.resetDefault(); refresh(); });
  }

  return { loadStored, persist, clearStored, rosterFromFile, normalize, initUI };
})();
