/* 설비시스템 DB판 — 서비스 분류 (2026-10-22, 구글판에는 없음)
 *  분류 목록과 업체별 서비스 범위는 운영자 화면(operator.html)에서 정합니다.
 *  - 서비스 등록 창: 분류를 이 업체의 서비스 범위에서만 고름
 *  - 통계: 월별 매출을 분류 개수만큼 나눠 보여줌 (분류 색 사용) */
(function () {
  const origApi = window.api;
  window.api = function (action, payload, opts) {
    const p = origApi.call(this, action, payload, opts);
    if (action === "bootstrap") p.then(d => { if (d && Array.isArray(d.categories)) App.categories = d.categories; }, () => {});
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
})();
