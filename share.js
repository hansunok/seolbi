/* 설비시스템 — 업체 협력 (타업체 서비스 배정) 화면
 *  메뉴 '업체 협력': 받은 요청 / 보낸 요청 / 제휴 업체 / 소개비 정산 / 제안받기 설정
 *  예약 상세 창에 [🤝 다른 업체에 배정] 버튼 추가
 *  기획: 업체간_서비스_배정_기획안.pdf */
(function () {
  const AREAS = {
    "서울": "강남구 강동구 강북구 강서구 관악구 광진구 구로구 금천구 노원구 도봉구 동대문구 동작구 마포구 서대문구 서초구 성동구 성북구 송파구 양천구 영등포구 용산구 은평구 종로구 중구 중랑구",
    "부산": "강서구 금정구 기장군 남구 동구 동래구 부산진구 북구 사상구 사하구 서구 수영구 연제구 영도구 중구 해운대구",
    "대구": "군위군 남구 달서구 달성군 동구 북구 서구 수성구 중구",
    "인천": "강화군 계양구 검단구 남동구 동구 미추홀구 부평구 서구 연수구 영종구 옹진군 제물포구 중구",
    "광주": "광산구 남구 동구 북구 서구",
    "대전": "대덕구 동구 서구 유성구 중구",
    "울산": "남구 동구 북구 울주군 중구",
    "세종": "세종시",
    "경기": "가평군 고양시 과천시 광명시 광주시 구리시 군포시 김포시 남양주시 동두천시 부천시 성남시 수원시 시흥시 안산시 안성시 안양시 양주시 양평군 여주시 연천군 오산시 용인시 의왕시 의정부시 이천시 파주시 평택시 포천시 하남시 화성시",
    "강원": "강릉시 고성군 동해시 삼척시 속초시 양구군 양양군 영월군 원주시 인제군 정선군 철원군 춘천시 태백시 평창군 홍천군 화천군 횡성군",
    "충북": "괴산군 단양군 보은군 영동군 옥천군 음성군 제천시 증평군 진천군 청주시 충주시",
    "충남": "계룡시 공주시 금산군 논산시 당진시 보령시 부여군 서산시 서천군 아산시 예산군 천안시 청양군 태안군 홍성군",
    "전북": "고창군 군산시 김제시 남원시 무주군 부안군 순창군 완주군 익산시 임실군 장수군 전주시 정읍시 진안군",
    "전남": "강진군 고흥군 곡성군 광양시 구례군 나주시 담양군 목포시 무안군 보성군 순천시 신안군 여수시 영광군 영암군 완도군 장성군 장흥군 진도군 함평군 해남군 화순군",
    "경북": "경산시 경주시 고령군 구미시 김천시 문경시 봉화군 상주시 성주군 안동시 영덕군 영양군 영주시 영천시 예천군 울릉군 울진군 의성군 청도군 청송군 칠곡군 포항시",
    "경남": "거제시 거창군 고성군 김해시 남해군 밀양시 사천시 산청군 양산시 의령군 진주시 창녕군 창원시 통영시 하동군 함안군 함양군 합천군",
    "제주": "서귀포시 제주시"
  };
  const SIDO_LIST = Object.keys(AREAS);
  const SIDO_ALIAS = { "서울특별시": "서울", "서울시": "서울", "부산광역시": "부산", "대구광역시": "대구", "인천광역시": "인천", "광주광역시": "광주", "대전광역시": "대전", "울산광역시": "울산", "세종특별자치시": "세종", "세종시": "세종", "경기도": "경기", "강원특별자치도": "강원", "강원도": "강원", "충청북도": "충북", "충청남도": "충남", "전북특별자치도": "전북", "전라북도": "전북", "전라남도": "전남", "경상북도": "경북", "경상남도": "경남", "제주특별자치도": "제주", "제주도": "제주" };
  function parseArea(addr) {
    const t = String(addr || "").trim().split(/\s+/);
    const sido = SIDO_ALIAS[t[0]] || (AREAS[t[0]] ? t[0] : "");
    if (!sido) return { sido: "", sigungu: "" };
    if (sido === "세종") return { sido, sigungu: "세종시" };
    const w = t.find((x, k) => k > 0 && /(시|군|구)$/.test(x));
    return { sido, sigungu: w || "" };
  }
  const sgList = s => (AREAS[s] || "").split(" ").filter(Boolean);
  const S = { tab: "inbox", state: null, month: "" };
  const tryRun = (fn, msg) => run(fn, msg).catch(() => null);

  // 조회는 화면 임시 보관(캐시)을 건드리지 않게 서버를 바로 부름, 저장은 api()로 (캐시 비움)
  function sget(action, payload) {
    return callServer(action, payload || {}, App.token).then(r => {
      if (!r || !r.ok) { const e = new Error((r && r.error) || "서버 오류"); e.code = r && r.code; throw e; }
      return r.data;
    });
  }
  async function loadState(force) {
    if (!S.state || force) S.state = await sget("share_state");
    const n = (S.state.inbox_count || 0) + (S.state.is_super ? S.state.partner_request_count || 0 : 0);
    try { setNavBadge("share", n); } catch (e) {}
    return S.state;
  }
  const approved = () => S.state && S.state.profile.enabled && S.state.profile.approved === "승인";
  const stars = v => v == null ? '<span class="pill">신규</span>' : `<span class="pill warn">★ ${Number(v).toFixed(1)}</span>`;
  const repLine = r => r ? `${stars(r.avg_stars)} <span class="small muted">완료 ${r.done_count || 0}건${r.cancel_count ? " · 수락 후 취소 " + r.cancel_count + "건" : ""}</span>` : stars(null);
  const feeText = r => `${money(r.fee_amount)}${r.fee_type === "정률" ? ` (${r.fee_value}%)` : ""}`;
  const whenText = r => `${fullDayLabel(r.reservation_date)} ${esc(r.start_time)}~${esc(r.end_time)}`;
  function leftText(ms) { const m = Math.max(0, Math.round((ms - Date.now()) / 60000)); return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분 남음` : `${m}분 남음`; }
  const ST_PILL = { "대기": "info", "배정": "ok", "완료": "ok", "만료": "", "취소": "danger", "작업취소": "danger" };
  const pill = s => `<span class="pill ${ST_PILL[s] || ""}">${esc(s === "배정" ? "배정됨" : s)}</span>`;

  /* ---------- 메뉴 ---------- */
  if (typeof NAV !== "undefined" && !NAV.some(n => n.v === "share")) {
    const i = NAV.findIndex(n => n.v === "settings");
    NAV.splice(i < 0 ? NAV.length : i, 0, { v: "share", t: "업체 협력", i: "🤝" });
  }
  const main = document.getElementById("main");
  if (main && !document.querySelector('.view[data-view="share"]')) {
    const sec = document.createElement("section"); sec.className = "view"; sec.dataset.view = "share"; main.appendChild(sec);
  }

  Views.share = {
    async render(el, params) {
      if (params && params.tab) S.tab = params.tab;
      el.innerHTML = `<div class="page-head"><h2>업체 협력</h2><button class="btn ghost sm" id="shRefresh">새로고침</button></div><div id="shBody"><div class="empty">불러오는 중...</div></div>`;
      el.querySelector("#shRefresh").onclick = () => Views.share.render(el, {});
      try { await loadState(true); } catch (e) { el.querySelector("#shBody").innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
      const st = S.state, sup = st.is_super;
      const tabs = [["inbox", `받은 요청${st.inbox_count ? ` <span class="badge">${st.inbox_count}</span>` : ""}`], ["sent", "보낸 요청"]];
      if (sup) tabs.push(["partners", `제휴 업체${st.partner_request_count ? ` <span class="badge">${st.partner_request_count}</span>` : ""}`], ["settle", "소개비 정산"], ["profile", "제안받기 설정"]);
      if (!tabs.some(t => t[0] === S.tab)) S.tab = "inbox";
      if (!approved() && sup && S.tab !== "profile" && st.profile.approved !== "승인") S.tab = st.profile.enabled ? S.tab : "profile";
      const banner = approved() ? "" : `<div class="box" style="margin-bottom:14px;background:var(--warn-soft);border-color:#fde68a">
        ${st.profile.approved === "대기" ? "⏳ 운영자 승인을 기다리는 중입니다. 승인되면 제휴와 배정 요청을 쓸 수 있습니다."
          : st.profile.approved === "보류" ? "⚠️ 운영자가 승인을 보류했습니다. 운영자에게 문의해 주세요."
          : st.profile.approved === "승인" && !st.profile.enabled ? "제안받기가 꺼져 있습니다. [제안받기 설정]에서 켜면 다시 쓸 수 있습니다."
          : sup ? "처음이신가요? [제안받기 설정]에서 서비스 지역을 고르고 저장하면 운영자 승인 요청이 갑니다." : "최고관리자가 [제안받기 설정]을 켜고 운영자 승인을 받으면 쓸 수 있습니다."}</div>`;
      const body = el.querySelector("#shBody");
      body.innerHTML = `${banner}<div class="tabs" id="shTabs">${tabs.map(([k, t]) => `<button data-t="${k}" class="${k === S.tab ? "active" : ""}">${t}</button>`).join("")}</div><div id="shTab"></div>`;
      body.querySelectorAll("#shTabs button").forEach(b => b.onclick = () => { S.tab = b.dataset.t; Views.share.render(el, {}); });
      const box = body.querySelector("#shTab");
      try { await TABS[S.tab](box); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    }
  };
  const rerender = () => { if (App.view === "share") Views.share.render(document.querySelector('.view[data-view="share"]'), {}); };

  const TABS = {
    /* ---------- 받은 요청 ---------- */
    async inbox(box) {
      const d = await sget("share_inbox");
      box.innerHTML = `
        <div class="panel"><div class="panel-head"><h3>수락 대기 중인 요청</h3><span class="small muted">먼저 수락한 한 곳에 배정됩니다</span></div>
          ${d.pending.length ? d.pending.map(r => `
            <div class="box" style="margin-bottom:10px">
              <div class="row" style="justify-content:space-between"><b>${whenText(r)}</b><span class="pill info">${leftText(r.expires_ms)}</span></div>
              <div style="margin-top:6px">📍 ${esc(r.area_hint)} · ${esc(r.category)} ${esc(r.service_text)}</div>
              <div class="row" style="margin-top:4px"><span>고객 금액 <b>${money(r.amount)}</b></span><span class="muted">·</span><span>소개비 <b>${feeText(r)}</b></span></div>
              <div class="small" style="margin-top:4px">요청 업체: <b>${esc(r.from_name)}</b> ${repLine(r.from_rep)}</div>
              ${r.memo ? `<div class="small muted" style="margin-top:4px;white-space:pre-line">메모: ${esc(r.memo)}</div>` : ""}
              <div class="row" style="margin-top:10px;justify-content:flex-end"><button class="btn sm" data-rej="${esc(r.id)}">거절</button><button class="btn ok sm" data-acc="${esc(r.id)}">수락</button></div>
            </div>`).join("") : `<div class="empty">지금 수락할 수 있는 요청이 없습니다.</div>`}
        </div>
        <div class="panel"><div class="panel-head"><h3>내가 받은 배정</h3></div>
          ${d.mine.length ? d.mine.map(r => `
            <div class="item" style="cursor:default"><div class="main-col">
              <div class="title">${whenText(r)} ${pill(r.status)}</div>
              <div class="sub">${esc(r.customer_name)} ${telLink(r.customer_phone)} · ${mapLink([r.address, r.detail_address].filter(Boolean).join(" "))}</div>
              <div class="sub">${esc(r.service_text)} ${money(r.amount)} · 소개비 ${feeText(r)} → ${esc(r.from_name)} ${telLink(r.from_phone)}${r.settled_at ? " · 정산 완료" : ""}</div>
              ${r.cancel_reason && r.status !== "배정" && r.status !== "완료" ? `<div class="sub red">${esc(r.cancel_reason)}</div>` : ""}
            </div><div class="side-col row">
              ${r.to_reservation_id ? `<button class="btn sm" data-res="${esc(r.to_reservation_id)}">예약 보기</button>` : ""}
              ${r.status === "완료" && !r.reviewed ? `<button class="btn sm" data-rev="${esc(r.id)}" data-side="B">평가하기</button>` : ""}
            </div></div>`).join("") : `<div class="empty">아직 받은 배정이 없습니다.</div>`}
        </div>`;
      box.querySelectorAll("[data-acc]").forEach(b => b.onclick = () => openAccept(d.pending.find(x => x.id === b.dataset.acc)));
      box.querySelectorAll("[data-rej]").forEach(b => b.onclick = async () => {
        if (!(await confirmBox("이 요청을 거절할까요? (우리 업체에서만 사라집니다)", "거절"))) return;
        await tryRun(() => api("share_reject", { request_id: b.dataset.rej }), "거절했습니다."); rerender();
      });
      box.querySelectorAll("[data-res]").forEach(b => b.onclick = () => openReservationDetail(b.dataset.res));
      box.querySelectorAll("[data-rev]").forEach(b => b.onclick = () => openReview(b.dataset.rev, b.dataset.side));
    },

    /* ---------- 보낸 요청 ---------- */
    async sent(box) {
      const rows = await sget("share_sent");
      box.innerHTML = `<div class="panel"><div class="panel-head"><h3>보낸 배정 요청</h3>${approved() ? `<button class="btn primary sm" id="shNew">+ 새 배정 요청</button>` : ""}</div>
        ${rows.length ? rows.map(r => `
          <div class="item" style="cursor:default"><div class="main-col">
            <div class="title">${whenText(r)} ${pill(r.status)} ${r.status === "대기" ? `<span class="small muted">${leftText(r.expires_ms)} · ${r.targets}곳 중 ${r.waiting}곳 대기${r.rejected ? `, ${r.rejected}곳 거절` : ""}</span>` : ""}</div>
            <div class="sub">${esc(r.customer_name)} ${telLink(r.customer_phone)} · ${esc(r.sido)} ${esc(r.sigungu)} · ${esc(r.service_text)} ${money(r.amount)} · 소개비 ${feeText(r)}</div>
            ${r.to_name ? `<div class="sub">배정: <b>${esc(r.to_name)}</b> ${telLink(r.to_phone)} · 담당 ${esc(r.to_admin_name)} ${telLink(r.to_admin_phone)}${r.settled_at ? " · 정산 완료" : r.status === "완료" ? " · 정산 대기" : ""}</div>` : ""}
            ${r.cancel_reason && ["만료", "취소", "작업취소"].includes(r.status) ? `<div class="sub red">${esc(r.cancel_reason)}</div>` : ""}
          </div><div class="side-col row">
            ${r.status === "대기" ? `<button class="btn sm" data-cancel="${esc(r.id)}">요청 취소</button>` : ""}
            ${r.status === "배정" ? `<button class="btn danger sm" data-cancel="${esc(r.id)}" data-assigned="1">배정 취소</button>` : ""}
            ${r.status === "완료" && !r.reviewed ? `<button class="btn sm" data-rev="${esc(r.id)}" data-side="A">평가하기</button>` : ""}
            ${["만료", "작업취소", "취소"].includes(r.status) && approved() ? `<button class="btn sm" data-again="${esc(r.id)}">다시 요청</button>` : ""}
          </div></div>`).join("") : `<div class="empty">보낸 요청이 없습니다.${approved() ? " 예약 상세 창의 [🤝 다른 업체에 배정] 또는 위의 [+ 새 배정 요청]으로 보낼 수 있습니다." : ""}</div>`}
      </div>`;
      const nb = box.querySelector("#shNew"); if (nb) nb.onclick = () => openRequestForm({});
      box.querySelectorAll("[data-cancel]").forEach(b => b.onclick = async () => {
        const assigned = !!b.dataset.assigned;
        const reason = await promptBox(assigned ? "배정을 취소합니다. 상대 업체 일정에서도 예약이 취소됩니다. 사유 (선택)" : "배정 요청을 취소합니다. 사유 (선택)", "예: 고객 요청");
        if (reason === null) return;
        await tryRun(() => api("share_cancel", { request_id: b.dataset.cancel, reason }), "취소했습니다."); rerender();
      });
      box.querySelectorAll("[data-rev]").forEach(b => b.onclick = () => openReview(b.dataset.rev, b.dataset.side));
      box.querySelectorAll("[data-again]").forEach(b => b.onclick = () => {
        const r = rows.find(x => x.id === b.dataset.again);
        openRequestForm({ customer_name: r.customer_name, customer_phone: r.customer_phone, address: r.address, detail_address: r.detail_address, sido: r.sido, sigungu: r.sigungu, category: r.category, service_text: r.service_text, amount: r.amount, memo: r.memo, from_reservation_id: "" });
      });
    },

    /* ---------- 제휴 업체 ---------- */
    async partners(box) {
      const list = await sget("share_partners");
      const inc = list.filter(x => x.status === "신청" && x.direction === "받음"), out = list.filter(x => x.status === "신청" && x.direction === "보냄"), ok = list.filter(x => x.status === "제휴");
      const sido0 = (S.state.areas[0] || {}).sido || "서울";
      box.innerHTML = `
        ${inc.length ? `<div class="panel"><div class="panel-head"><h3>받은 제휴 신청</h3></div>${inc.map(x => `
          <div class="item" style="cursor:default"><div class="main-col"><div class="title">${esc(x.name)} ${repLine(x)}</div>
            <div class="sub">지역: ${esc(x.areas.slice(0, 8).join(", "))}${x.areas.length > 8 ? ` 외 ${x.areas.length - 8}곳` : ""} · ${esc((x.categories || []).join(", "))}</div>${x.memo ? `<div class="sub">메모: ${esc(x.memo)}</div>` : ""}</div>
            <div class="side-col row"><button class="btn sm" data-resp="${x.id}" data-acc="0">거절</button><button class="btn ok sm" data-resp="${x.id}" data-acc="1">수락</button></div></div>`).join("")}</div>` : ""}
        <div class="panel"><div class="panel-head"><h3>제휴 업체 ${ok.length}곳</h3></div>
          ${ok.length ? ok.map(x => `
            <div class="item" style="cursor:default"><div class="main-col">
              <div class="title">${esc(x.name)} ${repLine(x)} ${x.receiving ? "" : '<span class="pill">지금 요청 안 받음</span>'} ${x.i_block ? '<span class="pill danger">배정 안 함</span>' : ""}</div>
              <div class="sub">${telLink(x.phone)} · 지역: ${esc(x.areas.slice(0, 8).join(", "))}${x.areas.length > 8 ? ` 외 ${x.areas.length - 8}곳` : ""} · ${esc((x.categories || []).join(", "))} · ${esc(x.since)}부터</div>
            </div><div class="side-col row">
              <button class="btn sm" data-block="${x.id}" data-v="${x.i_block ? 0 : 1}">${x.i_block ? "다시 배정하기" : "다시 배정하지 않기"}</button>
              <button class="btn danger sm" data-end="${x.id}">제휴 끊기</button>
            </div></div>`).join("") : `<div class="empty">아직 제휴 업체가 없습니다. 아래에서 지역별로 찾아 신청해 보세요.</div>`}
          ${out.length ? `<div class="section-title">수락 기다리는 신청</div>${out.map(x => `<div class="row" style="justify-content:space-between;padding:6px 0"><span>${esc(x.name)} <span class="small muted">${esc(x.since)} 신청</span></span><button class="btn sm" data-cancelreq="${x.id}">신청 취소</button></div>`).join("")}` : ""}
        </div>
        <div class="panel"><div class="panel-head"><h3>제휴 업체 찾기</h3><span class="small muted">그 지역을 서비스하는, 운영자 승인을 받은 업체만 보입니다</span></div>
          ${approved() ? `<div class="row"><select id="fSido" style="width:auto">${SIDO_LIST.map(s => `<option ${s === sido0 ? "selected" : ""}>${s}</option>`).join("")}</select>
            <select id="fSg" style="width:auto"></select><button class="btn" id="fGo">찾기</button></div><div id="fRes" style="margin-top:10px"></div>`
          : `<div class="empty">제안받기 설정을 켜고 운영자 승인을 받으면 찾을 수 있습니다.</div>`}
        </div>`;
      box.querySelectorAll("[data-resp]").forEach(b => b.onclick = async () => { await tryRun(() => api("share_partner_respond", { id: Number(b.dataset.resp), accept: b.dataset.acc === "1" }), b.dataset.acc === "1" ? "제휴를 맺었습니다." : "거절했습니다."); rerender(); });
      box.querySelectorAll("[data-block]").forEach(b => b.onclick = async () => { await tryRun(() => api("share_partner_update", { id: Number(b.dataset.block), block: b.dataset.v === "1" }), b.dataset.v === "1" ? "이 업체에는 배정 요청을 보내지 않습니다. (상대는 알 수 없음)" : "다시 배정 요청을 보냅니다."); rerender(); });
      box.querySelectorAll("[data-end]").forEach(b => b.onclick = async () => { if (!(await confirmBox("제휴를 끊을까요? 지난 배정·정산 기록은 남습니다.", "제휴 끊기"))) return; await tryRun(() => api("share_partner_update", { id: Number(b.dataset.end), end: true }), "제휴를 끊었습니다."); rerender(); });
      box.querySelectorAll("[data-cancelreq]").forEach(b => b.onclick = async () => { await tryRun(() => api("share_partner_update", { id: Number(b.dataset.cancelreq), cancel_request: true }), "신청을 취소했습니다."); rerender(); });
      const fs = box.querySelector("#fSido");
      if (fs) {
        const fill = () => { box.querySelector("#fSg").innerHTML = `<option value="">${fs.value} 전체</option>` + sgList(fs.value).map(s => `<option>${s}</option>`).join(""); };
        fs.onchange = fill; fill();
        box.querySelector("#fGo").onclick = async () => {
          const res = box.querySelector("#fRes"); res.innerHTML = '<div class="small muted">찾는 중...</div>';
          try {
            const xs = await sget("share_search", { sido: fs.value, sigungu: box.querySelector("#fSg").value });
            res.innerHTML = xs.length ? xs.map(x => `<div class="item" style="cursor:default"><div class="main-col"><div class="title">${esc(x.name)} ${repLine(x)}</div>
              <div class="sub">지역: ${esc(x.areas.slice(0, 8).join(", "))}${x.areas.length > 8 ? ` 외 ${x.areas.length - 8}곳` : ""} · ${esc((x.categories || []).join(", "))}</div></div>
              <div class="side-col">${x.partnership === "제휴" ? '<span class="pill ok">제휴 중</span>' : x.partnership === "신청" ? '<span class="pill info">신청 중</span>' : `<button class="btn primary sm" data-apply="${esc(x.company_id)}">제휴 신청</button>`}</div></div>`).join("")
              : '<div class="empty">조건에 맞는 업체가 없습니다.</div>';
            res.querySelectorAll("[data-apply]").forEach(b => b.onclick = async () => {
              const memo = await promptBox("상대 업체에 보낼 한마디 (선택)", "예: 강동구 설비 같이 하실래요?");
              if (memo === null) return;
              await tryRun(() => api("share_partner_request", { company_id: b.dataset.apply, memo }), "제휴를 신청했습니다. 상대 업체가 수락하면 알려 드려요."); rerender();
            });
          } catch (e) { res.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
        };
      }
    },

    /* ---------- 소개비 정산 ---------- */
    async settle(box) {
      if (!S.month) S.month = todayStr().slice(0, 7);
      const d = await sget("share_settlement", { month: S.month });
      const by = {};
      d.rows.forEach(r => { const o = by[r.partner] = by[r.partner] || { recv: 0, pay: 0, open: 0 }; if (r.direction === "받을 돈") o.recv += r.fee_amount; else o.pay += r.fee_amount; if (!r.settled_at) o.open += r.fee_amount; });
      box.innerHTML = `<div class="panel"><div class="panel-head"><h3>소개비 정산</h3><input type="month" id="stM" value="${esc(S.month)}" style="width:auto"></div>
        <p class="small muted" style="margin-top:0">완료된 배정만 나옵니다. 실제 송금은 업체끼리 직접 하고, 주고받은 뒤 [정산 완료]를 눌러 기록하세요.</p>
        ${Object.keys(by).length ? `<div class="box" style="margin-bottom:12px">${Object.entries(by).map(([k, o]) => `<div class="sum-row"><span><b>${esc(k)}</b></span><span>받을 돈 <span class="green">${money(o.recv)}</span> · 줄 돈 <span class="red">${money(o.pay)}</span> · 차액 <b>${money(o.recv - o.pay)}</b>${o.open ? ` · <span class="small muted">미정산 ${money(o.open)}</span>` : ""}</span></div>`).join("")}</div>` : ""}
        ${d.rows.length ? d.rows.map(r => `<div class="item" style="cursor:default"><div class="main-col">
            <div class="title"><span class="pill ${r.direction === "받을 돈" ? "ok" : "danger"}">${r.direction}</span> ${money(r.fee_amount)} · ${esc(r.partner)}</div>
            <div class="sub">${esc(r.date)} · ${esc(r.customer_name)} · ${esc(r.service_text)} ${money(r.amount)}</div></div>
          <div class="side-col">${r.settled_at ? `<span class="small green">정산 완료 ${esc(r.settled_at.slice(5, 10))}</span> <button class="btn ghost sm" data-undo="${esc(r.id)}">되돌리기</button>` : `<button class="btn sm" data-settle="${esc(r.id)}">정산 완료</button>`}</div></div>`).join("")
          : '<div class="empty">이 달에 완료된 배정이 없습니다.</div>'}</div>`;
      box.querySelector("#stM").onchange = e => { S.month = e.target.value; TABS.settle(box); };
      box.querySelectorAll("[data-settle]").forEach(b => b.onclick = async () => { await tryRun(() => api("share_settle", { request_id: b.dataset.settle }), "정산 완료로 표시했습니다."); TABS.settle(box); });
      box.querySelectorAll("[data-undo]").forEach(b => b.onclick = async () => { await tryRun(() => api("share_settle", { request_id: b.dataset.undo, undo: true }), "되돌렸습니다."); TABS.settle(box); });
    },

    /* ---------- 제안받기 설정 ---------- */
    async profile(box) {
      const st = await loadState(true), p = st.profile;
      const sel = new Set(st.areas.map(a => a.sido + "|" + a.sigungu));
      let cur = (st.areas[0] || {}).sido || "서울";
      const status = { "미신청": "아직 신청 전", "대기": "⏳ 운영자 승인 대기", "승인": "✅ 승인됨", "보류": "⚠️ 승인 보류" }[p.approved] || p.approved;
      box.innerHTML = `<div class="panel"><div class="panel-head"><h3>타업체에서 서비스 제안받기</h3><span class="pill ${p.approved === "승인" ? "ok" : p.approved === "보류" ? "danger" : "info"}">${status}</span></div>
        <label class="check"><input type="checkbox" id="pfOn" ${p.enabled ? "checked" : ""}> 제안받기 켜기 (제휴 업체가 내 지역 일을 보낼 수 있게)</label>
        ${p.approved === "보류" ? `<label class="check"><input type="checkbox" id="pfRe"> 저장할 때 운영자에게 다시 승인 요청</label>` : ""}
        <div class="section-title">받을 서비스 분류</div>
        <div class="row">${st.categories.map(c => `<label class="check" style="margin:0 10px 0 0"><input type="checkbox" data-cat="${esc(c)}" ${p.categories.includes(c) ? "checked" : ""}> ${esc(c)}</label>`).join("")}</div>
        <div class="section-title">서비스 가능 지역 <span class="small muted" id="pfCnt"></span></div>
        <div class="row"><select id="pfSido" style="width:auto">${SIDO_LIST.map(s => `<option ${s === cur ? "selected" : ""}>${s}</option>`).join("")}</select>
          <button class="btn sm" id="pfAll">전체 선택</button><button class="btn sm" id="pfNone">선택 해제</button></div>
        <div id="pfGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:2px 8px;margin-top:8px"></div>
        <div id="pfChips" class="small" style="margin-top:8px"></div>
        <div class="section-title">내가 배정 요청을 보낼 때 기본값</div>
        <div class="grid2">
          <label>기본 소개비<div class="row"><select id="pfFt" style="width:auto"><option ${p.send_fee_type === "정률" ? "selected" : ""}>정률</option><option ${p.send_fee_type === "정액" ? "selected" : ""}>정액</option></select>
            <input id="pfFv" type="number" min="0" step="1" value="${p.send_fee_value}" style="width:110px"> <span id="pfFu">${p.send_fee_type === "정액" ? "원" : "%"}</span></div></label>
          <label>응답 기한<select id="pfDl">${[1, 2, 3, 6, 12, 24].map(h => `<option value="${h}" ${h === p.deadline_hours ? "selected" : ""}>${h}시간</option>`).join("")}</select></label>
        </div>
        <div class="right" style="margin-top:14px"><button class="btn primary" id="pfSave">저장</button></div></div>`;
      const grid = box.querySelector("#pfGrid");
      const drawChips = () => {
        box.querySelector("#pfCnt").textContent = sel.size ? `${sel.size}곳 선택` : "";
        const by = {}; [...sel].forEach(k => { const [a, b] = k.split("|"); (by[a] = by[a] || []).push(b); });
        box.querySelector("#pfChips").innerHTML = Object.entries(by).map(([a, xs]) => `<div><b>${esc(a)}</b> ${esc(xs.sort().join(", "))}</div>`).join("") || '<span class="muted">선택한 지역이 없습니다.</span>';
      };
      const drawGrid = () => {
        grid.innerHTML = sgList(cur).map(s => `<label class="check" style="margin:2px 0"><input type="checkbox" data-sg="${esc(s)}" ${sel.has(cur + "|" + s) ? "checked" : ""}> ${esc(s)}</label>`).join("");
        grid.querySelectorAll("[data-sg]").forEach(c => c.onchange = () => { const k = cur + "|" + c.dataset.sg; c.checked ? sel.add(k) : sel.delete(k); drawChips(); });
        drawChips();
      };
      box.querySelector("#pfSido").onchange = e => { cur = e.target.value; drawGrid(); };
      box.querySelector("#pfAll").onclick = () => { sgList(cur).forEach(s => sel.add(cur + "|" + s)); drawGrid(); };
      box.querySelector("#pfNone").onclick = () => { sgList(cur).forEach(s => sel.delete(cur + "|" + s)); drawGrid(); };
      box.querySelector("#pfFt").onchange = e => box.querySelector("#pfFu").textContent = e.target.value === "정액" ? "원" : "%";
      drawGrid();
      box.querySelector("#pfSave").onclick = async () => {
        const payload = {
          enabled: box.querySelector("#pfOn").checked, reapply: !!(box.querySelector("#pfRe") && box.querySelector("#pfRe").checked),
          categories: [...box.querySelectorAll("[data-cat]")].filter(c => c.checked).map(c => c.dataset.cat),
          areas: [...sel].map(k => { const [sido, sigungu] = k.split("|"); return { sido, sigungu }; }),
          send_fee_type: box.querySelector("#pfFt").value, send_fee_value: Number(box.querySelector("#pfFv").value || 0), deadline_hours: Number(box.querySelector("#pfDl").value)
        };
        const r = await tryRun(() => api("share_profile_save", payload), "저장했습니다.");
        if (r && r.approved === "대기") toast("저장했습니다. 운영자에게 승인을 요청했습니다.");
        rerender();
      };
    }
  };

  /* ---------- 수락 창 ---------- */
  function openAccept(r) {
    const admins = App.admins.filter(a => a.active !== false);
    const m = openModal({
      title: "배정 요청 수락",
      body: `<div class="box"><b>${whenText(r)}</b><div style="margin-top:4px">📍 ${esc(r.area_hint)} · ${esc(r.service_text)}</div>
          <div>고객 금액 <b>${money(r.amount)}</b> · 소개비 <b>${feeText(r)}</b> → ${esc(r.from_name)}</div></div>
        <label>담당자<select id="acA">${admins.map(a => `<option value="${esc(a.admin_id)}" ${a.admin_id === App.me.admin_id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label>
        <p class="small muted">수락하면 이 시간에 <b>예약확정</b>으로 내 일정에 들어가고, 고객 이름·연락처·주소가 공개됩니다.<br>금액은 요청 업체가 고객에게 안내한 금액 그대로이며, 작업 완료 후 소개비를 요청 업체에 보내 주세요.</p>`,
      foot: `<button class="btn" data-x>닫기</button><button class="btn ok" data-ok>수락하기</button>`
    });
    m.$("[data-x]").onclick = m.close;
    m.$("[data-ok]").onclick = async () => {
      const res = await tryRun(() => api("share_accept", { request_id: r.id, assignee_id: m.$("#acA").value }), "배정되었습니다! 내 일정에 예약이 들어갔습니다.");
      if (res) { m.close(); rerender(); }
    };
  }

  /* ---------- 배정 요청 창 ---------- */
  async function openRequestForm(pre) {
    const st = await loadState(true);
    if (!approved()) return toast("제안받기 설정을 켜고 운영자 승인을 받아야 보낼 수 있습니다.", true);
    const auto = parseArea(pre.address);
    const sido = pre.sido || auto.sido || (st.areas[0] || {}).sido || "서울";
    const sg = pre.sigungu || auto.sigungu || "";
    const cats = st.categories;
    const m = openModal({
      title: "다른 업체에 배정 요청", wide: true,
      body: `<div class="grid2">
          <label>고객 이름 *<input id="rqN" value="${esc(pre.customer_name || "")}"></label>
          <label>연락처 *<input id="rqP" inputmode="tel" value="${esc(pre.customer_phone || "")}"></label>
        </div>
        <label>주소<input id="rqA" value="${esc(pre.address || "")}"></label>
        <label>상세 주소<input id="rqD" value="${esc(pre.detail_address || "")}"></label>
        <div class="grid2">
          <label>시·도 *<select id="rqS">${SIDO_LIST.map(s => `<option ${s === sido ? "selected" : ""}>${s}</option>`).join("")}</select></label>
          <label>시·군·구 *<select id="rqG"></select></label>
        </div>
        <div class="grid2">
          <label>날짜 *<input id="rqDt" type="date" value="${esc(pre.reservation_date || "")}"></label>
          <div class="grid2"><label>시작 *<input id="rqSt" type="time" step="600" value="${esc(pre.start_time || "")}"></label><label>종료 *<input id="rqEt" type="time" step="600" value="${esc(pre.end_time || "")}"></label></div>
        </div>
        <div class="grid2">
          <label>서비스 분류<select id="rqC">${cats.map(c => `<option ${c === pre.category ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
          <label>고객 금액 (원) *<input id="rqM" type="number" min="0" step="1000" value="${esc(pre.amount || "")}"></label>
        </div>
        <label>서비스 내용<input id="rqT" value="${esc(pre.service_text || "")}" placeholder="예: 세면대 수전 교체"></label>
        <div class="grid2">
          <label>소개비<div class="row"><select id="rqFt" style="width:auto"><option ${st.profile.send_fee_type === "정률" ? "selected" : ""}>정률</option><option ${st.profile.send_fee_type === "정액" ? "selected" : ""}>정액</option></select>
            <input id="rqFv" type="number" min="0" value="${st.profile.send_fee_value}" style="width:100px"> <span id="rqFu"></span> <b id="rqFa"></b></div></label>
          <label>응답 기한<select id="rqH">${[1, 2, 3, 6, 12, 24].map(h => `<option value="${h}" ${h === st.profile.deadline_hours ? "selected" : ""}>${h}시간</option>`).join("")}</select></label>
        </div>
        <label>전달 메모 (받는 업체에 보임)<textarea id="rqMemo" placeholder="예: 주차 어려움, 수전 모델 사진 있음">${esc(pre.memo || "")}</textarea></label>
        <div class="box" id="rqTg" style="margin-top:10px">받을 업체 확인 중...</div>
        <label class="check" style="margin-top:12px"><input type="checkbox" id="rqOk"> 고객에게 <b>협력업체가 방문할 수 있다</b>는 동의를 받았습니다. *</label>
        <p class="small muted">수락 전에는 받는 업체에 고객 이름·연락처·상세 주소가 보이지 않습니다. 먼저 수락한 한 곳에 배정되고, 그 업체에만 공개됩니다.${pre.from_reservation_id ? "<br>배정되면 이 예약은 우리 일정에서 '취소(타업체 배정)'로 바뀝니다." : ""}</p>`,
      foot: `<button class="btn" data-x>닫기</button><button class="btn primary" data-send>요청 보내기</button>`
    });
    const $ = s => m.$(s);
    const fillSg = (want) => { $("#rqG").innerHTML = `<option value="">고르세요</option>` + sgList($("#rqS").value).map(s => `<option ${s === want ? "selected" : ""}>${s}</option>`).join(""); };
    fillSg(sg);
    const fee = () => { const t = $("#rqFt").value, v = Number($("#rqFv").value || 0), a = Number($("#rqM").value || 0); $("#rqFu").textContent = t === "정액" ? "원" : "%"; $("#rqFa").textContent = "= " + money(t === "정액" ? v : Math.round(a * v / 100)); };
    let tmr;
    const targets = () => {
      clearTimeout(tmr); tmr = setTimeout(async () => {
        const box = $("#rqTg"); if (!box) return;
        if (!$("#rqG").value) { box.innerHTML = "고객 지역(시·군·구)을 고르면 받을 업체가 나옵니다."; return; }
        try {
          const xs = await sget("share_targets", { sido: $("#rqS").value, sigungu: $("#rqG").value, category: $("#rqC").value });
          box.innerHTML = xs.length ? `📣 조건에 맞는 제휴 업체 <b>${xs.length}곳</b>에 알림이 갑니다: ${esc(xs.map(x => x.name).join(", "))}` : `<span class="red">${esc($("#rqS").value)} ${esc($("#rqG").value)} · ${esc($("#rqC").value)}를 서비스하는 제휴 업체가 없습니다.</span>`;
        } catch (e) { box.textContent = e.message; }
      }, 250);
    };
    $("#rqS").onchange = () => { fillSg(""); targets(); };
    $("#rqG").onchange = targets; $("#rqC").onchange = targets;
    $("#rqA").onchange = () => { const a = parseArea($("#rqA").value); if (a.sido) { $("#rqS").value = a.sido; fillSg(a.sigungu); targets(); } };
    ["#rqFt", "#rqFv", "#rqM"].forEach(s => $(s).oninput = fee); $("#rqFt").onchange = fee;
    fee(); targets();
    $("[data-x]").onclick = m.close;
    $("[data-send]").onclick = async () => {
      if (!$("#rqOk").checked) return toast("고객 동의를 확인해 주세요.", true);
      const res = await tryRun(() => api("share_request_create", {
        customer_name: $("#rqN").value, customer_phone: $("#rqP").value, address: $("#rqA").value, detail_address: $("#rqD").value,
        sido: $("#rqS").value, sigungu: $("#rqG").value, reservation_date: $("#rqDt").value, start_time: $("#rqSt").value, end_time: $("#rqEt").value,
        category: $("#rqC").value, service_text: $("#rqT").value, amount: Number($("#rqM").value || 0),
        fee_type: $("#rqFt").value, fee_value: Number($("#rqFv").value || 0), deadline_hours: Number($("#rqH").value), memo: $("#rqMemo").value,
        consent: true, from_reservation_id: pre.from_reservation_id || ""
      }));
      if (res) { toast(`${res.targets}곳에 배정 요청을 보냈습니다. (${res.expires_at}까지)`); m.close(); S.tab = "sent"; if (App.view === "share") rerender(); else go("share", { tab: "sent" }); }
    };
  }
  window.openShareRequest = openRequestForm;

  /* ---------- 평가 창 ---------- */
  function openReview(id, side) {
    const tags = side === "A" ? ["시간 약속", "작업 품질", "고객 응대", "소개비 정산"] : ["요청 내용 정확", "취소 없음", "연락 원활"];
    let star = 5;
    const m = openModal({
      title: side === "A" ? "배정받은 업체 평가" : "요청한 업체 평가",
      body: `<div id="rvS" style="font-size:30px;letter-spacing:4px;cursor:pointer"></div>
        <div class="section-title">좋았던 점 (선택)</div>
        <div class="row">${tags.map(t => `<label class="check" style="margin:0 10px 0 0"><input type="checkbox" data-tag="${esc(t)}"> ${esc(t)}</label>`).join("")}</div>
        <label>한 줄 메모 (선택, 상대 업체에는 보이지 않음)<input id="rvM" maxlength="300"></label>
        <p class="small muted">평가는 배정 1건당 한 번, 완료 후 7일 안에 할 수 있습니다. 다른 업체에는 평균 별점만 보입니다.</p>`,
      foot: `<button class="btn" data-x>닫기</button><button class="btn primary" data-ok>평가 저장</button>`
    });
    const draw = () => { m.$("#rvS").innerHTML = [1, 2, 3, 4, 5].map(i => `<span data-s="${i}" style="color:${i <= star ? "#f59e0b" : "#d1d5db"}">★</span>`).join(""); m.$$("[data-s]").forEach(x => x.onclick = () => { star = Number(x.dataset.s); draw(); }); };
    draw();
    m.$("[data-x]").onclick = m.close;
    m.$("[data-ok]").onclick = async () => {
      const ok = await tryRun(() => api("share_review", { request_id: id, stars: star, tags: m.$$("[data-tag]").filter(c => c.checked).map(c => c.dataset.tag), memo: m.$("#rvM").value }), "평가를 저장했습니다.");
      if (ok) { m.close(); rerender(); }
    };
  }

  /* ---------- 예약 상세 창에 버튼 ---------- */
  const origDetail = window.openReservationDetail;
  if (typeof origDetail === "function") {
    window.openReservationDetail = async function (id) {
      const ret = await origDetail.apply(this, arguments);
      try {
        if (String(id || "").startsWith("LK")) return ret;
        const ms = document.querySelectorAll(".modal-back"), m = ms[ms.length - 1];
        if (!m || !m.querySelector("#dCancel")) return ret;   // 완료·취소된 예약은 제외
        if (!S.state) await loadState(false);
        if (!approved()) return ret;
        const b = document.createElement("button");
        b.className = "btn"; b.textContent = "🤝 다른 업체에 배정";
        const foot = m.querySelector(".modal-foot"), before = m.querySelector("#dComplete");
        foot.insertBefore(b, before || null);
        b.onclick = async () => {
          let r; try { r = await api("reservation_get", { reservation_id: id }); } catch (e) { return toast(e.message, true); }
          const c = r.customer || {}, svc = (App.services || []).find(s => s.service_id === (r.services[0] || {}).service_id) || {};
          m.close();
          openRequestForm({
            customer_name: c.name, customer_phone: c.phone, address: c.address, detail_address: c.detail_address,
            reservation_date: r.reservation_date, start_time: r.start_time, end_time: r.end_time,
            category: svc.category || "", service_text: r.services.map(s => s.service_name + (s.quantity > 1 ? " ×" + s.quantity : "")).join(", "),
            amount: r.final_amount, memo: r.customer_request || "", from_reservation_id: id
          });
        };
      } catch (e) {}
      return ret;
    };
  }

  /* ---------- 메뉴 배지 (1분마다) + 알림 눌러서 열었을 때 ---------- */
  let firstHash = location.hash.replace("#", "");
  setInterval(() => { if (App.me && App.token && !document.hidden) loadState(true).catch(() => {}); }, 60000);
  const boot = setInterval(() => {
    if (!App.me || !App.token || !document.getElementById("navBadge_share")) return;
    clearInterval(boot);
    loadState(true).catch(() => {});
    if (firstHash === "share") { firstHash = ""; go("share"); }
  }, 500);
})();
