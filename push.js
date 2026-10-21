/* 설비시스템 — 푸시 알림 설정 (내 계정 창에 "알림 설정" 추가)
 *  - 예약 확정·변경·취소 알림 (내 담당 / 전체)
 *  - 일정 알림: 시작 몇 분 전 (본인이 고름)
 *  - 기기마다 [이 기기에서 알림 켜기]를 한 번 눌러야 함 (아이폰은 홈 화면에 추가한 뒤) */
(function () {
  const OFFSETS = [[1440, "1일 전"], [180, "3시간 전"], [120, "2시간 전"], [60, "1시간 전"], [30, "30분 전"], [10, "10분 전"]];
  const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const secure = () => window.isSecureContext && location.protocol !== "file:";
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  let reg = null;

  if (secure() && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then(r => { reg = r; }).catch(() => {});
    navigator.serviceWorker.addEventListener("message", e => { if (e.data && e.data.type === "push-open" && typeof go === "function" && App.me) { const h = String(e.data.url || "").split("#")[1] || ""; go(Views[h] ? h : "myday"); } });
  }

  function b64ToBytes(s) { const p = "=".repeat((4 - s.length % 4) % 4); const b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, c => c.charCodeAt(0)); }
  async function currentSub() { if (!supported() || !secure()) return null; const r = reg || await navigator.serviceWorker.ready; return r.pushManager.getSubscription(); }

  async function enable() {
    if (!secure()) return toast("인터넷 주소(https)로 연 화면에서만 알림을 켤 수 있습니다.", true);
    if (isIOS() && !standalone()) return toast("아이폰은 먼저 [공유 → 홈 화면에 추가]를 한 뒤, 그 아이콘으로 열어 주세요.", true);
    if (!supported()) return toast("이 브라우저는 알림을 지원하지 않습니다. (크롬·사파리 최신 버전 권장)", true);
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return toast("알림이 허용되지 않았습니다. 브라우저 설정에서 이 사이트 알림을 허용해 주세요.", true);
    const key = await api("push_public_key", {});
    const r = reg || await navigator.serviceWorker.ready;
    let sub = await r.pushManager.getSubscription();
    if (!sub) sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key.public_key) });
    await api("push_subscribe", { subscription: sub.toJSON(), user_agent: navigator.userAgent.slice(0, 200) });
    toast("이 기기에서 알림을 받습니다.");
  }
  async function disable() {
    const sub = await currentSub();
    if (sub) { try { await api("push_unsubscribe", { endpoint: sub.endpoint }); } catch (e) {} await sub.unsubscribe(); }
    toast("이 기기 알림을 껐습니다.");
  }

  async function renderPanel(box) {
    box.innerHTML = `<div class="section-title">알림 설정</div><div id="pushState" style="font-size:14px;color:var(--muted)">확인 중...</div>`;
    let prefs = { notify_mine: true, notify_all: false, remind_offsets: [60] }, sub = null;
    try { prefs = await api("push_prefs_get", {}); } catch (e) {}
    try { sub = await currentSub(); } catch (e) {}
    let state;
    if (!secure()) state = "⚠️ 지금은 내 PC 파일로 열려 있어 알림을 켤 수 없습니다. 인터넷 주소(https)로 열면 쓸 수 있어요.";
    else if (isIOS() && !standalone()) state = "📱 아이폰: 사파리 아래 [공유] → [홈 화면에 추가] → 홈 화면 아이콘으로 열고 여기서 알림을 켜 주세요.";
    else if (!supported()) state = "이 브라우저는 알림을 지원하지 않습니다.";
    else if (sub && Notification.permission === "granted") state = "✅ 이 기기에서 알림을 받고 있습니다.";
    else state = "이 기기는 아직 알림을 받지 않습니다.";
    const offs = prefs.remind_offsets || [];
    box.innerHTML = `<div class="section-title">알림 설정</div>
      <div style="font-size:14px;margin:4px 0 10px">${esc(state)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${sub ? `<button class="btn sm" id="pushOff">이 기기 알림 끄기</button>` : `<button class="btn primary sm" id="pushOn">이 기기에서 알림 켜기</button>`}
        <button class="btn sm" id="pushTest">시험 알림 보내기</button>
      </div>
      <label class="check" style="margin-top:14px"><input type="checkbox" id="pfMine" ${prefs.notify_mine ? "checked" : ""}> 내 담당 예약이 확정·변경·취소되면 알림</label>
      ${isSuper() ? `<label class="check"><input type="checkbox" id="pfAll" ${prefs.notify_all ? "checked" : ""}> 모든 예약 확정 알림 (다른 담당자 것도)</label>` : ""}
      <div style="font-size:13px;font-weight:600;margin:14px 0 4px">내 일정 알림 (시작 전에 알려 주기)</div>
      <div style="display:flex;gap:4px 14px;flex-wrap:wrap">${OFFSETS.map(([m, t]) => `<label class="check" style="margin:4px 0"><input type="checkbox" data-off="${m}" ${offs.indexOf(m) >= 0 ? "checked" : ""}> ${t}</label>`).join("")}</div>
      <div style="margin-top:10px"><button class="btn sm" id="pushSave">알림 설정 저장</button></div>`;
    const $ = s => box.querySelector(s);
    if ($("#pushOn")) $("#pushOn").onclick = async () => { try { await enable(); } catch (e) { toast(e.message, true); } renderPanel(box); };
    if ($("#pushOff")) $("#pushOff").onclick = async () => { await disable(); renderPanel(box); };
    $("#pushTest").onclick = () => run(() => api("push_test", {}), "시험 알림을 보냈습니다. 잠시 후 알림이 오는지 확인해 주세요.");
    $("#pushSave").onclick = () => run(() => api("push_prefs_save", {
      notify_mine: $("#pfMine").checked, notify_all: $("#pfAll") ? $("#pfAll").checked : false,
      remind_offsets: [...box.querySelectorAll("[data-off]")].filter(x => x.checked).map(x => Number(x.dataset.off))
    }), "알림 설정을 저장했습니다.");
  }

  // 내 계정 창에 알림 설정 붙이기
  const orig = window.openMyAccount;
  if (typeof orig === "function") {
    window.openMyAccount = function () {
      orig.apply(this, arguments);
      const ms = document.querySelectorAll(".modal-back"), m = ms[ms.length - 1];
      if (!m) return;
      const box = document.createElement("div");
      box.style.marginTop = "18px";
      m.querySelector(".modal-body").appendChild(box);
      renderPanel(box);
    };
  }
})();
