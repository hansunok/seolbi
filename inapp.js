/* 설비시스템 DB판 — 카카오톡 등 '앱 안 브라우저'에서 열었을 때 (2026-10-23)
 *  카톡·네이버·인스타 안에서 링크를 열면 파일 내려받기(PDF 저장)·공유가 막혀 PDF가 제대로 안 만들어짐
 *  1) 위쪽에 안내 + [기본 브라우저로 열기] 버튼 (카톡은 바로 크롬/사파리로 열림)
 *  2) 그래도 앱 안에서 PDF를 만들면: 서버에 올린 뒤 그 PDF 주소를 열어 줌 (앱 안에서도 보기·저장 가능)
 *  0) [📤 공유]는 항상 PDF 링크로 보냄 (파일째 보내면 받는 쪽에서 다시 내려받기가 됨) */
(function () {
  const ua = navigator.userAgent || "";
  const isKakao = /KAKAOTALK/i.test(ua);
  const inApp = isKakao || /NAVER\(inapp|Instagram|FBAN|FBAV|FB_IAB|Line\/|DaumApps|everytimeApp|SamsungBrowser\/[\d.]+ .*CrossApp|; wv\)/i.test(ua);
  window.IN_APP_BROWSER = inApp;

  /* 0) [📤 공유] = 항상 PDF 링크로 보냄 (2026-10-23 결정)
   *    파일을 그대로 카톡에 넘기면 받는 쪽에서 다시 내려받기가 되므로, 링크만 보내는 쪽이 편함
   *    → [📤 카톡 등으로 공유 (링크)] 하나로 합치고, 같은 일을 하던 [🔗 링크로 보내기]는 숨김 */
  const origPreview = window.openDocPreview;
  if (typeof origPreview === "function") {
    window.openDocPreview = function () {
      const m = origPreview.apply(this, arguments);
      try {
        const sh = m.$("[data-share]"), lk = m.$("[data-link]");
        if (sh && lk) {
          sh.textContent = "📤 카톡 등으로 공유 (링크)";
          sh.title = "PDF를 링크로 만들어 보냅니다. 받는 사람은 로그인 없이 링크를 눌러 바로 볼 수 있어요";
          sh.onclick = () => lk.click();
          lk.hidden = true;
        }
      } catch (e) {}
      return m;
    };
  }

  if (!inApp) return;
  const isIOS = /iPhone|iPad|iPod/i.test(ua), isAndroid = /Android/i.test(ua);

  function openExternal() {
    const url = location.href;
    if (isKakao) { location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(url); return; }
    if (isAndroid) { location.href = "intent://" + url.replace(/^https?:\/\//, "") + "#Intent;scheme=https;package=com.android.chrome;end"; return; }
    alert("오른쪽 위(또는 아래) 메뉴 ⋯ 에서 'Safari로 열기' 또는 '다른 브라우저로 열기'를 눌러 주세요.");
  }
  window.openExternalBrowser = openExternal;

  /* 1) 안내 띠 */
  function banner() {
    try { if (sessionStorage.getItem("inapp_hide") === "1") return; } catch (e) {}
    if (document.getElementById("inappBar")) return;
    const bar = document.createElement("div");
    bar.id = "inappBar";
    bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#1f2328;color:#fff;padding:10px 12px calc(10px + env(safe-area-inset-bottom));font-size:13px;display:flex;gap:8px;align-items:center;box-shadow:0 -2px 10px rgba(0,0,0,.2)";
    bar.innerHTML = `<div style="flex:1;line-height:1.4">${isKakao ? "카카오톡" : "앱"} 안에서 열렸어요. PDF 저장·공유·알림이 잘 안 될 수 있어요.</div>
      <button id="inappOpen" style="border:0;border-radius:8px;padding:8px 10px;background:#fee500;color:#191919;font-weight:700;white-space:nowrap">${isIOS && !isKakao ? "사파리로 여는 법" : "기본 브라우저로 열기"}</button>
      <button id="inappX" style="border:0;background:none;color:#aaa;font-size:18px;padding:4px 6px">✕</button>`;
    document.body.appendChild(bar);
    bar.querySelector("#inappOpen").onclick = openExternal;
    bar.querySelector("#inappX").onclick = () => { bar.remove(); try { sessionStorage.setItem("inapp_hide", "1"); } catch (e) {} };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", banner); else banner();

  /* 2) PDF 저장: 내려받기 대신 서버에 올려서 PDF 주소로 열기 */
  const origDownload = window.downloadBlob;
  window.downloadBlob = async function (blob, name) {
    const isPdf = blob && (blob.type === "application/pdf" || /\.pdf$/i.test(name || ""));
    if (!isPdf || typeof api !== "function" || !App || !App.token) return origDownload && origDownload.apply(this, arguments);
    try {
      toast("앱 안 브라우저라서 PDF를 서버에 올려 열어 드릴게요...");
      const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });
      const r = await api("doc_link", { filename: name || "document.pdf", pdf: b64, ref: "inapp" });
      const m = openModal({
        title: "PDF가 준비됐어요",
        body: `<p class="small">카카오톡 안에서는 바로 내려받기가 안 돼서, PDF를 링크로 만들었어요.</p>
          <p class="small">[PDF 열기]를 누르면 PDF가 열립니다. 열린 화면에서 저장·공유할 수 있어요.</p>
          <textarea readonly rows="2" style="width:100%">${esc(r.url)}</textarea>`,
        foot: `<button class="btn" id="ipCopy">링크 복사</button><button class="btn" id="ipExt">기본 브라우저로 열기</button><a class="btn primary" href="${esc(r.url)}" target="_blank" rel="noopener">PDF 열기</a>`
      });
      m.$("#ipCopy").onclick = async () => { try { await navigator.clipboard.writeText(r.url); toast("복사했습니다."); } catch (e) { m.$("textarea").select(); toast("길게 눌러 복사해 주세요."); } };
      m.$("#ipExt").onclick = openExternal;
    } catch (e) {
      toast("PDF를 올리지 못했습니다: " + e.message, true);
      if (origDownload) origDownload.call(this, blob, name);
    }
  };
})();
