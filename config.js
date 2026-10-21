// 서버 주소 (Supabase Edge Function)
window.API_BASE = "https://abafudpemxdhuryxorvv.supabase.co/functions/v1/api";
// 업체 코드: 주소 뒤 ?c=업체코드 → 이 브라우저에 기억 (다음부터는 주소만 열어도 됨)
(function () {
  var c = "";
  try { c = new URLSearchParams(location.search).get("c") || ""; } catch (e) {}
  c = String(c).trim().toLowerCase();
  try { if (c) localStorage.setItem("company_code", c); else c = localStorage.getItem("company_code") || ""; } catch (e) {}
  window.COMPANY_CODE = c;
})();
