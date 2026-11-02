// Giao diện & luồng ban/pick
(() => {
  const { HEROES, HERO_LIST, TIER_LABEL, laneName } = Engine;

  // b = Xanh, r = Đỏ ; B = cấm, P = chọn
  const FORMATS = {
    rank6: {
      name: 'Xếp hạng — 6 cấm',
      desc: 'Mỗi đội cấm 3 → chọn theo thứ tự 1-2-2-2-2-1',
      steps: 'bB rB bB rB bB rB bP rP rP bP bP rP rP bP bP rP',
    },
    pro8: {
      name: 'Giải đấu — 8 cấm (2 giai đoạn)',
      desc: 'Cấm 4 → Chọn 6 → Cấm 4 → Chọn 4',
      steps: 'bB rB bB rB bP rP rP bP bP rP rB bB rB bB rP bP bP rP',
    },
    nb: {
      name: 'Không cấm',
      desc: 'Chỉ chọn tướng, thứ tự 1-2-2-2-2-1',
      steps: 'bP rP rP bP bP rP rP bP bP rP',
    },
  };
  const parseSteps = (str) => str.split(' ').map((s) => ({ side: s[0] === 'b' ? 'blue' : 'red', type: s[1] === 'B' ? 'ban' : 'pick' }));
  const other = (side) => (side === 'blue' ? 'red' : 'blue');
  const SIDE_NAME = { blue: 'Đội Xanh', red: 'Đội Đỏ' };
  const STORE_KEY = 'bp-lienquan-v1';

  const S = {
    screen: 'setup',
    mySide: null,
    format: 'rank6',
    actions: [], // {side, type, id, lane}
    tab: 'all',
    laneFilter: 'all',
    search: '',
    sort: 'tier',
  };

  // ---------- Trạng thái suy ra ----------
  const steps = () => parseSteps(FORMATS[S.format].steps);
  const curStep = () => steps()[S.actions.length] || null;
  const isDone = () => S.actions.length >= steps().length;
  const picksOf = (side) => S.actions.filter((a) => a.type === 'pick' && a.side === side);
  const bansOf = (side) => S.actions.filter((a) => a.type === 'ban' && a.side === side);
  const used = () => new Set(S.actions.map((a) => a.id));
  const stepsLeft = (side, type) => steps().slice(S.actions.length).filter((s) => s.side === side && s.type === type).length;

  function ctxFor(side) {
    const enemyPicks = picksOf(other(side));
    return {
      allies: picksOf(side).map((a) => ({ id: a.id, lane: a.lane })),
      enemies: enemyPicks.map((a) => ({ id: a.id, lane: a.lane })),
      lastEnemy: enemyPicks.length ? enemyPicks[enemyPicks.length - 1].id : null,
      unavailable: used(),
      enemyPicksLeft: stepsLeft(other(side), 'pick'),
      myPicksLeft: stepsLeft(side, 'pick'),
    };
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ mySide: S.mySide, format: S.format, actions: S.actions, screen: S.screen }));
    } catch (e) { /* bỏ qua */ }
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (d && d.mySide && FORMATS[d.format]) {
        Object.assign(S, { mySide: d.mySide, format: d.format, actions: (d.actions || []).filter((a) => HEROES[a.id]), screen: d.screen || 'draft' });
      }
    } catch (e) { /* bỏ qua */ }
  }

  // ---------- Hành động ----------
  function commit(id) {
    const st = curStep();
    const h = HEROES[id];
    if (!st || !h || used().has(id)) return;
    const act = { side: st.side, type: st.type, id };
    if (st.type === 'pick') {
      const team = picksOf(st.side).map((a) => ({ id: a.id, lane: a.lane }));
      act.lane = Engine.bestLane(h, team) || Engine.openLanes(team)[0];
    }
    S.actions.push(act);
    S.tab = 'all';
    S.search = '';
    toast(`${SIDE_NAME[st.side]} ${st.type === 'ban' ? 'cấm' : 'chọn'} <b>${h.name}</b>${act.lane ? ` · ${laneName(act.lane)}` : ''}`);
    save();
    render();
  }
  function undo() {
    if (!S.actions.length) return;
    const a = S.actions.pop();
    toast(`Đã hoàn tác: ${HEROES[a.id].name}`);
    save();
    render();
  }
  function setLane(idx, lane) {
    const a = S.actions[idx];
    if (!a) return;
    const clash = S.actions.find((x) => x !== a && x.type === 'pick' && x.side === a.side && x.lane === lane);
    if (clash) clash.lane = a.lane;
    a.lane = lane;
    save();
    render();
  }
  function start(side) {
    S.mySide = side;
    S.actions = [];
    S.screen = 'draft';
    S.tab = 'all';
    save();
    render();
  }

  // ---------- Tiện ích hiển thị ----------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const initials = (n) => n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const CLS_KEY = { 'Đấu sĩ': 'fighter', 'Sát thủ': 'assassin', 'Pháp sư': 'mage', 'Xạ thủ': 'marksman', 'Đỡ đòn': 'tank', 'Trợ thủ': 'support' };
  function avatar(h, extra = '') {
    const f = HERO_IMG[h.name];
    const img = f ? `<img src="${IMG_BASE}${f}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : '';
    return `<div class="av ${CLS_KEY[h.cls] || ''} ${extra}"><span>${esc(initials(h.name))}</span>${img}</div>`;
  }
  const tierBadge = (t) => (t ? `<span class="tier t-${t}" title="${TIER_LABEL[t]}">${t}</span>` : '');
  const laneTier = (h, lane) => (h.lanes[lane] ? h.lanes[lane].tier : null);
  const bestTier = (h) => (h.lanes[h.mainLane] ? h.lanes[h.mainLane].tier : null);

  let toastTimer;
  function toast(html) {
    const el = document.getElementById('toast');
    el.innerHTML = html;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  // ---------- Màn hình chọn bên ----------
  function renderSetup() {
    const fm = Object.entries(FORMATS).map(([k, f]) => `
      <label class="fmt ${S.format === k ? 'on' : ''}">
        <input type="radio" name="fmt" value="${k}" ${S.format === k ? 'checked' : ''} data-act="format">
        <b>${f.name}</b><small>${f.desc}</small>
      </label>`).join('');
    const top = Engine.HERO_LIST.filter((h) => Object.values(h.lanes).some((l) => l.tier === 'S' && !l.off))
      .sort((a, b) => b.bestMeta - a.bestMeta).slice(0, 10)
      .map((h) => `<div class="mini" title="${esc(h.name)} — ${laneName(h.mainLane)}">${avatar(h)}<span>${esc(h.name)}</span></div>`).join('');
    return `
    <div class="setup">
      <h1>Trợ lý <span>Ban / Pick</span> Liên Quân</h1>
      <p class="sub">Gợi ý cấm & chọn tướng theo tier meta, kèo khắc chế và độ hợp cặp đội hình.</p>
      <div class="formats">${fm}</div>
      <div class="sides">
        <button class="side-card blue" data-act="start" data-side="blue">
          <div class="side-title">ĐỘI XANH</div>
          <div class="side-sub">Pick trước</div>
          <ul><li>Được chọn tướng mạnh nhất đầu tiên</li><li>Lượt chọn: 1 · 4-5 · 8-9</li></ul>
          <span class="go">Chọn bên Xanh →</span>
        </button>
        <button class="side-card red" data-act="start" data-side="red">
          <div class="side-title">ĐỘI ĐỎ</div>
          <div class="side-sub">Pick sau</div>
          <ul><li>Được counter-pick & chọn cuối</li><li>Lượt chọn: 2-3 · 6-7 · 10</li></ul>
          <span class="go">Chọn bên Đỏ →</span>
        </button>
      </div>
      <div class="meta-strip"><h3>Tướng tier S hiện tại</h3><div class="minis">${top}</div></div>
    </div>`;
  }

  // ---------- Màn hình ban/pick ----------
  function teamPanel(side) {
    const st = curStep();
    const mine = side === S.mySide;
    const active = st && st.side === side;
    const banCount = steps().filter((s) => s.side === side && s.type === 'ban').length;
    const bans = bansOf(side);
    const picks = picksOf(side);
    let banHtml = '';
    for (let i = 0; i < banCount; i++) {
      const a = bans[i];
      const cur = active && st.type === 'ban' && i === bans.length;
      banHtml += a
        ? `<div class="ban-slot filled" title="${esc(HEROES[a.id].name)}">${avatar(HEROES[a.id], 'sm')}</div>`
        : `<div class="ban-slot ${cur ? 'cur' : ''}"><span>⊘</span></div>`;
    }
    let pickHtml = '';
    for (let i = 0; i < 5; i++) {
      const a = picks[i];
      const cur = active && st.type === 'pick' && i === picks.length;
      if (a) {
        const h = HEROES[a.id];
        const idx = S.actions.indexOf(a);
        const opts = LANES.map((l) => `<option value="${l.id}" ${l.id === a.lane ? 'selected' : ''}>${l.name}</option>`).join('');
        const t = laneTier(h, a.lane);
        pickHtml += `
          <div class="pick-slot filled">
            ${avatar(h)}
            <div class="pinfo">
              <b>${esc(h.name)}</b>
              <div class="prow">
                <select data-act="lane" data-idx="${idx}" title="Đổi đường">${opts}</select>
                ${t ? tierBadge(t) : '<span class="tier t-x" title="Không có trong tier đường này">–</span>'}
              </div>
            </div>
          </div>`;
      } else {
        pickHtml += `<div class="pick-slot ${cur ? 'cur' : ''}"><div class="av empty"><span>${i + 1}</span></div><div class="pinfo"><i>${cur ? 'Đang chọn…' : 'Chưa chọn'}</i></div></div>`;
      }
    }
    return `
      <section class="team ${side} ${active ? 'active' : ''}">
        <header>
          <div><span class="dot"></span>${SIDE_NAME[side].toUpperCase()} ${mine ? '<em>BẠN</em>' : '<em class="op">ĐỐI THỦ</em>'}</div>
          <small>${side === 'blue' ? 'Pick trước' : 'Pick sau'}</small>
        </header>
        ${banCount ? `<div class="bans">${banHtml}</div>` : ''}
        <div class="picks">${pickHtml}</div>
      </section>`;
  }

  function timeline() {
    return steps().map((s, i) => {
      const a = S.actions[i];
      const cur = i === S.actions.length;
      const label = a ? esc(HEROES[a.id].name) : s.type === 'ban' ? 'Cấm' : 'Chọn';
      return `<div class="tl ${s.side} ${s.type} ${a ? 'done' : ''} ${cur ? 'cur' : ''}" title="${i + 1}. ${SIDE_NAME[s.side]} ${s.type === 'ban' ? 'cấm' : 'chọn'}">${i + 1}<span>${label}</span></div>`;
    }).join('');
  }

  const REASON_ICON = { counter: '⚔', syn: '🤝', comp: '🧩', meta: '📈', safe: '🛡', flex: '🔀', deny: '✋', warn: '⚠' };

  function sugCard(e, rank, maxTotal, type) {
    const h = e.hero;
    const pct = Math.max(8, Math.round((e.total / maxTotal) * 100));
    const reasons = e.reasons.slice(0, 5).map((r) => `<li class="r-${r.t}"><i>${REASON_ICON[r.t] || '•'}</i>${esc(r.s)}</li>`).join('');
    const pro = h.pros[0] ? `<div class="pro">💡 ${esc(h.pros[0])}</div>` : '';
    return `
      <div class="sug ${rank === 1 ? 'top1' : ''}">
        <div class="rank">#${rank}</div>
        ${avatar(h, 'lg')}
        <div class="sug-body">
          <div class="sug-head">
            <b>${esc(h.name)}</b>${tierBadge(laneTier(h, e.lane))}
            <span class="chip lane">${laneName(e.lane)}</span>${h.cls !== laneName(e.lane) ? `<span class="chip">${esc(h.cls)}</span>` : ''}
          </div>
          <div class="bar"><i style="width:${pct}%"></i><span>${type === 'ban' ? 'Mức nguy hiểm' : 'Độ phù hợp'} ${Math.round(e.total)}</span></div>
          <ul class="reasons">${reasons}</ul>
          ${pro}
        </div>
        <button class="btn-act ${type}" data-act="choose" data-id="${h.id}">${type === 'ban' ? 'Cấm' : 'Chọn'}</button>
      </div>`;
  }

  function suggestionPanel(st) {
    const ctx = ctxFor(S.mySide);
    let tabs, list, empty = '';
    if (st.type === 'pick') {
      const sg = Engine.suggestPicks(ctx);
      const lastE = ctx.lastEnemy ? HEROES[ctx.lastEnemy].name : null;
      tabs = [
        ['all', '⭐ Tổng hợp tốt nhất'],
        ['syn', '🤝 Hợp đội hình'],
        ['ctr', `⚔ Khắc chế${lastE ? ' ' + esc(lastE) : ' đối thủ'}`],
      ];
      if (!sg[S.tab]) S.tab = 'all';
      list = sg[S.tab];
      if (S.tab === 'syn' && !list.length) empty = ctx.allies.length ? 'Không có tướng còn lại hợp cặp rõ rệt với đội hình hiện tại.' : 'Đội bạn chưa có tướng nào — chọn tướng đầu tiên ở tab Tổng hợp.';
      if (S.tab === 'ctr' && !list.length) empty = ctx.enemies.length ? 'Không còn tướng khắc chế trực tiếp trong pool.' : 'Đối thủ chưa chọn tướng nào để khắc chế.';
    } else {
      const sg = Engine.suggestBans(ctx);
      tabs = [['all', '⭐ Nên cấm nhất'], ['threat', '🛡 Bảo vệ đội hình']];
      if (!sg[S.tab]) S.tab = 'all';
      list = sg[S.tab];
      if (S.tab === 'threat' && !list.length) empty = ctx.allies.length ? 'Không có tướng nào đặc biệt đe dọa đội hình của bạn.' : 'Bạn chưa chọn tướng nào — hãy cấm theo meta ở tab đầu.';
    }
    const maxTotal = Math.max(1, ...list.map((e) => e.total));
    const tabHtml = tabs.map(([k, n]) => `<button class="tab ${S.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}">${n}</button>`).join('');
    const intro = st.type === 'pick'
      ? (ctx.allies.length === 0 && ctx.enemies.length === 0
        ? 'Pick đầu: ưu tiên tướng mạnh nhất meta, ít bị khắc chế và linh hoạt nhiều đường.'
        : `Gợi ý dựa trên ${ctx.allies.length} tướng đồng đội, ${ctx.enemies.length} tướng đối thủ và các đường còn trống: ${Engine.openLanes(ctx.allies).map(laneName).join(', ')}.`)
      : 'Gợi ý cấm: tướng meta mạnh đối thủ có thể dùng, tướng khắc chế đội bạn hoặc hợp cặp với đội đối thủ.';
    return `
      <div class="panel sugs">
        <div class="tabs">${tabHtml}</div>
        <p class="intro">${intro}</p>
        ${list.length ? list.map((e, i) => sugCard(e, i + 1, maxTotal, st.type)).join('') : `<div class="empty">${empty}</div>`}
      </div>`;
  }

  function poolPanel(st) {
    const lanes = [['all', 'Tất cả'], ...LANES.map((l) => [l.id, `${l.icon} ${l.name}`])];
    const laneHtml = lanes.map(([k, n]) => `<button class="lf ${S.laneFilter === k ? 'on' : ''}" data-act="lanef" data-lane="${k}">${n}</button>`).join('');
    const myTurn = st && st.side === S.mySide;
    const sortOpts = [['tier', 'Theo tier'], ['name', 'Theo tên'], ...(myTurn ? [['score', 'Theo điểm gợi ý']] : [])];
    if (!myTurn && S.sort === 'score') S.sort = 'tier';
    const title = !st ? '' : myTurn
      ? `Hoặc tự chọn tướng để ${st.type === 'ban' ? 'cấm' : 'chọn'}`
      : `Đối thủ đã ${st.type === 'ban' ? 'CẤM' : 'CHỌN'} tướng nào? Bấm vào tướng đó`;
    return `
      <div class="panel pool ${myTurn ? '' : 'enemy-turn'}">
        <div class="pool-head">
          <h3>${title}</h3>
          <div class="pool-tools">
            <input id="search" type="search" placeholder="Tìm tướng… (phím /)" value="${esc(S.search)}" autocomplete="off">
            <select data-act="sort">${sortOpts.map(([k, n]) => `<option value="${k}" ${S.sort === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
          </div>
        </div>
        <div class="lane-filter">${laneHtml}</div>
        <div id="grid" class="grid"></div>
      </div>`;
  }

  function renderGrid() {
    const grid = document.getElementById('grid');
    if (!grid) return;
    const st = curStep();
    const u = used();
    const q = Engine.slug(S.search);
    const lf = S.laneFilter;
    let scoreMap = null;
    if (st && st.side === S.mySide && S.sort === 'score') {
      const ctx = ctxFor(S.mySide);
      scoreMap = st.type === 'pick' ? Engine.suggestPicks(ctx).map : Engine.suggestBans(ctx).map;
    }
    let list = HERO_LIST.filter((h) => (lf === 'all' || h.lanes[lf]) && (!q || h.id.includes(q)));
    const metaOf = (h) => (lf === 'all' ? h.bestMeta : h.lanes[lf].meta);
    if (S.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    else if (scoreMap) list.sort((a, b) => ((scoreMap.get(b.id) || { total: -999 }).total - (scoreMap.get(a.id) || { total: -999 }).total));
    else list.sort((a, b) => metaOf(b) - metaOf(a));
    list.sort((a, b) => u.has(a.id) - u.has(b.id)); // tướng đã cấm/chọn xuống cuối (sort ổn định)
    const statusOf = (id) => {
      const a = S.actions.find((x) => x.id === id);
      if (!a) return '';
      return a.type === 'ban' ? 'Đã cấm' : SIDE_NAME[a.side];
    };
    grid.innerHTML = list.length ? list.map((h) => {
      const taken = u.has(h.id);
      const t = lf === 'all' ? bestTier(h) : laneTier(h, lf);
      const sc = scoreMap && scoreMap.get(h.id);
      const lanesTxt = Object.keys(h.lanes).map((l) => `${laneName(l)} ${h.lanes[l].tier}`).join(' · ');
      return `<button class="tile ${taken ? 'taken' : ''}" ${taken || !st ? 'disabled' : ''} data-act="choose" data-id="${h.id}" title="${esc(h.name)} — ${esc(h.cls)}\n${lanesTxt}">
        ${avatar(h)}${tierBadge(t)}
        <span class="nm">${esc(h.name)}</span>
        ${taken ? `<span class="st">${statusOf(h.id)}</span>` : sc ? `<span class="sc">${Math.round(sc.total)}</span>` : ''}
      </button>`;
    }).join('') : '<div class="empty">Không tìm thấy tướng.</div>';
  }

  function analysisPanel() {
    const blue = picksOf('blue').map((a) => ({ id: a.id, lane: a.lane }));
    const red = picksOf('red').map((a) => ({ id: a.id, lane: a.lane }));
    const m = Engine.analyzeMatch(blue, red);
    const pb = Math.round(m.pBlue * 100);
    const col = (side, a) => {
      const li = (arr, cls) => arr.map((x) => `<li class="${cls}">${esc(x)}</li>`).join('');
      return `
        <div class="ana ${side}">
          <h3>${SIDE_NAME[side]} ${side === S.mySide ? '(Bạn)' : '(Đối thủ)'}</h3>
          <div class="kv"><span>Điểm meta trung bình</span><b>${Math.round(a.metaAvg)}</b></div>
          <div class="kv"><span>Cặp hợp nhau</span><b>${a.pairs.length}</b></div>
          <div class="kv"><span>Kèo khắc chế có lợi</span><b>${a.countersFor.length}</b></div>
          <ul>
            ${li(a.good, 'good')}${li(a.bad, 'bad')}
            ${a.pairs.length ? `<li class="syn">Hợp cặp: ${esc(a.pairs.join(', '))}</li>` : ''}
            ${a.countersFor.length ? `<li class="good">Khắc chế: ${esc(a.countersFor.join(', '))}</li>` : ''}
          </ul>
        </div>`;
    };
    const mine = S.mySide === 'blue' ? pb : 100 - pb;
    const verdict = mine >= 58 ? 'Đội hình của bạn đang có lợi thế rõ rệt 💪' : mine >= 45 ? 'Hai đội hình khá cân bằng — chơi tốt là thắng ⚖' : 'Đội hình đối thủ nhỉnh hơn — tập trung vào kèo có lợi của bạn 🎯';
    return `
      <div class="panel analysis">
        <h2>Hoàn tất Ban/Pick</h2>
        <div class="winbar"><div class="wb blue" style="width:${pb}%">${pb}%</div><div class="wb red" style="width:${100 - pb}%">${100 - pb}%</div></div>
        <p class="verdict">${verdict}</p>
        <div class="ana-cols">${col('blue', m.blue)}${col('red', m.red)}</div>
        <p class="note">* Tỉ lệ chỉ là ước lượng từ tier, kèo khắc chế và cấu trúc đội hình — không phải dữ liệu thắng thật.</p>
        <div class="end-btns"><button class="btn" data-act="restart">⟳ Ban/Pick lại (giữ bên)</button><button class="btn ghost" data-act="setup">⇆ Đổi bên / thể thức</button></div>
      </div>`;
  }

  function renderDraft() {
    const st = curStep();
    const myTurn = st && st.side === S.mySide;
    const stepNo = Math.min(S.actions.length + 1, steps().length);
    const banner = st
      ? `<div class="banner ${st.side} ${myTurn ? 'mine' : 'theirs'}">
          <div class="b-main">${myTurn ? 'LƯỢT CỦA BẠN' : 'LƯỢT ĐỐI THỦ'} — ${SIDE_NAME[st.side]} ${st.type === 'ban' ? 'CẤM' : 'CHỌN'} tướng</div>
          <div class="b-sub">Bước ${stepNo}/${steps().length} · ${FORMATS[S.format].name}</div>
        </div>`
      : '';
    return `
      <div class="draft">
        <header class="top">
          <div class="brand">Ban/Pick <span>Liên Quân</span></div>
          <div class="src">Tier: <a href="${TIER_SOURCE.url}" target="_blank" rel="noopener">${TIER_SOURCE.name}</a> · ${TIER_SOURCE.season} · cập nhật ${TIER_SOURCE.updated}</div>
          <div class="actions">
            <button class="btn ghost" data-act="undo" ${S.actions.length ? '' : 'disabled'} title="Ctrl+Z">↶ Hoàn tác</button>
            <button class="btn ghost" data-act="restart">⟳ Làm lại</button>
            <button class="btn ghost" data-act="setup">⇆ Đổi bên</button>
          </div>
        </header>
        <div class="timeline">${timeline()}</div>
        <main class="board">
          ${teamPanel('blue')}
          <div class="center">
            ${banner}
            ${isDone() ? analysisPanel() : ''}
            ${myTurn ? suggestionPanel(st) : ''}
            ${st ? poolPanel(st) : ''}
          </div>
          ${teamPanel('red')}
        </main>
      </div>`;
  }

  function render() {
    const app = document.getElementById('app');
    app.innerHTML = S.screen === 'setup' ? renderSetup() : renderDraft();
    renderGrid();
  }

  // ---------- Sự kiện ----------
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const act = el.dataset.act;
    if (act === 'start') start(el.dataset.side);
    else if (act === 'choose') commit(el.dataset.id);
    else if (act === 'undo') undo();
    else if (act === 'restart') { S.actions = []; S.tab = 'all'; save(); render(); }
    else if (act === 'setup') { S.screen = 'setup'; save(); render(); }
    else if (act === 'tab') { S.tab = el.dataset.tab; render(); }
    else if (act === 'lanef') { S.laneFilter = el.dataset.lane; document.querySelectorAll('.lf').forEach((b) => b.classList.toggle('on', b === el)); renderGrid(); }
  });
  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.dataset.act === 'format') { S.format = el.value; render(); }
    else if (el.dataset.act === 'lane') setLane(+el.dataset.idx, el.value);
    else if (el.dataset.act === 'sort') { S.sort = el.value; renderGrid(); }
  });
  document.addEventListener('input', (ev) => {
    if (ev.target.id === 'search') { S.search = ev.target.value; renderGrid(); }
  });
  document.addEventListener('keydown', (ev) => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z' && S.screen === 'draft' && ev.target.id !== 'search') {
      ev.preventDefault();
      undo();
    } else if (ev.key === '/' && document.activeElement.id !== 'search') {
      const s = document.getElementById('search');
      if (s) { ev.preventDefault(); s.focus(); }
    } else if (ev.key === 'Enter' && ev.target.id === 'search') {
      const first = document.querySelector('#grid .tile:not(.taken)');
      if (first) commit(first.dataset.id);
    }
  });

  load();
  render();
})();
