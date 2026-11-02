// Engine gợi ý ban/pick: kết hợp tier meta theo đường + kèo khắc chế + hợp cặp + cân bằng đội hình.
const Engine = (() => {
  const TIER_BASE = { S: 100, A: 84, B: 68, C: 52, D: 38 };
  const TIER_LABEL = { S: 'Rất mạnh', A: 'Mạnh', B: 'Ổn', C: 'Tình huống', D: 'Yếu' };
  const LANE_IDS = LANES.map((l) => l.id);
  const LANE_BY_ID = Object.fromEntries(LANES.map((l) => [l.id, l]));
  const laneName = (id) => (LANE_BY_ID[id] ? LANE_BY_ID[id].name : '?');

  const slug = (s) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .toLowerCase().replace(/[^a-z0-9]/g, '');

  // ---------- Dựng cơ sở dữ liệu tướng ----------
  const HEROES = {};
  const ensure = (name) => {
    const id = slug(name);
    if (!HEROES[id]) {
      HEROES[id] = {
        id, name, cls: '', dmgRaw: '', lanes: {},
        weakTo: [], strongVs: [], synergy: [], pros: [], cons: [],
      };
    }
    return HEROES[id];
  };

  for (const lane of LANES) {
    const entries = TIER_RAW[lane.id].split('|').map((s) => s.trim()).filter(Boolean);
    const total = entries.length;
    entries.forEach((raw, idx) => {
      const off = raw.endsWith('*');
      const [name, tier, score] = raw.replace('*', '').split(':');
      const h = ensure(name);
      const meta = TIER_BASE[tier] + (1 - idx / Math.max(1, total - 1)) * 10 - (off ? 3 : 0);
      h.lanes[lane.id] = { tier, score: parseFloat(score), rank: idx + 1, total, off, meta };
    });
  }

  const FIELD = { weak_to: 'weakTo', strong_vs: 'strongVs', synergy: 'synergy' };
  HERO_RAW.trim().split('\n').forEach((line) => {
    const parts = line.split('|');
    if (parts.length < 3) return;
    const h = ensure(parts[0].trim());
    h.cls = parts[1].trim();
    h.dmgRaw = parts[2].trim();
    for (const p of parts.slice(3)) {
      const i = p.indexOf(':');
      const k = p.slice(0, i).trim();
      const v = p.slice(i + 1);
      if (k === 'pros' || k === 'cons') h[k] = v.split(';').map((s) => s.trim()).filter(Boolean);
      else if (FIELD[k]) h[FIELD[k]] = v.split(',').map((s) => slug(s.trim())).filter(Boolean);
    }
  });

  const CC_RE = /choáng|hất|trói|câm lặng|đóng băng|khiêu khích|giam|chôn|ghim|áp chế|khống chế|kéo|lôi|nuốt|giữ chặt|giữ mục tiêu/i;
  for (const h of Object.values(HEROES)) {
    if (!h.cls) h.cls = h.lanes.sp ? 'Trợ thủ' : h.lanes.ad ? 'Xạ thủ' : h.lanes.mid ? 'Pháp sư' : 'Đấu sĩ';
    if (h.dmgRaw.includes('/')) h.dmg = 'MIX';
    else if (h.dmgRaw.includes('phép')) h.dmg = 'AP';
    else if (h.dmgRaw.includes('vật lý')) h.dmg = 'AD';
    else h.dmg = ['Pháp sư', 'Trợ thủ', 'Đỡ đòn'].includes(h.cls) ? 'AP' : 'AD';
    h.hardCC = h.cls === 'Đỡ đòn' || CC_RE.test(h.pros.join(' '));
    h.isTank = h.cls === 'Đỡ đòn';
    h.melee = ['Đấu sĩ', 'Đỡ đòn', 'Sát thủ'].includes(h.cls);
    const metas = Object.values(h.lanes).map((l) => l.meta);
    h.bestMeta = metas.length ? Math.max(...metas) : 30;
    h.mainLane = Object.keys(h.lanes).sort((a, b) => h.lanes[b].meta - h.lanes[a].meta)[0] || 'top';
  }
  // Bỏ tướng không có trong bảng tier (không có dữ liệu đường)
  for (const id of Object.keys(HEROES)) if (!Object.keys(HEROES[id].lanes).length) delete HEROES[id];

  const HERO_LIST = Object.values(HEROES).sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  // a khắc chế b? (0, 1 hoặc 2 nguồn xác nhận)
  const counterRel = (a, b) => (a.strongVs.includes(b.id) ? 1 : 0) + (b.weakTo.includes(a.id) ? 1 : 0);
  const synRel = (a, b) => (a.synergy.includes(b.id) ? 1 : 0) + (b.synergy.includes(a.id) ? 1 : 0);
  // Danh sách tướng khắc chế h
  const THREATS = {};
  for (const h of HERO_LIST) THREATS[h.id] = HERO_LIST.filter((o) => o.id !== h.id && counterRel(o, h) > 0).map((o) => o.id);
  // Tướng chưa có dữ liệu kèo đấu: dùng số tướng khắc chế trung vị để không bị ưu tiên sai
  for (const h of HERO_LIST) h.noMatchup = !h.weakTo.length && !h.strongVs.length;
  const sortedThreat = HERO_LIST.filter((h) => !h.noMatchup).map((h) => THREATS[h.id].length).sort((a, b) => a - b);
  const MEDIAN_THREATS = sortedThreat[Math.floor(sortedThreat.length / 2)] || 4;

  const laneFaces = (a, b) => a === b || (['ad', 'sp'].includes(a) && ['ad', 'sp'].includes(b));
  const hasTxt = (h, re) => re.test(h.pros.join(' '));

  // Giải thích ngắn gọn VÌ SAO a khắc chế b
  function whyCounter(a, b) {
    const bCons = b.cons.join(' ');
    if (a.cls === 'Sát thủ' && ['Pháp sư', 'Xạ thủ'].includes(b.cls)) {
      if (/thoát|lướt|cơ động|lao vào|sát thủ|áp sát/i.test(bCons)) return `${b.name} ít đường thoát, sợ bị áp sát bộc phá`;
      return `sát thủ cơ động, bắt được ${b.name} máu giấy ở hàng sau`;
    }
    if (hasTxt(a, /không (thể )?bị chọn|miễn khống chế|giải khống chế|né/i) && b.hardCC)
      return `né/miễn được khống chế của ${b.name}`;
    if (a.hardCC && ['Sát thủ', 'Đấu sĩ'].includes(b.cls))
      return `khống chế cứng bắt bài ${b.name} khi lao vào`;
    if (hasTxt(a, /chuẩn|theo máu|xuyên giáp|giảm giáp/i) && (b.isTank || b.cls === 'Đấu sĩ'))
      return `sát thương chuẩn/theo % máu xé lớp chống chịu của ${b.name}`;
    if (!a.melee && b.melee && /tầm|cấu máu|thả diều|đánh xa/i.test(bCons))
      return `đánh xa thả diều, ${b.name} khó áp sát`;
    if (a.hardCC) return `khống chế giữ chân ${b.name}`;
    return `lợi thế kèo đấu trực tiếp`;
  }

  // ---------- Ngữ cảnh ----------
  // ctx = { allies:[{id,lane}], enemies:[{id,lane}], lastEnemy, unavailable:Set, enemyPicksLeft, myPicksLeft }
  const openLanes = (team) => LANE_IDS.filter((l) => !team.some((p) => p.lane === l));

  function bestLane(hero, team) {
    const opts = openLanes(team).filter((l) => hero.lanes[l]);
    if (!opts.length) return null;
    return opts.reduce((b, l) => (hero.lanes[l].meta > hero.lanes[b].meta ? l : b));
  }

  function profile(team) {
    const p = { ap: 0, ad: 0, front: 0, cc: 0, assassins: [] };
    for (const m of team) {
      const h = HEROES[m.id];
      if (!h) continue;
      const w = m.lane === 'sp' ? 0.3 : 1;
      if (h.dmg === 'AP') p.ap += w;
      else if (h.dmg === 'AD') p.ad += w;
      else { p.ap += w / 2; p.ad += w / 2; }
      if (h.isTank) p.front += 1;
      else if (h.cls === 'Đấu sĩ' && ['top', 'jg', 'sp'].includes(m.lane)) p.front += 0.5;
      if (h.hardCC) p.cc += 1;
      if (h.cls === 'Sát thủ') p.assassins.push(h.name);
    }
    return p;
  }

  // ---------- Đánh giá PICK ----------
  function evaluatePick(hero, ctx) {
    const lane = bestLane(hero, ctx.allies);
    if (!lane) return null;
    const li = hero.lanes[lane];
    const r = {
      hero, lane, meta: li.meta, counter: 0, counterPos: 0, counterLatest: 0,
      synergy: 0, comp: 0, safety: 0, bonus: 0, reasons: [],
    };
    const add = (t, s, w = 0) => r.reasons.push({ t, s, w });

    add('meta', `Tier ${li.tier} (${TIER_LABEL[li.tier]}) ở ${laneName(lane)}${li.off ? ' — đường phụ' : ''}, hạng ${li.rank}/${li.total}`,
      li.tier === 'S' ? 6.5 : li.tier === 'A' ? 4.5 : 1);
    if (hero.noMatchup) add('warn', 'Chưa có dữ liệu kèo khắc chế — điểm an toàn tính ở mức trung bình', 2);

    // Khắc chế / bị khắc chế
    for (const e of ctx.enemies) {
      const eh = HEROES[e.id];
      if (!eh) continue;
      const c = counterRel(hero, eh);
      if (c) {
        const direct = laneFaces(lane, e.lane);
        const latest = e.id === ctx.lastEnemy;
        let v = (c === 2 ? 16 : 11) + (direct ? 4 : 0);
        if (latest) v *= 1.3;
        r.counter += v;
        r.counterPos += v;
        if (latest) r.counterLatest += v;
        add('counter', `Khắc chế ${eh.name}${latest ? ' (vừa được chọn)' : ''}${direct ? ` — đối đầu trực tiếp ở ${laneName(e.lane)}` : ''}: ${whyCounter(hero, eh)}`, 10 + v);
      }
      const w = counterRel(eh, hero);
      if (w) {
        const v = w === 2 ? 14 : 9;
        r.counter -= v;
        add('warn', `Bị ${eh.name} khắc chế — ${whyCounter(eh, hero)}`, 5);
      }
    }

    // Hợp cặp với đồng đội
    for (const a of ctx.allies) {
      const ah = HEROES[a.id];
      if (!ah) continue;
      const s = synRel(hero, ah);
      if (s) {
        const duo = laneFaces(lane, a.lane) && lane !== a.lane;
        const v = (s === 2 ? 14 : 10) + (duo ? 3 : 0);
        r.synergy += v;
        add('syn', `Hợp cặp với ${ah.name}${s === 2 ? ' (kết hợp hai chiều)' : ''}${duo ? ' — cặp đôi đường Rồng' : ''}`, 9 + v);
      }
    }

    // Cân bằng đội hình
    const prof = profile(ctx.allies);
    const carryLane = lane !== 'sp';
    const isAP = hero.dmg === 'AP' || hero.dmg === 'MIX';
    const isAD = hero.dmg === 'AD' || hero.dmg === 'MIX';
    if (ctx.allies.length >= 2 && carryLane) {
      if (prof.ap < 0.6 && isAP) { r.comp += 7; add('comp', 'Đội đang thiếu sát thương phép — giúp cân bằng sát thương', 8); }
      if (prof.ad < 0.6 && isAD) { r.comp += 7; add('comp', 'Đội đang thiếu sát thương vật lý — giúp cân bằng sát thương', 8); }
      if (prof.ad >= 3 && hero.dmg === 'AD') { r.comp -= 6; add('warn', 'Đội đã dồn nhiều sát thương vật lý, đối thủ dễ lên giáp', 4); }
      if (prof.ap >= 3 && hero.dmg === 'AP') { r.comp -= 6; add('warn', 'Đội đã dồn nhiều sát thương phép, đối thủ dễ lên giáp phép', 4); }
    }
    if (ctx.allies.length >= 1 && prof.front < 1 && (hero.isTank || (hero.cls === 'Đấu sĩ' && ['top', 'sp'].includes(lane)))) {
      r.comp += 6; add('comp', 'Đội chưa có tuyến đầu — bổ sung khả năng chống chịu, mở giao tranh', 7);
    }
    if (ctx.allies.length >= 1 && prof.cc < 2 && hero.hardCC) {
      r.comp += 4; add('comp', 'Thêm khống chế cứng cho giao tranh tổng', 6);
    }
    const enemyProf = profile(ctx.enemies);
    if (enemyProf.assassins.length && (lane === 'sp' || hero.isTank) && hero.hardCC) {
      r.comp += 3; add('comp', `Bảo kê hàng sau trước sát thủ ${enemyProf.assassins.join(', ')}`, 6);
    }

    // Độ an toàn khi pick sớm (còn bao nhiêu tướng khắc chế trong pool)
    const factor = ctx.enemyPicksLeft / 5;
    if (factor > 0 && hero.noMatchup) {
      r.safety = -Math.min(MEDIAN_THREATS, 6) * 1.6 * factor;
    } else if (factor > 0) {
      const all = THREATS[hero.id];
      const left = all.filter((id) => !ctx.unavailable.has(id));
      r.safety = -Math.min(left.length, 6) * 1.6 * factor;
      const names = left.slice(0, 3).map((id) => HEROES[id].name).join(', ');
      if (all.length && !left.length) {
        r.safety += 4 * factor;
        add('safe', 'Mọi tướng khắc chế đã bị cấm/chọn — pick rất an toàn', 7);
      } else if (left.length <= 2 && all.length) {
        add('safe', `Ít tướng khắc chế còn trong pool (${names}) — an toàn để pick sớm`, 3);
      } else if (left.length >= 5 && factor > 0.5) {
        add('warn', `Còn nhiều tướng khắc chế (${names}…) — dễ bị counter-pick`, 2);
      }
    }

    // Pick linh hoạt (giấu bài) ở giai đoạn đầu
    const strongLanes = openLanes(ctx.allies).filter((l) => hero.lanes[l] && ['S', 'A'].includes(hero.lanes[l].tier));
    if (strongLanes.length >= 2 && ctx.allies.length <= 2) {
      r.bonus += 3;
      add('flex', `Pick linh hoạt: mạnh ở ${strongLanes.map(laneName).join(' / ')} — khó đoán đội hình`, 4);
    }

    // Cướp tướng: hợp cặp với tướng đối thủ đã chọn
    for (const e of ctx.enemies) {
      const eh = HEROES[e.id];
      if (eh && synRel(hero, eh) && ctx.enemyPicksLeft > 0) {
        r.bonus += 3;
        add('deny', `Cướp tướng: ${hero.name} là cặp bài trùng của ${eh.name} bên địch`, 3);
      }
    }

    r.total = r.meta * 0.55 + r.counter + r.synergy + r.comp + r.safety + r.bonus;
    r.reasons.sort((a, b) => b.w - a.w);
    return r;
  }

  // ---------- Đánh giá BAN ----------
  function evaluateBan(hero, ctx) {
    // ctx ở góc nhìn đội đang cấm: allies = đội mình, enemies = đối thủ
    const lane = bestLane(hero, ctx.enemies);
    if (!lane) return null;
    const li = hero.lanes[lane];
    const r = { hero, lane, meta: li.meta, threat: 0, total: 0, reasons: [] };
    const add = (t, s, w = 0) => r.reasons.push({ t, s, w });
    add('meta', `Tier ${li.tier} (${TIER_LABEL[li.tier]}) ở ${laneName(lane)}, hạng ${li.rank}/${li.total} — đối thủ còn trống đường này`, 1);

    for (const a of ctx.allies) {
      const ah = HEROES[a.id];
      if (!ah) continue;
      const c = counterRel(hero, ah);
      if (c) {
        const v = c === 2 ? 16 : 11;
        r.threat += v;
        add('counter', `Khắc chế ${ah.name} của bạn: ${whyCounter(hero, ah)}`, 10 + v);
      }
      if (counterRel(ah, hero)) { r.threat -= 6; add('safe', `Đã bị ${ah.name} của bạn khắc chế — ít nguy hiểm hơn`, 2); }
    }
    for (const e of ctx.enemies) {
      const eh = HEROES[e.id];
      if (eh && synRel(hero, eh)) { r.threat += 8; add('syn', `Hợp cặp với ${eh.name} bên đối thủ`, 12); }
    }
    const sCount = Object.values(hero.lanes).filter((l) => ['S', 'A'].includes(l.tier)).length;
    if (sCount >= 2) { r.threat += 3; add('flex', 'Mạnh ở nhiều đường — đối thủ dễ giấu bài', 4); }
    if (ctx.myPicksLeft > 0 && ctx.allies.some((a) => HEROES[a.id] && synRel(hero, HEROES[a.id]))) {
      r.threat -= 5; add('warn', 'Hợp với đội bạn — cân nhắc giữ lại để tự pick', 3);
    }
    r.total = r.meta * 0.6 + r.threat;
    r.reasons.sort((a, b) => b.w - a.w);
    return r;
  }

  const available = (ctx) => HERO_LIST.filter((h) => !ctx.unavailable.has(h.id));
  const byTotal = (a, b) => b.total - a.total;

  function suggestPicks(ctx, n = 5) {
    const evals = available(ctx).map((h) => evaluatePick(h, ctx)).filter(Boolean);
    const all = [...evals].sort(byTotal);
    const syn = evals.filter((e) => e.synergy + e.comp > 0)
      .map((e) => ({ e, k: e.synergy * 1.3 + e.comp + e.meta * 0.35 + e.counter * 0.3 }))
      .sort((a, b) => b.k - a.k).map((x) => x.e);
    const ctr = evals.filter((e) => e.counterPos > 0)
      .map((e) => ({ e, k: e.counterLatest * 1.5 + e.counterPos + (e.counter - e.counterPos) + e.meta * 0.35 }))
      .sort((a, b) => b.k - a.k).map((x) => x.e);
    return { all: all.slice(0, n), syn: syn.slice(0, n), ctr: ctr.slice(0, n), map: new Map(evals.map((e) => [e.hero.id, e])) };
  }

  function suggestBans(ctx, n = 5) {
    const evals = available(ctx).map((h) => evaluateBan(h, ctx)).filter(Boolean);
    const all = [...evals].sort(byTotal);
    const threat = evals.filter((e) => e.threat > 0).sort((a, b) => b.threat + b.meta * 0.2 - (a.threat + a.meta * 0.2));
    return { all: all.slice(0, n), threat: threat.slice(0, n), map: new Map(evals.map((e) => [e.hero.id, e])) };
  }

  // ---------- Phân tích đội hình cuối ----------
  function analyzeTeam(team, other) {
    const res = { metaAvg: 0, pairs: [], countersFor: [], countersAgainst: [], good: [], bad: [], score: 0 };
    let sum = 0;
    for (const m of team) {
      const h = HEROES[m.id];
      const li = h && h.lanes[m.lane];
      sum += li ? li.meta : 30;
      if (h && !li) res.bad.push(`${h.name} đi trái đường (${laneName(m.lane)})`);
    }
    res.metaAvg = team.length ? sum / team.length : 0;
    for (let i = 0; i < team.length; i++)
      for (let j = i + 1; j < team.length; j++) {
        const a = HEROES[team[i].id], b = HEROES[team[j].id];
        if (a && b && synRel(a, b)) res.pairs.push(`${a.name} + ${b.name}`);
      }
    for (const m of team) for (const o of other) {
      const a = HEROES[m.id], b = HEROES[o.id];
      if (!a || !b) continue;
      if (counterRel(a, b)) res.countersFor.push(`${a.name} → ${b.name}`);
      if (counterRel(b, a)) res.countersAgainst.push(`${b.name} → ${a.name}`);
    }
    const p = profile(team);
    if (p.ap >= 1 && p.ad >= 1) res.good.push('Sát thương cân bằng vật lý / phép');
    else res.bad.push(p.ap < 1 ? 'Thiếu sát thương phép — đối thủ dễ lên giáp vật lý' : 'Thiếu sát thương vật lý — đối thủ dễ lên giáp phép');
    if (p.front >= 1) res.good.push('Có tuyến đầu chống chịu');
    else res.bad.push('Thiếu tuyến đầu, dễ bị lao vào hàng sau');
    if (p.cc >= 3) res.good.push(`Nhiều khống chế cứng (${p.cc} tướng)`);
    else if (p.cc <= 1) res.bad.push('Ít khống chế cứng, khó bắt mục tiêu');
    const sTier = team.filter((m) => HEROES[m.id] && HEROES[m.id].lanes[m.lane] && HEROES[m.id].lanes[m.lane].tier === 'S').length;
    if (sTier >= 2) res.good.push(`${sTier} tướng tier S đúng đường`);
    res.score = res.metaAvg * 0.6 + res.pairs.length * 4 + res.countersFor.length * 3 - res.countersAgainst.length * 3
      + (p.ap >= 1 && p.ad >= 1 ? 4 : -4) + (p.front >= 1 ? 3 : -3) + (p.cc >= 2 ? 3 : 0);
    return res;
  }

  function analyzeMatch(blue, red) {
    const b = analyzeTeam(blue, red);
    const r = analyzeTeam(red, blue);
    // Giới hạn 15%–85%: ban/pick chỉ là một phần của trận đấu
    const pBlue = 0.5 + 0.35 * Math.tanh((b.score - r.score) / 25);
    return { blue: b, red: r, pBlue };
  }

  return {
    HEROES, HERO_LIST, TIER_LABEL, THREATS, laneName, slug,
    bestLane, openLanes, evaluatePick, evaluateBan, suggestPicks, suggestBans, analyzeMatch,
  };
})();
