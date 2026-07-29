"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

interface SaldoMacro {
  consumido: number;
  meta: number;
  percentual: number;
}

interface Saldo {
  kcal: SaldoMacro;
  proteina: SaldoMacro;
  carbo: SaldoMacro;
  gordura: SaldoMacro;
}

interface Props {
  nomePaciente: string;
  saldo: Saldo;
}

const FORMATADOR_DATA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "long",
});

function corVar(nome: string, valorPadrao: string): string {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  return valor || valorPadrao;
}

function desenharRetanguloArredondado(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  largura: number,
  altura: number,
  raio: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + raio, y);
  ctx.arcTo(x + largura, y, x + largura, y + altura, raio);
  ctx.arcTo(x + largura, y + altura, x, y + altura, raio);
  ctx.arcTo(x, y + altura, x, y, raio);
  ctx.arcTo(x, y, x + largura, y, raio);
  ctx.closePath();
}

/**
 * Desenha o card de resumo do dia num canvas fora de tela — pega as cores
 * direto das custom properties do tema atual (dark/light), então o card
 * gerado sempre bate com o que o paciente está vendo na tela.
 */
function gerarImagemResumoDoDia(nomePaciente: string, saldo: Saldo): Promise<Blob | null> {
  const largura = 1080;
  const altura = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);

  const corPaper = corVar("--color-paper", "#0a0b0d");
  const corPaperRaised = corVar("--color-paper-raised", "#131519");
  const corInk = corVar("--color-ink", "#e6e8eb");
  const corInkSoft = corVar("--color-ink-soft", "#8b929b");
  const corRule = corVar("--color-rule", "#22262c");
  const corSheipe = corVar("--color-sheipe", "#22c55e");
  const corUrgente = corVar("--color-urgent", "#ff6b7a");

  ctx.fillStyle = corPaper;
  ctx.fillRect(0, 0, largura, altura);
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = corSheipe;
  ctx.beginPath();
  ctx.arc(100, 96, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = corInk;
  ctx.font = "600 32px system-ui, sans-serif";
  ctx.fillText("NoSheipe", 136, 106);

  ctx.fillStyle = corInkSoft;
  ctx.font = "500 28px system-ui, sans-serif";
  ctx.fillText(FORMATADOR_DATA.format(new Date()), 80, 180);

  ctx.fillStyle = corInk;
  ctx.font = "700 56px system-ui, sans-serif";
  ctx.fillText(nomePaciente, 80, 250);

  const macros: { rotulo: string; valor: SaldoMacro }[] = [
    { rotulo: "KCAL", valor: saldo.kcal },
    { rotulo: "PROTEÍNA (G)", valor: saldo.proteina },
    { rotulo: "CARBO (G)", valor: saldo.carbo },
    { rotulo: "GORDURA (G)", valor: saldo.gordura },
  ];

  const topoCartoes = 320;
  const alturaCartao = 190;
  const espaco = 24;
  const larguraCartao = (largura - 80 * 2 - espaco) / 2;

  macros.forEach((macro, indice) => {
    const coluna = indice % 2;
    const linha = Math.floor(indice / 2);
    const x = 80 + coluna * (larguraCartao + espaco);
    const y = topoCartoes + linha * (alturaCartao + espaco);

    ctx.fillStyle = corPaperRaised;
    ctx.strokeStyle = corRule;
    ctx.lineWidth = 2;
    desenharRetanguloArredondado(ctx, x, y, larguraCartao, alturaCartao, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = corInkSoft;
    ctx.font = "600 22px system-ui, sans-serif";
    ctx.fillText(macro.rotulo, x + 28, y + 44);

    ctx.fillStyle = corInk;
    ctx.font = "700 48px system-ui, sans-serif";
    ctx.fillText(`${macro.valor.consumido}`, x + 28, y + 100);

    ctx.fillStyle = corInkSoft;
    ctx.font = "500 24px system-ui, sans-serif";
    ctx.fillText(`de ${macro.valor.meta} · ${macro.valor.percentual}%`, x + 28, y + 136);

    const barraY = y + alturaCartao - 32;
    const barraLargura = larguraCartao - 56;
    ctx.fillStyle = corRule;
    desenharRetanguloArredondado(ctx, x + 28, barraY, barraLargura, 8, 4);
    ctx.fill();
    ctx.fillStyle = macro.valor.percentual > 100 ? corUrgente : corSheipe;
    desenharRetanguloArredondado(ctx, x + 28, barraY, (barraLargura * Math.min(macro.valor.percentual, 100)) / 100, 8, 4);
    ctx.fill();
  });

  ctx.fillStyle = corInkSoft;
  ctx.font = "500 22px system-ui, sans-serif";
  ctx.fillText("Acompanhamento nutricional com NoSheipe", 80, altura - 60);

  return new Promise((resolver) => canvas.toBlob((blob) => resolver(blob), "image/png"));
}

export function CompartilharResumoDoDia({ nomePaciente, saldo }: Props) {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function compartilhar() {
    setErro(null);
    setGerando(true);
    try {
      const blob = await gerarImagemResumoDoDia(nomePaciente, saldo);
      if (!blob) {
        setErro("não deu pra gerar a imagem — tente de novo");
        return;
      }
      const arquivo = new File([blob], "nosheipe-resumo-do-dia.png", { type: "image/png" });

      if (navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], title: "Meu resumo de hoje — NoSheipe" });
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "nosheipe-resumo-do-dia.png";
      link.click();
      URL.revokeObjectURL(url);
    } catch (erroCompartilhar) {
      if (erroCompartilhar instanceof DOMException && erroCompartilhar.name === "AbortError") return;
      setErro("não deu pra compartilhar — tente de novo");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={compartilhar}
        disabled={gerando}
        className="inline-flex items-center gap-1.5 self-start rounded-sm border border-rule px-3 py-1.5 text-xs text-ink-soft transition-colors hover:border-sheipe hover:text-ink disabled:opacity-50"
      >
        <Share2 size={13} strokeWidth={1.75} />
        {gerando ? "Gerando…" : "Compartilhar resumo do dia"}
      </button>
      {erro && <p className="text-xs text-urgent">{erro}</p>}
    </div>
  );
}
