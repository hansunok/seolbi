/* 설비시스템 — 알림 받는 일꾼 (Service Worker)
 * 서버가 보낸 푸시를 휴대폰 알림으로 띄우고, 알림을 누르면 관리 화면을 엽니다. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: "알림", body: e.data ? e.data.text() : "" }; }
  const title = d.title || "설비 관리 알림";
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || "",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    icon: "icon-192.png",
    badge: "icon-192.png",
    data: { url: d.url || "index.html" }
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL(e.notification.data && e.notification.data.url || "index.html", self.registration.scope).href;
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of list) {
      if (c.url.startsWith(self.registration.scope)) { await c.focus(); try { c.postMessage({ type: "push-open", url }); } catch (err) {} return; }
    }
    await self.clients.openWindow(url);
  })());
});
