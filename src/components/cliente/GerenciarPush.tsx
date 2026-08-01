"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { removerInscricaoPush, salvarInscricaoPush } from "@/lib/cliente/publico";

/** Converte a chave VAPID (base64url) no Uint8Array que o PushManager exige. */
function base64UrlParaUint8Array(base64: string): Uint8Array {
  const preenchido = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const normal = preenchido.replace(/-/g, "+").replace(/_/g, "/");
  const bruto = atob(normal);
  const saida = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i++) saida[i] = bruto.charCodeAt(i);
  return saida;
}

interface Props {
  token: string;
  /** Chave pública VAPID vinda do servidor; null quando o push não está configurado. */
  chavePublica: string | null;
}

/**
 * Liga/desliga os lembretes push NESTE aparelho. A inscrição é por
 * dispositivo, então o estado é lido do próprio navegador no mount (o
 * servidor não sabe se este aparelho específico está inscrito).
 *
 * Recolhe-se sozinho quando não dá pra oferecer: sem chave VAPID, sem
 * suporte a Service Worker/Push, ou permissão negada de vez.
 */
export function GerenciarPush({ token, chavePublica }: Props) {
  const [suportado, setSuportado] = useState(false);
  const [inscrito, setInscrito] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [negado, setNegado] = useState(false);

  useEffect(() => {
    if (!chavePublica) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;

    setSuportado(true);
    setNegado(Notification.permission === "denied");

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setInscrito(Boolean(sub)))
      .catch(() => {
        /* registrar o SW pode falhar em contexto sem HTTPS — só não oferece. */
      });
  }, [chavePublica]);

  if (!chavePublica || !suportado) return null;

  async function ativar() {
    setErro(null);
    setOcupado(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setNegado(permissao === "denied");
        setErro("permissão de notificação não concedida");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlParaUint8Array(chavePublica as string) as BufferSource,
      });

      const json = sub.toJSON();
      const resultado = await salvarInscricaoPush({
        token,
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      });
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      setInscrito(true);
    } catch {
      setErro("não deu pra ativar os lembretes neste aparelho");
    } finally {
      setOcupado(false);
    }
  }

  async function desativar() {
    setErro(null);
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removerInscricaoPush({ token, endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setInscrito(false);
    } catch {
      setErro("não deu pra desativar agora");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="paper-card mt-8 rounded-sm p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="eyebrow flex items-center gap-1.5">
            {inscrito ? <Bell size={13} strokeWidth={1.75} /> : <BellOff size={13} strokeWidth={1.75} />} Lembretes
          </h2>
          <p className="mt-1 text-xs text-ink-faint">
            {inscrito
              ? "Ativados neste aparelho — seu profissional pode te lembrar de registrar."
              : "Receba um empurrãozinho pra não esquecer de registrar."}
          </p>
        </div>
        <button
          type="button"
          disabled={ocupado || negado}
          onClick={inscrito ? desativar : ativar}
          className={`tatil shrink-0 rounded-sm px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
            inscrito
              ? "border border-rule text-ink-soft hover:border-urgent-line hover:text-urgent"
              : "bg-sheipe text-sheipe-on hover:bg-sheipe-deep"
          }`}
        >
          {ocupado ? "…" : inscrito ? "Desativar" : "Ativar"}
        </button>
      </div>
      {negado && (
        <p className="mt-2 text-xs text-ink-faint">
          As notificações estão bloqueadas nas configurações do navegador — libere por lá pra ativar.
        </p>
      )}
      {erro && <p className="mt-2 text-sm text-urgent">{erro}</p>}
    </section>
  );
}
