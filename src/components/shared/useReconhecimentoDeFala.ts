"use client";

import { useCallback, useRef, useState } from "react";

interface SpeechRecognitionResultAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  0: SpeechRecognitionResultAlternative;
  /** true quando o navegador consolidou este trecho (não muda mais). */
  isFinal: boolean;
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  /** Índice do primeiro resultado que mudou neste evento. */
  resultIndex: number;
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
 * chegava a transcrever nada.
 *
 * O texto consolidado (`baseRef`) só cresce com os resultados `isFinal`, e
 * cada um entra UMA vez (varrendo a partir de `resultIndex`). O reinício por
 * silêncio cria uma instância NOVA, de resultados zerados — sem isso, a lista
 * de resultados antiga era re-somada a cada corte e o texto dobrava em loop.
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

    // Fábrica: cada gravação (e cada reinício por silêncio) usa uma instância
    // NOVA, de resultados zerados. É o que impede o texto de dobrar em loop —
    // reaproveitar a mesma instância re-entregava os resultados antigos.
    const criarReconhecimento = (): SpeechRecognitionInstance => {
      const reconhecimento = new Construtor();
      reconhecimento.lang = "pt-BR";
      // continuous=true não encerra na primeira pausa, deixa concluir a fala.
      reconhecimento.continuous = true;
      // interimResults=true: o Safari/iOS às vezes nunca dispara um resultado
      // "final", então guardamos o interino mais recente e entregamos no fim.
      reconhecimento.interimResults = true;

      reconhecimento.onresult = (evento) => {
        // Só o que mudou (a partir de resultIndex): finais entram no texto
        // consolidado UMA vez; o interino atual fica só por cima, transitório.
        let interino = "";
        for (let i = evento.resultIndex; i < evento.results.length; i++) {
          const resultado = evento.results[i];
          const trecho = resultado[0].transcript;
          if (resultado.isFinal) {
            baseRef.current = combinarTranscricao(baseRef.current, trecho);
          } else {
            interino = combinarTranscricao(interino, trecho);
          }
        }
        transcricaoRef.current = combinarTranscricao(baseRef.current, interino);
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
        // "no-speech"/"aborted" disparam mesmo com algo útil capturado — só
        // avisa se não sobrou transcrição; o onend decide reiniciar ou entregar.
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
        // Corte do navegador (silêncio) com a pessoa ainda gravando: os finais
        // já estão em baseRef; recomeça com uma instância nova, sem re-somar
        // resultados antigos.
        try {
          const proximo = criarReconhecimento();
          reconhecimentoRef.current = proximo;
          proximo.start();
        } catch {
          setGravando(false);
          if (transcricaoRef.current) callbackRef.current?.(transcricaoRef.current);
        }
      };

      return reconhecimento;
    };

    const reconhecimento = criarReconhecimento();
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
