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
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
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
 * Transcrição por voz via Web Speech API do navegador — a "abordagem mais
 * simples que funciona" pro demo, sem provedor/chave nova (fora do stack
 * combinado). Suporte varia por navegador (bom em Chrome/Android, ausente
 * em boa parte do Safari/iOS) — documentado no README. Pra produção isso
 * merece um serviço de STT dedicado, não este shim.
 */
export function useReconhecimentoDeFala() {
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const reconhecimentoRef = useRef<SpeechRecognitionInstance | null>(null);
  const transcricaoRef = useRef("");
  const callbackRef = useRef<((texto: string) => void) | null>(null);

  const iniciar = useCallback((aoTranscrever: (texto: string) => void) => {
    const Construtor = obterConstrutor();
    if (!Construtor) {
      setErro("gravação por voz não é suportada neste navegador — use o texto");
      return;
    }

    setErro(null);
    transcricaoRef.current = "";
    callbackRef.current = aoTranscrever;

    const reconhecimento = new Construtor();
    reconhecimento.lang = "pt-BR";
    reconhecimento.continuous = false;
    // interimResults=false parece mais "certo" (só resultado final), mas no
    // Safari/iOS costuma nunca disparar onresult nenhum nesse modo — grava e
    // termina sem transcrever nada. Com interimResults=true, guarda sempre o
    // texto mais recente aqui e entrega ele em onend (que sempre dispara),
    // em vez de depender de um resultado "final" que o Safari às vezes não
    // entrega.
    reconhecimento.interimResults = true;

    reconhecimento.onresult = (evento) => {
      const transcricao = Array.from({ length: evento.results.length }, (_, i) => evento.results[i][0].transcript).join(
        " ",
      );
      transcricaoRef.current = transcricao.trim();
    };
    reconhecimento.onerror = () => {
      // Safari costuma disparar "no-speech"/"aborted" mesmo quando já
      // capturou algo útil — só mostra erro se não sobrou transcrição.
      if (!transcricaoRef.current) {
        setErro("não deu pra entender o áudio — tente de novo ou use o texto");
      }
    };
    reconhecimento.onend = () => {
      setGravando(false);
      if (transcricaoRef.current) {
        callbackRef.current?.(transcricaoRef.current);
      }
    };

    reconhecimentoRef.current = reconhecimento;
    setGravando(true);
    reconhecimento.start();
  }, []);

  const parar = useCallback(() => {
    reconhecimentoRef.current?.stop();
  }, []);

  return { gravando, erro, iniciar, parar };
}
