import webpush from "web-push";

/**
 * Web Push (VAPID). Grátis: a notificação vai direto pro serviço de push do
 * navegador (Google/Apple/Mozilla), sem provedor pago. Depende de três
 * variáveis de ambiente que o dono do app provisiona uma vez:
 *
 *   VAPID_PUBLIC_KEY   — chave pública (o cliente usa pra se inscrever)
 *   VAPID_PRIVATE_KEY  — chave privada (assina o envio; nunca vai pro cliente)
 *   VAPID_SUBJECT      — mailto: ou URL de contato (padrão do protocolo)
 *
 * Gere o par uma vez com:  npx web-push generate-vapid-keys
 *
 * Sem as chaves, pushConfigurado() é false e todo o recurso se recolhe
 * sozinho: a UI não oferece o botão e cutucar avisa que não está ligado.
 */

export interface InscricaoPush {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PayloadPush {
  titulo: string;
  corpo: string;
  /** Caminho aberto ao tocar na notificação. */
  url?: string;
}

export type ResultadoEnvio = "ok" | "expirado" | "erro";

export function pushConfigurado(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/** Chave pública, pro cliente se inscrever. Null quando não configurado. */
export function chavePublicaPush(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

let detalhesDefinidos = false;

function garantirVapid(): boolean {
  if (!pushConfigurado()) return false;
  if (!detalhesDefinidos) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:contato@ghcconsultoria.com.br",
      process.env.VAPID_PUBLIC_KEY as string,
      process.env.VAPID_PRIVATE_KEY as string,
    );
    detalhesDefinidos = true;
  }
  return true;
}

/**
 * Envia uma notificação pra uma inscrição. Nunca lança: devolve o desfecho
 * pra quem chama decidir (apagar a inscrição morta, contar as enviadas). Um
 * aparelho que desinstalou o PWA responde 404/410 — "expirado", pra limpar.
 */
export async function enviarPush(inscricao: InscricaoPush, payload: PayloadPush): Promise<ResultadoEnvio> {
  if (!garantirVapid()) return "erro";

  try {
    await webpush.sendNotification(
      { endpoint: inscricao.endpoint, keys: { p256dh: inscricao.p256dh, auth: inscricao.auth } },
      JSON.stringify(payload),
    );
    return "ok";
  } catch (erro) {
    const status = (erro as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "expirado";
    return "erro";
  }
}
