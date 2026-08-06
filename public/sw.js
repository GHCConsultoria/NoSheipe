/*
 * Service worker do SHEIPE — só o necessário pra Web Push. Sem cache
 * offline de propósito: o app é dinâmico (o progresso do dia muda a cada
 * registro) e um cache agressivo mostraria número velho. Registrar o SW é o
 * que permite receber push com o PWA fechado (e, no iOS 16.4+, receber push
 * exige o app instalado na tela inicial).
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = {};
  }

  const titulo = dados.titulo || "SHEIPE";
  const corpo = dados.corpo || "";
  const url = dados.url || "/";

  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: corpo,
      icon: "/icons/nosheipe-192.png",
      badge: "/icons/nosheipe-192.png",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      // Se já tem uma aba do app aberta, foca nela em vez de abrir outra.
      for (const janela of janelas) {
        if (janela.url.includes(destino) && "focus" in janela) return janela.focus();
      }
      return self.clients.openWindow(destino);
    }),
  );
});
