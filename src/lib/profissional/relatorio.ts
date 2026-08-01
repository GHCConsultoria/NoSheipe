import { gerarTexto, IaNaoConfiguradaError, IaIndisponivelError } from "@/lib/ia/provedor";
import type { ComparacaoSemanas } from "@/lib/profissional/consultas";

export { IaNaoConfiguradaError, IaIndisponivelError };

export interface DadosRelatorio {
  nome: string;
  objetivo: string | null;
  peso: { primeiro: number; ultimo: number; dias: number } | null;
  comparacao: ComparacaoSemanas;
}

function linhaComparacao(rotulo: string, atual: number, anterior: number): string {
  const seta = atual > anterior ? "↑" : atual < anterior ? "↓" : "→";
  return `- ${rotulo}: ${atual} (7 dias anteriores: ${anterior}) ${seta}`;
}

/**
 * Monta o prompt do relatório — função pura, sem I/O, pra ser testável e pra
 * o texto do prompt não se perder no meio da chamada de rede. O princípio
 * de domínio "nunca inventar dado" vira instrução explícita: o modelo só
 * pode usar os números listados, e se forem poucos, tem que dizer isso.
 */
export function montarPromptRelatorio(dados: DadosRelatorio): string {
  const fatos: string[] = [];

  if (dados.objetivo) fatos.push(`Objetivo declarado: ${dados.objetivo}.`);

  if (dados.peso) {
    const delta = Number((dados.peso.ultimo - dados.peso.primeiro).toFixed(1));
    const sentido = delta < 0 ? "perdeu" : delta > 0 ? "ganhou" : "manteve";
    fatos.push(
      `Peso: de ${dados.peso.primeiro} kg para ${dados.peso.ultimo} kg em ~${dados.peso.dias} dias (${sentido} ${Math.abs(delta)} kg).`,
    );
  }

  if (dados.comparacao.nutricao) {
    const n = dados.comparacao.nutricao;
    fatos.push("Nutrição (últimos 7 dias vs. 7 anteriores):");
    fatos.push(linhaComparacao("dias com registro", n.dias.atual, n.dias.anterior));
    fatos.push(linhaComparacao("refeições registradas", n.refeicoes.atual, n.refeicoes.anterior));
    fatos.push(linhaComparacao("kcal média por refeição", n.kcalMedia.atual, n.kcalMedia.anterior));
  }

  if (dados.comparacao.treino) {
    const t = dados.comparacao.treino;
    fatos.push("Treino (últimos 7 dias vs. 7 anteriores):");
    fatos.push(linhaComparacao("sessões", t.sessoes.atual, t.sessoes.anterior));
    fatos.push(linhaComparacao("dias treinados", t.dias.atual, t.dias.anterior));
  }

  return [
    "Você escreve um resumo de evolução para um profissional de saúde (nutricionista/personal) sobre um cliente.",
    "Use SOMENTE os dados abaixo. Não invente números, sintomas nem causas que não estejam listados.",
    "Se os dados forem escassos, diga isso claramente em vez de preencher com suposições.",
    "Escreva em português do Brasil, tom profissional e direto, de 3 a 5 frases, em texto corrido (sem listas, sem markdown).",
    `Cliente: ${dados.nome}.`,
    "",
    "Dados:",
    ...fatos,
  ].join("\n");
}

/**
 * Gera o relatório chamando a IA. Erros ficam por conta de quem chama
 * (IaNaoConfiguradaError / IaIndisponivelError) — o mesmo tratamento
 * gracioso do resto do app, que nunca inventa quando a IA está fora.
 */
export async function gerarRelatorioEvolucao(dados: DadosRelatorio): Promise<string> {
  const texto = await gerarTexto({ prompt: montarPromptRelatorio(dados), maxTokens: 500 });
  return texto.trim();
}
