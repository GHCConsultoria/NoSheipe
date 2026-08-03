"use client";

/**
 * Compartilhamento do resumo do dia — gera um card em canvas (fora de tela)
 * com as cores do tema atual e dispara o compartilhamento nativo, com queda
 * pra download quando o navegador não tem Web Share. Vive aqui, e não dentro
 * do botão, pra o foguinho flutuante e o botão de "Compartilhar" usarem o
 * mesmo caminho.
 */

export interface SaldoMacro {
  consumido: number;
  meta: number;
  percentual: number;
}

export interface SaldoDia {
  kcal: SaldoMacro;
  proteina: SaldoMacro;
  carbo: SaldoMacro;
  gordura: SaldoMacro;
}

export type ResultadoCompartilhar = { ok: true } | { ok: false; erro: string };

const FORMATADOR_DATA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "long",
});

function corVar(nome: string, valorPadrao: string): string {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  return valor || valorPadrao;
}

function retanguloArredondado(
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

function gerarImagem(nome: string, saldo: SaldoDia): Promise<Blob | null> {
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

  ctx.strokeStyle = "#1c3326";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(100, 96, 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = corSheipe;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(100, 96, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 0.74);
  ctx.stroke();
  ctx.lineCap = "butt";

  ctx.fillStyle = corInk;
  ctx.font = "600 32px system-ui, sans-serif";
  ctx.fillText("NoSheipe", 136, 106);

  ctx.fillStyle = corInkSoft;
  ctx.font = "500 28px system-ui, sans-serif";
  ctx.fillText(FORMATADOR_DATA.format(new Date()), 80, 180);

  ctx.fillStyle = corInk;
  ctx.font = "700 56px system-ui, sans-serif";
  ctx.fillText(nome, 80, 250);

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
    retanguloArredondado(ctx, x, y, larguraCartao, alturaCartao, 16);
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
    retanguloArredondado(ctx, x + 28, barraY, barraLargura, 8, 4);
    ctx.fill();
    ctx.fillStyle = macro.valor.percentual > 100 ? corUrgente : corSheipe;
    retanguloArredondado(ctx, x + 28, barraY, (barraLargura * Math.min(macro.valor.percentual, 100)) / 100, 8, 4);
    ctx.fill();
  });

  ctx.fillStyle = corInkSoft;
  ctx.font = "500 22px system-ui, sans-serif";
  ctx.fillText("Acompanhamento nutricional com NoSheipe", 80, altura - 60);

  return new Promise((resolver) => canvas.toBlob((blob) => resolver(blob), "image/png"));
}

/** Gera o card e compartilha (ou baixa). Nunca lança — devolve o desfecho. */
export async function compartilharResumoDoDia(nome: string, saldo: SaldoDia): Promise<ResultadoCompartilhar> {
  try {
    const blob = await gerarImagem(nome, saldo);
    if (!blob) return { ok: false, erro: "não deu pra gerar a imagem — tente de novo" };
    const arquivo = new File([blob], "nosheipe-resumo-do-dia.png", { type: "image/png" });

    if (navigator.canShare?.({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo], title: "Meu resumo de hoje — NoSheipe" });
      return { ok: true };
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nosheipe-resumo-do-dia.png";
    link.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch (erro) {
    // Cancelar o share nativo não é erro.
    if (erro instanceof DOMException && erro.name === "AbortError") return { ok: true };
    return { ok: false, erro: "não deu pra compartilhar — tente de novo" };
  }
}
