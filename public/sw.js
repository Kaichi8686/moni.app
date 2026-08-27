/* moni service worker — Web Push */
self.addEventListener("push", (event) => {
  let data = { title: "moni", body: "新しいお知らせがあります" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "moni", {
      body: data.body || "",
      icon: "/icon",
      badge: "/icon",
      data: { url: data.url || "/?tab=posts" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/?tab=posts";
  event.waitUntil(clients.openWindow(url));
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});
