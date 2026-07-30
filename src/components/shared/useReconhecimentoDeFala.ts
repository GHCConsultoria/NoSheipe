"use client";

import { useCallback, useRef, useState } from "react";

interface SpeechRecognitionResultAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  0: SpeechRecognitionResultAlternative;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

function obterConstrutor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function reconhecimentoDeFalaDisponivel(): boolean {
  return obterConstrutor() !== null;
}

/**
 * Erros do reconhecimento que não adianta reiniciar: sem permissão de
 * microfone ou sem captura de áudio, tentar de novo só repetiria a falha em
 * loop. "no-speech"/"aborted" ficam de fora — esses são justamente os que a
 * gente quer reiniciar pra dar mais tempo de fala.
 */
const ERROS_FATAIS = new Set(["not-allowed", "service-not-allowed", "audio-capture"]);
export function ehErroFatalDeFala(codigo: string): boolean {
  return ERROS_FATAIS.has(codigo);
}

/** Junta o texto já consolidado com o da sessão atual, sem sobra de espaço. */
export function combinarTranscricao(base: string, sessao: string): string {
  return [base, sessao].map((parte) => parte.trim()).filter(Boolean).join(" ");
}

/**
 * Transcrição por voz via Web Speech API do navegador — a "abordagem mais
 * simples que funciona" pro demo, sem provedor/chave nova (fora do stack
 * combinado). Suporte varia por navegador (bom em Chrome/Android, ausente
 * em boa parte do Safari/iOS) — documentado no README. Pra produção isso
 * merece um serviço de STT dedicado, não este shim.
 *
 * Fica gravando até a pessoa tocar em "Parar": `continuous = true` não corta
 * na primeira pausa, e quando o navegador encerra sozinho por silêncio o
 * reconhecimento é reiniciado, acumulando o que já foi dito. Sem isso, uma
 * pausa pra respirar no meio da frase terminava a gravação e às vezes nem
 * chegava a transcrever nada — foi o que o usuário viu.
 */
export function useReconhecimentoDeFala() {
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const reconhecimentoRef = useRef<SpeechRecognitionInstance | null>(null);
  // `base` guarda o que já foi consolidado de sessões anteriores (o
  // reconhecimento zera os resultados a cada reinício); `transcricao` é base
  // + sessão atual, o que de fato será entregue.
  const baseRef = useRef("");
  const transcricaoRef = useRef("");
  const callbackRef = useRef<((texto: string) => void) | null>(null);
  // Pedido explícito de parar (toque em "Parar"): aí sim entrega, em vez de
  // reiniciar como faz quando o corte veio do navegador.
  const encerrandoRef = useRef(false);

  const iniciar = useCallback((aoTranscrever: (texto: string) => void) => {
    const Construtor = obterConstrutor();
    if (!Construtor) {
      setErro("gravação por voz não é suportada neste navegador — use o texto");
      return;
    }

    setErro(null);
    baseRef.current = "";
    transcricaoRef.current = "";
    encerrandoRef.current = false;
    callbackRef.current = aoTranscrever;

    const reconhecimento = new Construtor();
    reconhecimento.lang = "pt-BR";
    // continuous=true é o coração da correção: não encerra na primeira pausa,
    // deixa a pessoa concluir a fala.
    reconhecimento.continuous = true;
    // interimResults=false parece mais "certo" (só resultado final), mas no
    // Safari/iOS costuma nunca disparar onresult nenhum nesse modo — grava e
    // termina sem transcrever nada. Com interimResults=true, guarda sempre o
    // texto mais recente aqui e entrega ele em onend (que sempre dispara),
    // em vez de depender de um resultado "final" que o Safari às vezes não
    // entrega.
    reconhecimento.interimResults = true;

    reconhecimento.onresult = (evento) => {
      const sessao = Array.from({ length: evento.results.length }, (_, i) => evento.results[i][0].transcript).join(" ");
      transcricaoRef.current = combinarTranscricao(baseRef.current, sessao);
    };
    reconhecimento.onerror = (evento) => {
      if (ehErroFatalDeFala(evento.error)) {
        // Sem permissão/microfone: não adianta reiniciar. Marca pra parar de
        // vez e avisa (o onend logo em seguida vai encerrar).
        encerrandoRef.current = true;
        setErro(
          evento.error === "not-allowed" || evento.error === "service-not-allowed"
            ? "libere o microfone pro navegador pra gravar por voz — ou use o texto"
            : "não deu pra acessar o microfone — use o texto",
        );
        return;
      }
      // Safari/Chrome disparam "no-speech"/"aborted" mesmo quando já
      // capturaram algo útil — só mostra erro se não sobrou transcrição, e
      // deixa o onend decidir entre reiniciar e entregar.
      if (!transcricaoRef.current) {
        setErro("não deu pra entender o áudio — tente de novo ou use o texto");
      }
    };
    reconhecimento.onend = () => {
      // Corte pela pessoa (ou erro fatal): entrega o que tiver e para.
      if (encerrandoRef.current) {
        setGravando(false);
        if (transcricaoRef.current) callbackRef.current?.(transcricaoRef.current);
        return;
      }
      // Corte do navegador (silêncio/limite interno) com a pessoa ainda
      // gravando: consolida a sessão e recomeça, dando mais tempo de fala.
      baseRef.current = transcricaoRef.current;
      try {
        reconhecimento.start();
      } catch {
        // Se o navegador recusar o reinício, não insiste: entrega o que há.
        setGravando(false);
        if (transcricaoRef.current) callbackRef.current?.(transcricaoRef.current);
      }
    };

    reconhecimentoRef.current = reconhecimento;
    setGravando(true);
    reconhecimento.start();
  }, []);

  const parar = useCallback(() => {
    encerrandoRef.current = true;
    reconhecimentoRef.current?.stop();
  }, []);

  return { gravando, erro, iniciar, parar };
}
