/* 설비시스템 DB판 — 서비스 분류 (2026-10-22, 구글판에는 없음)
 *  분류 목록과 업체별 서비스 범위는 운영자 화면(operator.html)에서 정합니다.
 *  - 서비스 등록 창: 분류를 이 업체의 서비스 범위에서만 고름
 *  - 통계: 월별 매출을 분류 개수만큼 나눠 보여줌 (분류 색 사용)
 *  - 부품·지출 분류: 업체 최고관리자가 [분류 관리]에서 관리 (2026-10-22)
 *  - 블로그 글: 문구의 '홈케어/설비'를 실제 서비스 분류 이름으로 (2026-10-22) */
(function () {
  const origApi = window.api;
  window.api = function (action, payload, opts) {
    const p = origApi.call(this, action, payload, opts);
    if (action === "bootstrap") p.then(d => { if (d && Array.isArray(d.categories)) App.categories = d.categories; if (d && d.lists) App.lists = d.lists; }, () => {});
    return p;
  };

  /* ---------- 서비스 등록 창 ---------- */
  const origSvc = window.openServiceForm;
  if (typeof origSvc === "function") {
    window.openServiceForm = async function (s) {
      const ret = await origSvc.apply(this, arguments);
      try {
        const cats = App.categories || [];
        if (!cats.length) return ret;
        const ms = document.querySelectorAll(".modal-back"), m = ms[ms.length - 1];
        const sel = m && m.querySelector("#svCat");
        if (!sel) return ret;
        const cur = (s && s.category) || "";
        const names = cats.map(c => c.name);
        sel.innerHTML = names.map(n => `<option>${esc(n)}</option>`).join("") +
          (cur && !names.includes(cur) ? `<option value="${esc(cur)}">${esc(cur)} (서비스 범위 밖 — 예전 분류)</option>` : "");
        sel.value = cur && (names.includes(cur) || cur) ? cur : names[0];
        if (!sel.value) sel.value = names[0];
        const lab = sel.closest("label");
        if (lab && !lab.querySelector(".xs")) lab.insertAdjacentHTML("beforeend", '<span class="xs muted" style="font-weight:400">분류 추가·변경은 운영자에게 문의</span>');
      } catch (e) {}
      return ret;
    };
  }

  /* ---------- 통계 (분류별) ---------- */
  const origStats = Views.stats;
  Views.stats = {
    async render(el) {
      const year = (Views.stats.year = Views.stats.year || todayStr().slice(0, 4));
      el.innerHTML = `<div class="page-head"><h2>통계</h2><div class="row"><button class="btn sm" id="stPrev">◀</button><b id="stYear">${year}년</b><button class="btn sm" id="stNext">▶</button></div></div><div id="stBody"><div class="empty">불러오는 중...</div></div>`;
      el.querySelector("#stPrev").onclick = () => { Views.stats.year = String(Number(year) - 1); Views.stats.render(el); };
      el.querySelector("#stNext").onclick = () => { Views.stats.year = String(Number(year) + 1); Views.stats.render(el); };
      let d; try { d = await api("stats", { year }); } catch (e) { return toast(e.message, true); }
      if (!Array.isArray(d.categories)) { if (origStats) return origStats.render.call(this, el); return; }
      const cats = d.categories.filter(c => !c.outside || d.months.some(m => (m.by_cat || {})[c.name]));
      const PARTS = "#d97706";
      const t = d.total, maxM = Math.max(1, ...d.months.map(m => m.total));
      const legend = cats.map(c => `<span class="dot" style="background:${esc(c.color)}"></span>${esc(c.name)}`).join(" ") + ` <span class="dot" style="background:${PARTS}"></span>부품`;
      const v = (m, c) => (m.by_cat || {})[c.name] || 0;
      el.querySelector("#stBody").innerHTML = `
        <div class="cards"><div class="card"><div class="label">연 매출</div><div class="value">${money(t.total)}</div></div><div class="card"><div class="label">부품원가+지출</div><div class="value">${money(t.parts_cost + t.expenses)}</div></div><div class="card"><div class="label">관리이익</div><div class="value green">${money(t.profit)}</div></div><div class="card"><div class="label">남은 미수금</div><div class="value red">${money(t.receivable)}</div></div></div>
        <div class="panel"><div class="panel-head"><h3>분류별 연 매출</h3></div>
          ${cats.map(c => { const sum = d.months.reduce((a, m) => a + v(m, c), 0); return `<div class="item" style="cursor:default"><div class="main-col"><span class="dot" style="background:${esc(c.color)}"></span><b>${esc(c.name)}</b>${c.outside ? ' <span class="pill">범위 밖</span>' : ""}<div class="bar" style="background:#eef2f7;max-width:none"><div style="width:${(sum / Math.max(1, t.total) * 100).toFixed(1)}%;background:${esc(c.color)}"></div></div></div><div class="side-col b">${money(sum)}</div></div>`; }).join("")}
        </div>
        <div class="panel"><div class="panel-head"><h3>월별 매출</h3><span class="xs muted">${legend}</span></div>
          <div style="display:grid;grid-template-columns:repeat(12,1fr);gap:6px;align-items:end;height:180px;padding:0 4px">${d.months.map(m => {
            const h = x => (x / maxM * 150).toFixed(1) + "px";
            return `<div title="${m.month} ${money(m.total)}" style="display:flex;flex-direction:column;justify-content:flex-end;height:170px"><div style="height:${h(m.parts)};background:${PARTS};border-radius:3px 3px 0 0"></div>${cats.slice().reverse().map(c => `<div style="height:${h(v(m, c))};background:${esc(c.color)}"></div>`).join("")}</div>`;
          }).join("")}</div>
          <div style="display:grid;grid-template-columns:repeat(12,1fr);gap:6px;text-align:center" class="xs muted">${d.months.map(m => `<div>${Number(m.month.slice(5))}월</div>`).join("")}</div>
        </div>
        <div class="panel"><div class="panel-head"><h3>월별 상세</h3></div><div class="table-wrap"><table class="tbl cards-sm"><thead><tr><th>월</th>${cats.map(c => `<th class="num">${esc(c.name)}</th>`).join("")}<th class="num">부품</th><th class="num">총매출</th><th class="num">부품원가</th><th class="num">지출</th><th class="num">관리이익</th><th class="num">미수</th><th class="num">건수</th></tr></thead>
          <tbody>${d.months.filter(m => m.total || m.expenses).map(m => `<tr><td data-l="월" class="b">${m.month}</td>${cats.map(c => `<td data-l="${esc(c.name)}" class="num">${money(v(m, c))}</td>`).join("")}<td data-l="부품" class="num">${money(m.parts)}</td><td data-l="총매출" class="num b">${money(m.total)}</td><td data-l="부품원가" class="num">${money(m.parts_cost)}</td><td data-l="지출" class="num">${money(m.expenses)}</td><td data-l="관리이익" class="num green">${money(m.profit)}</td><td data-l="미수" class="num red">${money(m.receivable)}</td><td data-l="건수" class="num">${m.count}</td></tr>`).join("") || `<tr><td colspan="${cats.length + 8}" class="empty">매출이 없습니다.</td></tr>`}</tbody></table></div></div>
        <div class="panel"><div class="panel-head"><h3>담당자별 매출</h3></div>${d.by_assignee.map(a => `<div class="item" style="cursor:default"><div class="main-col"><span class="dot" style="background:${adminColor(a.assignee_id)}"></span><b>${esc(adminName(a.assignee_id))}</b> <span class="small muted">${a.count}건</span><div class="bar" style="background:#eef2f7;max-width:none"><div style="width:${(a.total / Math.max(1, t.total) * 100).toFixed(1)}%;background:${adminColor(a.assignee_id)}"></div></div></div><div class="side-col b">${money(a.total)}</div></div>`).join("") || '<div class="empty">데이터가 없습니다.</div>'}</div>`;
    }
  };

  /* ---------- 부품·지출 분류 (업체별, 최고관리자가 관리) ---------- */
  const LIST_LABEL = { part: "부품 분류", expense: "지출 분류" };
  const listNames = (type, cur) => {
    const l = ((App.lists || {})[type] || []).filter(x => x.active).map(x => x.name);
    if (cur && !l.includes(cur)) l.push(cur);
    return l;
  };
  function listOptions(type, cur, emptyText) {
    const names = listNames(type, cur), act = ((App.lists || {})[type] || []).filter(x => x.active).map(x => x.name);
    return (emptyText ? `<option value="">${emptyText}</option>` : "") + names.map(n => `<option value="${esc(n)}" ${n === cur ? "selected" : ""}>${esc(n)}${act.includes(n) ? "" : " (사용 안 함)"}</option>`).join("");
  }
  async function refreshLists() { try { const r = await callServer("list_get", {}, App.token); if (r && r.ok) App.lists = r.data; } catch (e) {} }
  function manageLink(type, sel) {
    if (!isSuper()) return null;
    const a = document.createElement("a"); a.href = "#"; a.className = "xs"; a.textContent = "분류 관리"; a.style.marginLeft = "6px";
    a.onclick = ev => { ev.preventDefault(); openListManager(type, () => { const v = sel.value; sel.innerHTML = listOptions(type, v, type === "part" ? "(분류 없음)" : ""); sel.value = v; }); };
    return a;
  }
  window.openListManager = async function (type, after) {
    await refreshLists();
    const items = ((App.lists || {})[type] || []).map(x => ({ name: x.name, old_name: x.name, active: x.active }));
    const m = openModal({
      title: LIST_LABEL[type] + " 관리",
      body: `<div class="small muted" style="margin-bottom:8px">이름을 바꾸면 이미 등록된 ${type === "part" ? "부품" : "지출"}의 분류도 같이 바뀝니다. 쓰지 않는 분류는 '사용'을 끄세요 (지난 기록은 그대로).</div>
        <div id="lmRows"></div><button class="btn sm" id="lmAdd" style="margin-top:6px">+ 분류 추가</button>`,
      foot: `<button class="btn" data-x>취소</button><button class="btn primary" data-ok>저장</button>`
    });
    const draw = () => {
      m.$("#lmRows").innerHTML = items.map((x, i) => `<div class="row" style="margin-bottom:6px"><input data-n="${i}" value="${esc(x.name)}" class="grow" placeholder="분류 이름"><label class="check" style="margin:0;white-space:nowrap"><input type="checkbox" data-a="${i}" ${x.active ? "checked" : ""}> 사용</label>${x.old_name ? "" : `<button class="btn sm ghost" data-d="${i}">✕</button>`}</div>`).join("") || '<div class="empty">분류가 없습니다.</div>';
      m.$$("[data-n]").forEach(e => e.oninput = () => items[e.dataset.n].name = e.value);
      m.$$("[data-a]").forEach(e => e.onchange = () => items[e.dataset.a].active = e.checked);
      m.$$("[data-d]").forEach(e => e.onclick = () => { items.splice(Number(e.dataset.d), 1); draw(); });
    };
    draw();
    m.$("#lmAdd").onclick = () => { items.push({ name: "", old_name: "", active: true }); draw(); m.$$("[data-n]").slice(-1)[0].focus(); };
    m.$("[data-x]").onclick = m.close;
    m.$("[data-ok]").onclick = async () => {
      const r = await run(() => api("list_save", { type, items: items.filter(x => String(x.name).trim()) })).catch(() => null);
      if (!r) return;
      App.lists = Object.assign({}, App.lists, { [type]: r.items });
      toast(r.renamed ? `저장했습니다. (기존 기록 ${r.renamed}건 분류 이름 변경)` : "저장했습니다.");
      m.close(); after && after();
      if (r.renamed) refreshView(true);
    };
  };
  const origPart = window.openPartForm;
  if (typeof origPart === "function") {
    window.openPartForm = function (p) {
      const ret = origPart.apply(this, arguments);
      try {
        if (!App.lists) return ret;
        const ms = document.querySelectorAll(".modal-back"), m = ms[ms.length - 1];
        const inp = m && m.querySelector("input#pfCat");
        if (!inp) return ret;
        const sel = document.createElement("select"); sel.id = "pfCat";
        sel.innerHTML = listOptions("part", (p && p.category) || "", "(분류 없음)");
        inp.replaceWith(sel);
        const lk = manageLink("part", sel); if (lk) sel.closest("label").firstChild.after(lk);
      } catch (e) {}
      return ret;
    };
  }
  const origExp = window.expenseForm;
  if (typeof origExp === "function") {
    window.expenseForm = function (e) {
      const ret = origExp.apply(this, arguments);
      try {
        if (!App.lists) return ret;
        const ms = document.querySelectorAll(".modal-back"), m = ms[ms.length - 1];
        const sel = m && m.querySelector("#efCat");
        if (!sel) return ret;
        const cur = (e && e.category) || "";
        sel.innerHTML = listOptions("expense", cur, "");
        if (cur) sel.value = cur;
        const lk = manageLink("expense", sel); if (lk) sel.closest("label").firstChild.after(lk);
      } catch (x) {}
      return ret;
    };
  }

  /* ---------- 블로그 글: '홈케어/설비' 대신 실제 서비스 분류 이름으로 ---------- */
  // 분류 이름에 청소·케어 같은 말이 있으면 청소형 문장, 아니면 시공·수리형 문장을 씁니다.
  window.blogKind = function (d) {
    const cats = (d && d.categories || []).filter(c => c && c !== "기타");
    const word = cats[0] || "설비";
    return { word, care: /케어|청소|클리닝|세척|세탁|소독|방역/.test(word) };
  };
  window.blogIsCare = function (d) { return blogKind(d).care; };
  window.buildBlog = function buildBlog(d, seed) {
  const co = d.company.name, area = d.area.text || "", gu = d.area.gu || "", dong = d.area.dong || "";
  const svcNames = d.services.map(s => s.name);
  const main = svcNames[0] || "작업";
  const svc = svcNames.length > 1 ? `${main} 외 ${svcNames.length - 1}건` : main;
  const K = blogKind(d), isCare = K.care;
  const before = d.photos.filter(p => p.photo_type === "작업전"), after = d.photos.filter(p => p.photo_type === "작업후"), etc = d.photos.filter(p => p.photo_type !== "작업전" && p.photo_type !== "작업후");
  const where = area ? area + " " : "";

  const title = blogPick([
    `${where}${svc} 후기 | ${co}`,
    `${where}${main} 작업, 전후 사진으로 보여드려요`,
    `[${gu || co}] ${svc} 깔끔하게 끝냈습니다`,
    `${where}${main} 시공 현장 이야기 – ${co}`
  ], seed, 1);

  const hello = blogPick([
    `안녕하세요, ${co}입니다 😊`,
    `안녕하세요! 꼼꼼한 ${K.word} 전문 ${co}입니다.`,
    `반갑습니다, ${co}입니다 🙂`
  ], seed, 2);
  const intro = blogPick([
    `오늘은 ${where}고객님 댁에서 진행한 ${svc} 작업을 소개해 드릴게요.`,
    `${area ? area + "에서" : "이번에"} 맡겨 주신 ${svc} 현장을 사진과 함께 정리해 봤습니다.`,
    `이번 글에서는 ${where}${main} 작업 과정을 전후 사진으로 보여드리려고 해요.`
  ], seed, 3);

  const lines = [];
  lines.push(hello, intro, "");
  lines.push("■ 작업 정보");
  if (area) lines.push(`· 지역: ${area}`);
  lines.push(`· 작업: ${svcNames.map((n, i) => n + (d.services[i].qty > 1 ? ` ×${d.services[i].qty}` : "")).join(", ") || "-"}`);
  if (d.parts.length) lines.push(`· 사용 부품: ${d.parts.join(", ")}`);
  lines.push(`· 작업일: ${blogDate(d.date)}`, "");

  let n = 0;
  const photoBlock = (list, label) => list.forEach(p => { n++; lines.push(`[사진 ${n} – ${label}]`); if (p.memo) lines.push(p.memo); });

  lines.push("■ 작업 전");
  photoBlock(before, "작업 전");
  lines.push(blogPick(isCare ? [
    "오래 사용하시면서 눈에 보이지 않는 곳까지 오염이 쌓인 상태였어요.",
    "겉으로는 괜찮아 보여도 가까이 보면 얼룩과 먼지가 꽤 많았습니다.",
    "생활하시면서 자연스럽게 쌓인 오염이 많이 보였어요."
  ] : [
    "사용하시면서 불편함이 있어 연락을 주셨어요.",
    "오래 사용해서 성능이 떨어지고 교체가 필요한 상태였습니다.",
    "현장을 확인해 보니 손을 봐야 할 부분이 분명히 보였어요."
  ], seed, 4), "");

  if (etc.length) { lines.push("■ 작업 과정"); photoBlock(etc, "작업 과정"); }
  else lines.push("■ 작업 과정");
  lines.push(blogPick(isCare ? [
    `전용 장비와 세제로 ${main} 작업을 꼼꼼하게 진행했습니다.`,
    `구석구석 놓치는 곳 없이 ${josa(main, "을", "를")} 진행했어요.`,
    `소재에 맞는 방법으로 ${main} 작업을 진행했습니다.`
  ] : [
    `기존 상태를 점검한 뒤 ${main} 작업을 진행했습니다.`,
    `현장에 맞게 꼼꼼하게 ${main} 작업을 진행했어요.`,
    `안전하게 물·전원을 차단하고 ${main} 작업을 진행했습니다.`
  ], seed, 5) + (d.parts.length ? ` 부품은 ${d.parts.length > 1 ? d.parts.join(", ") + " 등으로" : josa(d.parts[0], "으로", "로")} 교체했어요.` : ""), "");

  lines.push("■ 작업 후");
  photoBlock(after, "작업 후");
  lines.push(blogPick([
    "깔끔하게 마무리되었습니다 ✨ 고객님도 만족해 주셔서 뿌듯했어요.",
    "작업 전과 비교하면 확실히 달라진 모습이죠? 😊",
    "마무리 정리까지 깨끗하게 끝냈습니다. 감사합니다!"
  ], seed, 6), "");

  const outro = (d.company.blog_outro || "").trim();
  lines.push("────────────");
  lines.push(outro || blogPick([
    `${co}는 작은 작업도 내 집처럼 꼼꼼하게 진행합니다.`,
    `${gu ? gu + " 및 인근 지역 " : ""}${K.word}가 필요하시면 편하게 문의 주세요.`,
    `궁금한 점은 언제든 편하게 연락 주세요. 친절하게 상담해 드립니다.`
  ], seed, 7));
  if (!outro && d.company.phone) lines.push(`📞 문의: ${d.company.phone}`);
  if (!outro && gu) lines.push(`📍 서비스 지역: ${gu} 및 인근`);
  lines.push("");

  lines.push(blogHashtags(d));

  return { title, body: lines.join("\n"), photoCount: n, ordered: [...before, ...etc, ...after] };
};
  window.blogHashtags = function blogHashtags(d) {
  const gu = d.area.gu || "", dong = d.area.dong || "", K = blogKind(d), isCare = K.care, tags = [];
  const add = t => { const x = blogTag(t); if (x.length > 1 && !tags.includes(x)) tags.push(x); };
  d.services.map(s => s.name).forEach(s => { if (gu) add(gu.replace(/(구|군|시)$/, "") + s); if (dong) add(dong + s); add(s); });
  if (gu) add(gu + K.word);
  if (dong) add(dong + (isCare ? "청소" : K.word));
  d.parts.slice(0, 2).forEach(add);
  add(d.company.name);
  String(d.company.blog_tags || "").split(/[\s,#]+/).filter(Boolean).forEach(add);
  return tags.slice(0, 20).join(" ");
};
  window.blogVarsOf = function blogVarsOf(d, seed) {
  const svcNames = d.services.map(s => s.name), main = svcNames[0] || "작업";
  const co = d.company.name, gu = d.area.gu || "", K = blogKind(d), isCare = K.care;
  return {
    "업체명": co, "분류": K.word, "전화": d.company.phone || "", "지역": d.area.text || "", "구": gu, "동": d.area.dong || "",
    "대표서비스": main, "서비스": svcNames.length > 1 ? `${main} 외 ${svcNames.length - 1}건` : main,
    "작업목록": d.services.map(s => s.name + (s.qty > 1 ? ` ×${s.qty}` : "")).join(", "),
    "부품": d.parts.join(", "), "작업일": blogDate(d.date), "해시태그": blogHashtags(d),
    "인사": blogPick([`안녕하세요, ${co}입니다 😊`, `안녕하세요! 꼼꼼한 ${K.word} 전문 ${co}입니다.`, `반갑습니다, ${co}입니다 🙂`], seed, 2),
    "마무리": (d.company.blog_outro || "").trim() || blogPick([`${co}는 작은 작업도 내 집처럼 꼼꼼하게 진행합니다.`, `${gu ? gu + " 및 인근 지역 " : ""}${K.word}가 필요하시면 편하게 문의 주세요.`, "궁금한 점은 언제든 편하게 연락 주세요. 친절하게 상담해 드립니다."], seed, 7)
  };
};
  try { if (typeof BLOG_TOKENS !== "undefined" && !BLOG_TOKENS.some(t => t[0] === "분류")) BLOG_TOKENS.splice(5, 0, ["분류", "서비스 분류 (예: 에어컨청소)"]); } catch (e) {}
})();
