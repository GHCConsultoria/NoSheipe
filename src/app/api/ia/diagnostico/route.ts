import { NextRequest, NextResponse } from "next/server";
import { selecionarProvedor } from "@/lib/ia/provedor";

/**
 * Diagnóstico temporário: usa a chave configurada (no servidor) pra listar os
 * modelos que o provedor OpenAI-compatible aceita e, com ?testar=1, roda o
 * prompt de macros em cada um pra ver qual devolve JSON limpo (modelos de
 * raciocínio às vezes envolvem a resposta em texto). Nunca expõe a chave.
 * Deve ser removido depois de acertar a configuração.
 */
export const dynamic = "force-dynamic";

interface RespostaModelos {
  data?: Array<{ id?: string }>;
}
interface RespostaChat {
  choices?: Array<{ message?: { content?: string } }>;
}

const PROMPT_TESTE = [
  "Você estima macronutrientes de uma refeição descrita em português.",
  "Responda SOMENTE com JSON válido, sem markdown, sem texto antes ou depois, no formato:",
  '{"items":[{"name":"banana","grams":120,"kcal":105,"protein":1,"carbs":27,"fat":0}],"totals":{"kcal":105,"protein":1,"carbs":27,"fat":0},"confidence":0.7}',
  'Descrição da refeição: "1 banana média"',
].join("\n");

function baseDoProvedor(nome: string, baseUrl: string | undefined): string | null {
  if (nome === "compativel") return (baseUrl ?? "").replace(/\/+$/, "");
  if (nome === "groq") return "https://api.groq.com/openai/v1";
  if (nome === "github") return "https://models.github.ai/inference";
  return null;
}

export async function GET(request: NextRequest) {
  const provedor = selecionarProvedor(process.env);
  if (!provedor) {
    return NextResponse.json({ erro: "nenhum provedor de IA configurado" });
  }

  const info = {
    provedor: provedor.nome,
    baseUrl: provedor.baseUrl ?? null,
    modeloConfigurado: provedor.modelo,
  };

  const base = baseDoProvedor(provedor.nome, provedor.baseUrl);
  if (!base) {
    return NextResponse.json({ ...info, nota: "listagem só p/ provedores OpenAI-compatible" });
  }

  const respostaModelos = await fetch(`${base}/models`, {
    headers: { authorization: `Bearer ${provedor.apiKey}` },
  });
  const dadosModelos: unknown = await respostaModelos.json().catch(() => ({}));
  const modelos =
    dadosModelos && typeof dadosModelos === "object" && Array.isArray((dadosModelos as RespostaModelos).data)
      ? ((dadosModelos as RespostaModelos).data ?? []).map((modelo) => modelo.id ?? "").filter((id) => id.length > 0)
      : [];

  if (request.nextUrl.searchParams.get("testar") !== "1") {
    return NextResponse.json({ ...info, modelosDisponiveis: modelos });
  }

  // Roda o prompt de macros em cada modelo e diz qual devolve JSON parseável.
  const resultados: Array<Record<string, unknown>> = [];
  for (const modelo of modelos) {
    try {
      const resposta = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${provedor.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model: modelo, max_tokens: 800, messages: [{ role: "user", content: PROMPT_TESTE }] }),
      });
      const texto = await resposta.text();
      let corpo: unknown = texto;
      try {
        corpo = JSON.parse(texto);
      } catch {
        // resposta não-JSON do endpoint — mantém texto cru
      }
      const conteudo =
        corpo && typeof corpo === "object" ? ((corpo as RespostaChat).choices?.[0]?.message?.content ?? null) : null;

      let jsonOk = false;
      if (conteudo) {
        const limpo = conteudo.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
        try {
          JSON.parse(limpo);
          jsonOk = true;
        } catch {
          // não parseou — modelo devolveu texto em volta do JSON
        }
      }
      resultados.push({
        modelo,
        httpStatus: resposta.status,
        jsonOk,
        amostra: conteudo ? conteudo.slice(0, 400) : corpo,
      });
    } catch (erro) {
      resultados.push({ modelo, erro: String(erro) });
    }
  }

  return NextResponse.json({ ...info, resultados });
}
