/* 설비시스템 DB판 — 유입경로·수수료 화면 (2026-10-22, 구글판에는 없음)
 *  - 예약 등록 창: [유입경로] 고르기 (고객 입력 링크도 같이)
 *  - 예약 상세 창: 유입경로·수수료 표시 + [변경]
 *  - 메뉴 '유입경로' (최고관리자): 수수료 내역(지급 관리, 견적비 기록) / 경로별 통계 / 경로 설정 */
(function () {
  const C = { tab: "fees", month: "", channels: null, f: { channel_id: "", status: "" } };
  const sget = (action, payload) => callServer(action, payload || {}, App.token).then(r => {
    if (!r || !r.ok) { const e = new Error((r && r.error) || "서버 오류"); e.code = r && r.code; throw e; }
    return r.data;
  });
  const tryRun = (fn, msg) => run(fn, msg).catch(() => null);
  async function channels(force) { if (!C.channels || force) C.channels = await sget("channel_list"); return C.channels; }
  const feeText = c => c && c.fee_type === "소개비" ? "업체 협력 소개비 · 작업완료 때 (요청마다 금액 다름)" : !c || c.fee_type === "없음" ? "수수료 없음" : (c.fee_type === "정률" ? `수수료 ${c.fee_value}%` : `수수료 ${money(c.fee_value)}`) + (c.fee_when === "완료" ? " · 작업완료 때" : " · 예약 때");
  const stPill = s => `<span class="pill ${s === "지급완료" ? "ok" : "warn"}">${esc(s || "미지급")}</span>`;
  const monthLabel = m => `${m.slice(0, 4)}년 ${Number(m.slice(5, 7))}월`;
  const shiftMonth = (m, d) => { const x = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + d, 1); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0"); };
  const lastDay = m => { const x = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0); return m + "-" + String(x.getDate()).padStart(2, "0"); };
  // manual=true: 직접 고르는 곳(예약 등록·변경)에서는 제휴_ 경로(업체 협력 자동)를 빼고 보여줌
  const chOptions = (sel, withEmpty, emptyText, manual) => (withEmpty ? `<option value="">${emptyText || "선택 안 함"}</option>` : "") +
    (C.channels || []).filter(c => (c.active || c.channel_id === sel) && (!manual || c.fee_type !== "소개비" || c.channel_id === sel)).map(c => `<option value="${esc(c.channel_id)}" ${c.channel_id === sel ? "selected" : ""}>${esc(c.name)}</option>`).join("");

  /* ---------- 서버 요청에 유입경로 붙이기 ---------- */
  const origApi = window.api;
  window.api = function (action, payload, opts) {
    if ((action === "reservation_create" || action === "intake_create") && payload && payload.channel_id === undefined) {
      const el = document.getElementById("fChannel");
      if (el) payload = Object.assign({}, payload, { channel_id: el.value });
    }
    return origApi.call(this, action, payload, opts);
  };

  /* ---------- 예약 등록 창 ---------- */
  const origForm = window.openReservationForm;
  if (typeof origForm === "function") {
    window.openReservationForm = function (opts) {
      const ret = origForm.apply(this, arguments);
      try {
        if (opts && opts.edit) return ret;
        const ms = document.querySelectorAll(".modal-back"), m = ms[ms.length - 1];
        const lines = m && m.querySelector("#fLines");
        if (!lines || m.querySelector("#fChannel")) return ret;
        const box = document.createElement("div");
        box.innerHTML = `<div class="section-title">유입경로</div>
          <div class="row"><select id="fChannel" class="grow"><option value="">불러오는 중...</option></select><span id="fChFee" class="small muted"></span></div>`;
        const title = lines.previousElementSibling;
        while (box.firstChild) lines.parentNode.insertBefore(box.firstChild, title);
        const sel = m.querySelector("#fChannel"), info = m.querySelector("#fChFee");
        const show = () => { const c = (C.channels || []).find(x => x.channel_id === sel.value); info.textContent = c ? feeText(c) : ""; };
        sel.onchange = show;
        channels().then(list => {
          sel.innerHTML = chOptions("", true, "", true);
          if (!list.length) sel.innerHTML = `<option value="">(등록된 경로 없음${isSuper() ? " — 메뉴 '유입경로'에서 추가" : ""})</option>`;
          show();
        }).catch(() => { sel.innerHTML = '<option value="">선택 안 함</option>'; });
      } catch (e) {}
      return ret;
    };
  }

  /* ---------- 예약 상세 창 ---------- */
  async function drawDetailRow(dd, id) {
    let r; try { r = await api("reservation_get", { reservation_id: id }, { silent: true }); } catch (e) { return; }
    if (!("channel" in r)) { dd.textContent = "-"; return; }
    const fees = (r.channel_fees || []).filter(f => f.kind === "예약수수료" || f.kind === "소개비");
    dd.innerHTML = `${r.channel ? `<b>${esc(r.channel.name)}</b>` : '<span class="muted">지정 안 함</span>'}
      ${fees.map(f => ` · ${money(f.amount)} ${stPill(f.status)}`).join("")}
      ${r.channel && !fees.length && r.channel.fee_type !== "없음" ? `<span class="xs muted"> · ${r.channel.fee_type === "소개비" ? "작업완료 때 소개비 생김" : r.channel.fee_when === "완료" ? "작업완료 때 수수료 생김" : ""}</span>` : ""}
      <button class="btn sm ghost" data-chset>${r.channel ? "변경" : "지정"}</button>`;
    dd.querySelector("[data-chset]").onclick = () => openChannelSet(id, r.channel ? r.channel.channel_id : "", fees, () => drawDetailRow(dd, id));
  }
  async function openChannelSet(id, cur, fees, after) {
    try { await channels(); } catch (e) { return toast(e.message, true); }
    const paid = fees.some(f => f.status === "지급완료");
    const m = openModal({
      title: "유입경로 변경",
      body: `<label>유입경로<select id="csSel">${chOptions(cur, true, "", true)}</select></label><div class="small muted" id="csInfo" style="margin-top:6px"></div>
        <div class="xs muted" style="margin-top:8px">지급하지 않은 수수료는 새 경로 기준으로 다시 계산됩니다.${paid ? "<br><b>이미 지급완료한 수수료는 그대로 남습니다.</b>" : ""}</div>`,
      foot: `<button class="btn" data-x>취소</button><button class="btn primary" data-ok>저장</button>`
    });
    const show = () => { const c = C.channels.find(x => x.channel_id === m.$("#csSel").value); m.$("#csInfo").textContent = c ? feeText(c) : ""; };
    m.$("#csSel").onchange = show; show();
    m.$("[data-x]").onclick = m.close;
    m.$("[data-ok]").onclick = async () => {
      const ok = await tryRun(() => api("reservation_channel_set", { reservation_id: id, channel_id: m.$("#csSel").value }), "유입경로를 저장했습니다.");
      if (ok) { m.close(); after && after(); }
    };
  }
  const origDetail = window.openReservationDetail;
  if (typeof origDetail === "function") {
    window.openReservationDetail = async function (id) {
      const ret = await origDetail.apply(this, arguments);
      try {
        if (String(id || "").startsWith("LK")) return ret;
        const ms = document.querySelectorAll(".modal-back"), m = ms[ms.length - 1];
        const dl = m && m.querySelector("dl.kv");
        if (!dl || dl.querySelector("[data-chrow]")) return ret;
        const dt = document.createElement("dt"); dt.textContent = "유입경로"; dt.dataset.chrow = "1";
        const dd = document.createElement("dd"); dd.innerHTML = '<span class="muted small">...</span>';
        dl.appendChild(dt); dl.appendChild(dd);
        drawDetailRow(dd, id);
      } catch (e) {}
      return ret;
    };
  }

  /* ---------- 메뉴 '유입경로' (최고관리자) ---------- */
  if (typeof NAV !== "undefined" && !NAV.some(n => n.v === "channels")) {
    const i = NAV.findIndex(n => n.v === "stats");
    NAV.splice(i < 0 ? NAV.length : i + 1, 0, { v: "channels", t: "유입경로", i: "🧲", superOnly: true });
  }
  const main = document.getElementById("main");
  if (main && !document.querySelector('.view[data-view="channels"]')) {
    const sec = document.createElement("section"); sec.className = "view"; sec.dataset.view = "channels"; main.appendChild(sec);
  }
  const rerender = () => { if (App.view === "channels") Views.channels.render(document.querySelector('.view[data-view="channels"]'), {}); };

  Views.channels = {
    async render(el) {
      if (!C.month) C.month = todayStr().slice(0, 7);
      const tabs = [["fees", "수수료 내역"], ["stats", "경로별 통계"], ["setup", "경로 설정"]];
      el.innerHTML = `<div class="page-head"><h2>유입경로</h2>${C.tab !== "setup" ? `<div class="row"><button class="btn sm" id="chPrev">◀</button><b>${monthLabel(C.month)}</b><button class="btn sm" id="chNext">▶</button></div>` : ""}</div>
        <div class="tabs" id="chTabs">${tabs.map(t => `<button data-t="${t[0]}" class="${C.tab === t[0] ? "active" : ""}">${t[1]}</button>`).join("")}</div>
        <div id="chBody"><div class="empty">불러오는 중...</div></div>`;
      el.querySelectorAll("#chTabs button").forEach(b => b.onclick = () => { C.tab = b.dataset.t; Views.channels.render(el); });
      if (el.querySelector("#chPrev")) {
        el.querySelector("#chPrev").onclick = () => { C.month = shiftMonth(C.month, -1); Views.channels.render(el); };
        el.querySelector("#chNext").onclick = () => { C.month = shiftMonth(C.month, 1); Views.channels.render(el); };
      }
      const body = el.querySelector("#chBody");
      try {
        await channels(true);
        if (C.tab === "fees") await drawFees(body);
        else if (C.tab === "stats") await drawStats(body);
        else drawSetup(body);
      } catch (e) { body.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    }
  };

  async function drawFees(body) {
    const d = await sget("fee_list", { from: C.month + "-01", to: lastDay(C.month), channel_id: C.f.channel_id, status: C.f.status });
    body.innerHTML = `
      <div class="cards"><div class="card"><div class="label">수수료·비용 합계</div><div class="value">${money(d.total)}</div></div>
        <div class="card"><div class="label">미지급</div><div class="value red">${money(d.unpaid)}</div></div>
        <div class="card"><div class="label">지급완료</div><div class="value green">${money(d.paid)}</div></div></div>
      <div class="panel">
        <div class="filters">
          <select id="ffCh">${chOptions(C.f.channel_id, true, "전체 경로")}</select>
          <select id="ffSt"><option value="">전체 상태</option><option ${C.f.status === "미지급" ? "selected" : ""}>미지급</option><option ${C.f.status === "지급완료" ? "selected" : ""}>지급완료</option></select>
          <span class="grow"></span>
          <button class="btn sm primary" id="ffAdd">+ 견적비·비용 기록</button>
        </div>
        <div class="row" id="ffBulk" hidden style="margin-bottom:8px"><span class="small"><b id="ffN">0</b>건 선택</span>
          <button class="btn sm accent" id="ffPaid">지급완료로</button><button class="btn sm" id="ffUnpaid">미지급으로 되돌리기</button></div>
        <div class="table-wrap"><table class="tbl cards-sm"><thead><tr><th><input type="checkbox" id="ffAll" style="width:auto"></th><th>날짜</th><th>경로</th><th>내용</th><th>고객·예약</th><th class="num">금액</th><th>상태</th><th></th></tr></thead>
        <tbody>${d.rows.map(r => `<tr class="${r.reservation_exists ? "click" : ""}" data-id="${esc(r.fee_id)}" data-res="${r.reservation_exists ? esc(r.reservation_id) : ""}">
          <td>${r.kind === "소개비" ? "" : `<input type="checkbox" class="ffChk" value="${esc(r.fee_id)}" style="width:auto">`}</td>
          <td data-l="날짜" class="nowrap">${esc(r.fee_date)}</td><td data-l="경로"><b>${esc(r.channel_name)}</b></td>
          <td data-l="내용">${esc(r.kind)}${r.quantity > 1 ? ` ×${r.quantity}` : ""}${r.memo ? `<div class="xs muted">${esc(r.memo)}</div>` : ""}</td>
          <td data-l="고객·예약">${r.reservation_id ? `${esc(r.customer_name)} <span class="xs muted">${r.reservation_date ? dayLabel(r.reservation_date) : ""} ${esc(r.service_text)}</span>${r.reservation_status ? " " + statusPill(r.reservation_status) : ""}${r.reservation_exists ? "" : ' <span class="pill">예약 삭제됨</span>'}` : '<span class="muted">-</span>'}</td>
          <td data-l="금액" class="num b">${money(r.amount)}</td>
          <td data-l="상태">${stPill(r.status)}${r.kind === "소개비" && r.status !== "지급완료" ? '<div class="xs muted">업체 협력 → 소개비 정산에서 정산</div>' : ""}${r.paid_at ? `<div class="xs muted">${esc(r.paid_at)}${r.paid_method ? " · " + esc(r.paid_method) : ""}</div>` : ""}</td>
          <td>${r.kind !== "예약수수료" && r.kind !== "소개비" ? `<button class="btn sm ghost" data-del="${esc(r.fee_id)}" title="삭제">✕</button>` : ""}</td></tr>`).join("") || '<tr><td colspan="8" class="empty">이 달의 수수료·비용 기록이 없습니다.</td></tr>'}</tbody></table></div>
        <div class="xs muted" style="margin-top:8px">· 예약수수료: 예약에 유입경로를 지정하면 자동으로 생깁니다 (경로를 바꾸면 미지급분은 다시 계산). · 견적비·비용: 예약이 안 된 견적 비용 등을 직접 기록합니다. · 소개비: 업체 협력(제휴)으로 받은 예약을 작업완료하면 생기고, '업체 협력 → 소개비 정산'에서 정산 완료하면 지급완료가 됩니다.</div>
      </div>`;
    body.querySelector("#ffCh").onchange = e => { C.f.channel_id = e.target.value; rerender(); };
    body.querySelector("#ffSt").onchange = e => { C.f.status = e.target.value; rerender(); };
    body.querySelector("#ffAdd").onclick = () => openFeeAdd();
    const chks = [...body.querySelectorAll(".ffChk")];
    const upd = () => { const n = chks.filter(c => c.checked).length; body.querySelector("#ffBulk").hidden = !n; body.querySelector("#ffN").textContent = n; };
    chks.forEach(c => c.onclick = e => { e.stopPropagation(); upd(); });
    body.querySelector("#ffAll").onclick = e => { chks.forEach(c => c.checked = e.target.checked); upd(); };
    const sel = () => chks.filter(c => c.checked).map(c => c.value);
    body.querySelector("#ffPaid").onclick = () => openPay(sel());
    body.querySelector("#ffUnpaid").onclick = async () => { if (await tryRun(() => api("fee_pay", { fee_ids: sel(), paid: false }), "미지급으로 되돌렸습니다.")) rerender(); };
    body.querySelectorAll("tbody tr[data-id]").forEach(tr => tr.onclick = async e => {
      if (e.target.closest("input")) return;
      const del = e.target.closest("[data-del]");
      if (del) {
        e.stopPropagation();
        if (!(await confirmBox("이 기록을 삭제할까요?", "삭제"))) return;
        if (await tryRun(() => api("fee_delete", { fee_id: del.dataset.del }), "삭제했습니다.")) rerender();
        return;
      }
      if (tr.dataset.res) openReservationDetail(tr.dataset.res);
    });
  }

  function openPay(ids) {
    if (!ids.length) return;
    const m = openModal({
      title: `지급완료 처리 (${ids.length}건)`,
      body: `<div class="grid2"><label>지급일<input type="date" id="pyDate" value="${todayStr()}"></label>
        <label>지급 방법<select id="pyM"><option>충전금</option><option>카드</option><option>계좌이체</option><option>현금</option><option>정산 차감</option><option>기타</option></select></label></div>`,
      foot: `<button class="btn" data-x>취소</button><button class="btn primary" data-ok>지급완료</button>`
    });
    m.$("[data-x]").onclick = m.close;
    m.$("[data-ok]").onclick = async () => {
      if (await tryRun(() => api("fee_pay", { fee_ids: ids, paid: true, paid_at: m.$("#pyDate").value, paid_method: m.$("#pyM").value }), "지급완료로 바꿨습니다.")) { m.close(); rerender(); }
    };
  }

  function openFeeAdd() {
    const list = (C.channels || []).filter(c => c.active);
    if (!list.length) return toast("먼저 [경로 설정]에서 유입경로를 추가해주세요.", true);
    const first = list.find(c => c.fee_type === "정액") || list[0];
    const m = openModal({
      title: "견적비·비용 기록",
      body: `<div class="small muted" style="margin-bottom:8px">예: 숨고에서 견적을 보냈는데 예약이 안 된 건의 견적비 (예약이 된 건은 예약에 경로를 지정하면 자동으로 기록됩니다)</div>
        <div class="grid2">
          <label>유입경로<select id="faCh">${chOptions(first.channel_id, false)}</select></label>
          <label>날짜<input type="date" id="faDate" value="${todayStr()}"></label>
          <label>건수<input type="number" id="faQty" min="1" value="1"></label>
          <label>1건 금액<input type="number" id="faUnit" min="0" step="10"></label>
          <label>종류<select id="faKind"><option>견적비</option><option>광고비</option><option>기타</option></select></label>
          <label>메모<input id="faMemo" placeholder="예: 예약 안 된 견적"></label>
        </div>
        <label class="check"><input type="checkbox" id="faPaid" checked> 이미 지급함 (충전금 등에서 바로 빠짐)</label>
        <div class="box" style="margin-top:8px"><div class="sum-row total"><span>합계</span><span id="faSum">0원</span></div></div>`,
      foot: `<button class="btn" data-x>취소</button><button class="btn primary" data-ok>기록</button>`
    });
    const setUnit = () => { const c = C.channels.find(x => x.channel_id === m.$("#faCh").value); m.$("#faUnit").value = c && c.fee_type === "정액" ? c.fee_value : ""; sum(); };
    const sum = () => { m.$("#faSum").textContent = money((Number(m.$("#faQty").value) || 0) * (Number(m.$("#faUnit").value) || 0)); };
    m.$("#faCh").onchange = setUnit; m.$("#faQty").oninput = sum; m.$("#faUnit").oninput = sum; setUnit();
    m.$("[data-x]").onclick = m.close;
    m.$("[data-ok]").onclick = async () => {
      const ok = await tryRun(() => api("fee_add", { channel_id: m.$("#faCh").value, fee_date: m.$("#faDate").value, quantity: m.$("#faQty").value, unit_amount: m.$("#faUnit").value, kind: m.$("#faKind").value, memo: m.$("#faMemo").value, paid: m.$("#faPaid").checked, paid_method: m.$("#faPaid").checked ? "충전금" : "" }), "기록했습니다.");
      if (ok) { m.close(); rerender(); }
    };
  }

  async function drawStats(body) {
    const d = await sget("channel_stats", { month: C.month, from: C.month + "-01", to: lastDay(C.month) });
    const t = d.total;
    body.innerHTML = `
      <div class="cards"><div class="card"><div class="label">매출</div><div class="value">${money(t.revenue)}</div></div>
        <div class="card"><div class="label">유입 수수료·비용</div><div class="value red">${money(t.fees)}</div></div>
        <div class="card"><div class="label">수수료 뺀 매출</div><div class="value green">${money(t.net)}</div></div>
        <div class="card"><div class="label">미지급</div><div class="value">${money(t.unpaid)}</div></div></div>
      <div class="panel"><div class="panel-head"><h3>경로별</h3><span class="xs muted">예약 = 예약일 기준 · 매출 = 매출일 기준 · 수수료 = 기록일 기준</span></div>
        <div class="table-wrap"><table class="tbl cards-sm"><thead><tr><th>경로</th><th class="num">예약</th><th class="num">완료</th><th class="num">취소</th><th class="num">매출</th><th class="num">수수료·비용</th><th class="num">미지급</th><th class="num">수수료 뺀 매출</th><th class="num">예약 1건당 비용</th></tr></thead>
        <tbody>${d.rows.map(s => `<tr><td data-l="경로" class="b">${esc(s.name)}${s.quote_fees ? `<div class="xs muted">견적비 ${money(s.quote_fees)} · 견적 ${s.quotes}건</div>` : ""}</td>
          <td data-l="예약" class="num">${s.reservations}</td><td data-l="완료" class="num">${s.done}</td><td data-l="취소" class="num">${s.canceled}</td>
          <td data-l="매출" class="num">${money(s.revenue)}</td><td data-l="수수료·비용" class="num red">${money(s.fees)}</td><td data-l="미지급" class="num">${money(s.unpaid)}</td>
          <td data-l="수수료 뺀 매출" class="num b green">${money(s.net)}</td><td data-l="예약 1건당 비용" class="num">${s.reservations ? money(s.cost_per_booking) : "-"}</td></tr>`).join("") || '<tr><td colspan="9" class="empty">데이터가 없습니다.</td></tr>'}</tbody></table></div>
      </div>`;
  }

  function drawSetup(body) {
    const list = C.channels || [];
    body.innerHTML = `<div class="panel"><div class="panel-head"><h3>유입경로 ${list.length}개</h3><button class="btn sm primary" id="csAdd">+ 경로 추가</button></div>
      ${list.map(c => `<div class="item" data-id="${esc(c.channel_id)}" style="${c.active ? "" : "opacity:.55"}"><div class="main-col"><div class="title">${esc(c.name)} ${c.active ? "" : '<span class="pill">사용 안 함</span>'}</div>
        <div class="sub">${esc(feeText(c))}${c.memo ? " · " + esc(c.memo) : ""}</div></div><div class="side-col xs faint">순서 ${c.sort}</div></div>`).join("") || '<div class="empty">아직 등록된 경로가 없습니다. 숨고, 오늘의집, 지인소개, 전화 문의처럼 손님이 들어오는 곳을 추가하세요.</div>'}
      <div class="xs muted" style="margin-top:8px">· 정액: 건당 정해진 금액 (예: 숨고 견적당 2,190원) · 정률: 예약 최종금액의 % · '예약 때'는 예약을 등록하면 바로 생기고 취소돼도 남습니다. '작업완료 때'는 작업완료할 때 생깁니다.</div></div>`;
    body.querySelector("#csAdd").onclick = () => openChannelForm({});
    body.querySelectorAll(".item[data-id]").forEach(x => x.onclick = () => openChannelForm(list.find(c => c.channel_id === x.dataset.id)));
  }

  function openChannelForm(c) {
    const isNew = !c.channel_id;
    const share = c.fee_type === "소개비";
    const m = openModal({
      title: isNew ? "유입경로 추가" : "유입경로 수정",
      body: `<div class="grid2">
          <label>이름<input id="cfName" value="${esc(c.name || "")}" placeholder="예: 숨고"></label>
          <label>표시 순서<input type="number" id="cfSort" value="${c.sort || ""}"></label>
          ${share ? `<div class="span2 box small">업체 협력(제휴)으로 받은 예약에 자동으로 붙는 경로입니다. 수수료는 요청마다 정해진 소개비로 작업완료 때 기록됩니다.</div><select id="cfType" hidden><option>없음</option></select>` : `<label>수수료 방식<select id="cfType">${["없음", "정액", "정률"].map(t => `<option ${(c.fee_type || "없음") === t ? "selected" : ""}>${t}</option>`).join("")}</select></label>`}
          <label id="cfValWrap">금액<input type="number" id="cfVal" min="0" value="${c.fee_value || ""}"></label>
          <label id="cfWhenWrap">수수료 생기는 때<select id="cfWhen"><option value="예약" ${c.fee_when !== "완료" ? "selected" : ""}>예약 등록할 때 (취소돼도 남음)</option><option value="완료" ${c.fee_when === "완료" ? "selected" : ""}>작업완료할 때</option></select></label>
          <label>메모<input id="cfMemo" value="${esc(c.memo || "")}"></label>
        </div>
        ${isNew ? "" : `<label class="check"><input type="checkbox" id="cfActive" ${c.active ? "checked" : ""}> 사용 (끄면 예약 등록 창에 안 보임, 지난 기록은 남음)</label>`}
        <div class="xs muted" style="margin-top:6px">수수료를 바꿔도 이미 생긴 수수료 기록은 그대로입니다.</div>`,
      foot: `<button class="btn" data-x>취소</button><button class="btn primary" data-ok>저장</button>`
    });
    const sync = () => { const t = share ? "없음" : m.$("#cfType").value; m.$("#cfValWrap").hidden = t === "없음"; m.$("#cfWhenWrap").hidden = t === "없음"; m.$("#cfValWrap").firstChild.textContent = t === "정률" ? "비율 (%)" : "건당 금액 (원)"; };
    m.$("#cfType").onchange = sync; sync();
    m.$("[data-x]").onclick = m.close;
    m.$("[data-ok]").onclick = async () => {
      const ok = await tryRun(() => api("channel_save", { channel_id: c.channel_id || "", name: m.$("#cfName").value, sort: m.$("#cfSort").value, fee_type: m.$("#cfType").value, fee_value: m.$("#cfVal").value, fee_when: m.$("#cfWhen").value, memo: m.$("#cfMemo").value, active: isNew ? true : m.$("#cfActive").checked }), "저장했습니다.");
      if (ok) { m.close(); C.channels = null; rerender(); }
    };
  }
})();
