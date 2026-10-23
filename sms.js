/* 설비시스템 DB판 — 고객 문자 보내기 (2026-10-23, 구글판에는 없음)
 *  - 예약 상세의 고객 전화 옆 [💬 문자] → 템플릿(예약 확인·주차 등록 요청 등) 골라 휴대폰 문자 앱으로 보내기
 *  - 템플릿·담당자별 차량번호는 최고관리자가 [템플릿 관리]에서 수정
 *  - 보내기는 휴대폰 문자 앱(sms: 링크)을 열어 주는 방식 → 비용 없음, 보낸 사람은 내 휴대폰 번호 */
(function () {
  const TOKENS = [["업체명", "상호"], ["업체전화", "대표 전화"], ["고객명", "고객 이름"], ["예약일시", "10월 30일(금) 10:00~11:00"], ["예약일", "10월 30일(금)"], ["시작시간", "10:00"],
    ["서비스", "서비스 목록"], ["주소", "고객 주소 (상세주소 포함)"], ["담당자", "담당 기사 이름"], ["담당자전화", "담당 기사 전화"], ["차량번호", "담당 기사 차량번호"], ["금액", "예상·최종 금액"]];
  let S = null;
  const load = async force => {
    if (S && !force) return S;
    const r = await callServer("sms_get", {}, App.token);
    if (!r || !r.ok) throw new Error((r && r.error) || "문자 설정을 불러오지 못했습니다.");
    return (S = r.data);
  };
  const WD = ["일", "월", "화", "수", "목", "금", "토"];
  const dayText = d => { const p = String(d || "").split("-").map(Number); if (p.length < 3) return d || ""; return `${p[1]}월 ${p[2]}일(${WD[new Date(p[0], p[1] - 1, p[2]).getDay()]})`; };
  function vars(r) {
    const c = r.customer || {}, a = admin(r.assignee_id) || {};
    return {
      "업체명": S.company_name || App.company || "", "업체전화": S.company_phone || "", "고객명": c.name || "고객",
      "예약일": dayText(r.reservation_date), "시작시간": r.start_time || "", "예약일시": `${dayText(r.reservation_date)} ${r.start_time || ""}${r.end_time ? "~" + r.end_time : ""}`,
      "서비스": (r.services || []).map(s => s.service_name + (s.quantity > 1 ? " ×" + s.quantity : "")).join(", "),
      "주소": [c.address, c.detail_address].filter(Boolean).join(" "), "담당자": a.name || "", "담당자전화": a.phone || "",
      "차량번호": (S.vehicles || {})[r.assignee_id] || "", "금액": money(r.final_amount || 0)
    };
  }
  // {칸} 채우기 — 값이 비는 '· 항목: {칸}' 줄은 통째로 뺌
  function fill(body, v) {
    return String(body).split("\n").filter(line => {
      const toks = [...line.matchAll(/\{([^}]+)\}/g)].map(x => x[1]).filter(k => k in v);
      if (!toks.length || !/^\s*[·\-•]/.test(line)) return true;
      return !toks.every(k => !v[k]);
    }).map(line => line.replace(/\{([^}]+)\}/g, (m, k) => (k in v ? v[k] : m)).replace(/[ \t]+$/, "")).join("\n");
  }
  function openSms(text, phone) {
    const to = String(phone || "").replace(/[^0-9]/g, "");
    const sep = /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent) ? "&" : "?";
    const a = document.createElement("a"); a.href = `sms:${to}${sep}body=${encodeURIComponent(text)}`; a.target = "_top";
    document.body.appendChild(a); a.click(); a.remove();
  }

  async function openSmsForm(r) {
    try { await load(); } catch (e) { return toast(e.message, true); }
    const c = r.customer || {};
    const v = vars(r);
    let cur = S.templates.find(t => t.id === S.default_id) || S.templates[0];
    const m = openModal({
      title: "고객에게 문자 보내기", wide: true,
      body: `<div class="row" style="flex-wrap:wrap;gap:8px"><div class="grow"><b>${esc(c.name || "")}</b> ${esc(c.phone || "")}</div>${isSuper() ? '<button class="btn sm ghost" id="smMng">템플릿 관리</button>' : ""}</div>
        <div class="tabs" id="smTabs" style="margin-top:10px">${S.templates.map(t => `<button data-id="${esc(t.id)}">${esc(t.name)}</button>`).join("")}</div>
        <label>보낼 내용 (보내기 전에 고칠 수 있어요)<textarea id="smBody" rows="12" style="font-size:14px;line-height:1.5"></textarea></label>
        ${!v["차량번호"] && /\{차량번호\}/.test(S.templates.map(t => t.body).join("")) ? `<div class="xs" style="color:var(--warn,#b45309);margin-top:4px">담당자(${esc(v["담당자"] || "미지정")})의 차량번호가 없어서 차량번호 줄은 빠졌어요.${isSuper() ? " [템플릿 관리]에서 넣을 수 있어요." : ""}</div>` : ""}
        <div class="xs muted" style="margin-top:6px">[문자 보내기]를 누르면 휴대폰 문자 앱이 열리고 내용이 채워집니다. 보내기는 문자 앱에서 눌러 주세요. (PC에서는 연결된 휴대폰 앱이 있어야 열려요 — 없으면 [복사]해서 보내세요)</div>`,
      foot: `<button class="btn" data-x>닫기</button><button class="btn" id="smCopy">복사</button><button class="btn primary" id="smSend">💬 문자 보내기</button>`
    });
    const pick = t => { cur = t; m.$$("#smTabs button").forEach(b => b.classList.toggle("active", b.dataset.id === t.id)); m.$("#smBody").value = fill(t.body, v); };
    m.$$("#smTabs button").forEach(b => b.onclick = () => pick(S.templates.find(t => t.id === b.dataset.id)));
    pick(cur);
    m.$("[data-x]").onclick = m.close;
    m.$("#smCopy").onclick = async () => { try { await navigator.clipboard.writeText(m.$("#smBody").value); toast("복사했습니다."); } catch (e) { m.$("#smBody").select(); toast("내용을 길게 눌러 복사하세요."); } };
    m.$("#smSend").onclick = () => { if (!c.phone) return toast("고객 전화번호가 없습니다.", true); openSms(m.$("#smBody").value, c.phone); };
    const mg = m.$("#smMng"); if (mg) mg.onclick = () => openManager(() => { m.close(); openSmsForm(r); });
  }

  async function openManager(after) {
    try { await load(true); } catch (e) { return toast(e.message, true); }
    const list = S.templates.map(t => ({ ...t })), veh = { ...(S.vehicles || {}) };
    let def = S.default_id, idx = 0;
    const m = openModal({
      title: "문자 템플릿 관리", wide: true, sticky: true,
      body: `<div class="tabs" id="tmTabs"></div>
        <div class="grid2"><label>템플릿 이름<input id="tmName"></label><label class="check" style="align-self:end"><input type="checkbox" id="tmDef"> 처음에 열리는 템플릿</label></div>
        <label>내용<textarea id="tmBody" rows="11" style="font-size:14px;line-height:1.5"></textarea></label>
        <div class="xs muted" style="margin:4px 0 2px">아래 칸을 누르면 커서 자리에 들어갑니다. 값이 없는 '· 항목: {칸}' 줄은 보낼 때 자동으로 빠져요.</div>
        <div class="row" style="flex-wrap:wrap;gap:4px" id="tmTok">${TOKENS.map(t => `<button class="btn sm ghost" data-t="${t[0]}" title="${esc(t[1])}">{${t[0]}}</button>`).join("")}</div>
        <div class="row" style="margin-top:8px;gap:6px"><button class="btn sm" id="tmAdd">+ 템플릿 추가</button><button class="btn sm danger" id="tmDel">이 템플릿 삭제</button></div>
        <div class="section-title">담당자별 차량번호 <span class="xs muted" style="font-weight:400">({차량번호} 칸에 들어감)</span></div>
        <div class="grid2">${(App.admins || []).filter(a => a.active !== false && a.active !== "N").map(a => `<label>${esc(a.name)}<input data-veh="${esc(a.admin_id)}" value="${esc(veh[a.admin_id] || "")}" placeholder="예: 12가 3456"></label>`).join("")}</div>`,
      foot: `<button class="btn" data-x>취소</button><button class="btn primary" data-ok>저장</button>`
    });
    const keep = () => { const t = list[idx]; if (!t) return; t.name = m.$("#tmName").value; t.body = m.$("#tmBody").value; if (m.$("#tmDef").checked) def = t.id; };
    const draw = () => {
      m.$("#tmTabs").innerHTML = list.map((t, i) => `<button data-i="${i}" class="${i === idx ? "active" : ""}">${esc(t.name || "(이름 없음)")}${t.id === def ? " ★" : ""}</button>`).join("");
      m.$$("#tmTabs button").forEach(b => b.onclick = () => { keep(); idx = Number(b.dataset.i); draw(); });
      const t = list[idx] || {};
      m.$("#tmName").value = t.name || ""; m.$("#tmBody").value = t.body || ""; m.$("#tmDef").checked = t.id === def;
    };
    draw();
    m.$$("#tmTok [data-t]").forEach(b => b.onclick = () => {
      const ta = m.$("#tmBody"), s0 = ta.selectionStart || ta.value.length, tok = "{" + b.dataset.t + "}";
      ta.value = ta.value.slice(0, s0) + tok + ta.value.slice(ta.selectionEnd || s0); ta.focus(); ta.selectionStart = ta.selectionEnd = s0 + tok.length;
    });
    m.$("#tmAdd").onclick = () => { keep(); list.push({ id: "", name: "새 템플릿", body: "[{업체명}] {고객명}님, " }); idx = list.length - 1; draw(); m.$("#tmName").select(); };
    m.$("#tmDel").onclick = async () => {
      if (list.length <= 1) return toast("템플릿을 하나 이상 남겨 주세요.", true);
      if (!(await confirmBox(`'${list[idx].name}' 템플릿을 삭제할까요? (저장을 눌러야 반영됩니다)`, "삭제"))) return;
      list.splice(idx, 1); idx = 0; draw();
    };
    m.$("[data-x]").onclick = m.close;
    m.$("[data-ok]").onclick = async () => {
      keep();
      m.$$("[data-veh]").forEach(i => veh[i.dataset.veh] = i.value.trim());
      const r = await run(() => api("sms_save", { templates: list, default_id: def, vehicles: veh }), "저장했습니다.").catch(() => null);
      if (!r) return;
      S = r; m.close(); after && after();
    };
  }
  window.openSmsManager = openManager;

  /* ---------- 예약 상세: 전화 옆에 [💬 문자] ---------- */
  const origDetail = window.openReservationDetail;
  if (typeof origDetail === "function") {
    window.openReservationDetail = async function (id) {
      const ret = await origDetail.apply(this, arguments);
      try {
        if (String(id || "").startsWith("LK")) return ret;
        const ms = document.querySelectorAll(".modal-back"), m = ms[ms.length - 1];
        if (!m || m.querySelector("[data-sms]")) return ret;
        const dt = [...m.querySelectorAll("dl.kv dt")].find(x => x.textContent.trim() === "전화");
        const dd = dt && dt.nextElementSibling;
        if (!dd || !dd.textContent.trim()) return ret;
        const b = document.createElement("button");
        b.className = "btn sm"; b.dataset.sms = "1"; b.style.marginLeft = "8px"; b.textContent = "💬 문자";
        dd.appendChild(b);
        b.onclick = async e => {
          e.stopPropagation();
          let r; try { r = await api("reservation_get", { reservation_id: id }, { silent: true }); } catch (x) { return toast(x.message, true); }
          openSmsForm(r);
        };
      } catch (e) {}
      return ret;
    };
  }
})();
