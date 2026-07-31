import { NextResponse } from "next/server";
import { selecionarProvedor } from "@/lib/ia/provedor";

/**
 * Diagnóstico temporário: usa a chave configurada (no servidor) pra listar os
 * modelos que o provedor OpenAI-compatible aceita — sem nunca expor a chave.
 * Serve pra descobrir o nome exato do modelo (ex.: no Cerebras) quando a
 * estimativa devolve "model_not_found". Deve ser removido depois de resolver.
 */
export const dynamic = "force-dynamic";

interface RespostaModelos {
  data?: Array<{ id?: string }>;
}

export async function GET() {
  const provedor = selecionarProvedor(process.env);
  if (!provedor) {
    return NextResponse.json({ erro: "nenhum provedor de IA configurado" });
  }

  const info = {
    provedor: provedor.nome,
    baseUrl: provedor.baseUrl ?? null,
    modeloConfigurado: provedor.modelo,
  };

  // Só o dialeto OpenAI expõe GET /models. A chave vai no header, nunca no corpo.
  const base =
    provedor.nome === "compativel"
      ? (provedor.baseUrl ?? "").replace(/\/+$/, "")
      : provedor.nome === "groq"
        ? "https://api.groq.com/openai/v1"
        : provedor.nome === "github"
          ? "https://models.github.ai/inference"
          : null;

  if (!base) {
    return NextResponse.json({ ...info, nota: "listagem de modelos só p/ provedores OpenAI-compatible" });
  }

  let resposta: Response;
  try {
    resposta = await fetch(`${base}/models`, {
      headers: { authorization: `Bearer ${provedor.apiKey}` },
    });
  } catch (erro) {
    return NextResponse.json({ ...info, erro: `falha de rede: ${String(erro)}` });
  }

  const texto = await resposta.text();
  let dados: unknown = texto;
  try {
    dados = JSON.parse(texto);
  } catch {
    // resposta não-JSON — mantém o texto cru pra inspeção
  }

  let modelosDisponiveis: string[] = [];
  if (dados && typeof dados === "object" && Array.isArray((dados as RespostaModelos).data)) {
    modelosDisponiveis = ((dados as RespostaModelos).data ?? [])
      .map((modelo) => modelo.id ?? "")
      .filter((id) => id.length > 0);
  }

  return NextResponse.json({
    ...info,
    status: resposta.status,
    modelosDisponiveis,
    bruto: modelosDisponiveis.length > 0 ? undefined : dados,
  });
}
