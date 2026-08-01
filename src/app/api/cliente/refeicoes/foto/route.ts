import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "../../../../../../prisma/nutri/generated";
import { prismaNutri } from "@/lib/nutri/prisma";
import { OrigemRegistro, StatusCliente, registrarFotoSchema } from "@/lib/cliente/schemas";
import { extrairMacrosDeFoto, IaRespostaInvalidaError, IaNaoConfiguradaError, IaIndisponivelError } from "@/lib/nutri/ia";

function serializar(registro: {
  id: string;
  entradaBruta: string;
  itens: string;
  kcal: number;
  proteina: number;
  carbo: number;
  gordura: number;
  confianca: number;
  macrosPendentes: boolean;
  registradoEm: Date;
}) {
  return {
    id: registro.id,
    entradaBruta: registro.entradaBruta,
    itens: JSON.parse(registro.itens),
    kcal: registro.kcal,
    proteina: registro.proteina,
    carbo: registro.carbo,
    gordura: registro.gordura,
    confianca: registro.confianca,
    macrosPendentes: registro.macrosPendentes,
    registradoEm: registro.registradoEm.toISOString(),
  };
}

/**
 * Registro de refeição por FOTO. Ao contrário do texto, aqui a IA é
 * obrigatória: sem visão não dá pra saber o que tem no prato, então se o
 * provedor está fora a foto NÃO é salva "a estimar" (não haveria texto pra
 * reestimar depois) — devolve erro e a pessoa tenta de novo ou usa texto.
 *
 * A imagem não é guardada: estima e descarta. Só o texto derivado dos itens
 * e os macros ficam — menos dado sensível parado, alinhado à LGPD.
 */
export async function POST(request: NextRequest) {
  const corpoBruto: unknown = await request.json().catch(() => null);
  const parsed = registrarFotoSchema.safeParse(corpoBruto);
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.issues[0]?.message ?? "payload inválido" }, { status: 400 });
  }

  const cliente = await prismaNutri.cliente.findUnique({ where: { tokenAcesso: parsed.data.token } });
  if (!cliente || cliente.status !== StatusCliente.ATIVO) {
    return NextResponse.json({ erro: "cliente não encontrado" }, { status: 404 });
  }
  if (!cliente.consentimentoEm) {
    return NextResponse.json({ erro: "consentimento obrigatório antes de registrar" }, { status: 403 });
  }

  // Idempotência: reprocessar o mesmo clientLogId não duplica nem chama a IA
  // de novo — devolve o que já está salvo.
  const existente = await prismaNutri.refeicao.findUnique({
    where: { clienteRegistroId: parsed.data.clientLogId },
  });
  if (existente) {
    return NextResponse.json({ sucesso: true, registro: serializar(existente) });
  }

  let macros;
  try {
    macros = await extrairMacrosDeFoto({ base64: parsed.data.imagemBase64, mediaType: parsed.data.mediaType });
  } catch (erro) {
    if (erro instanceof IaRespostaInvalidaError) {
      return NextResponse.json({ erro: erro.message }, { status: 422 });
    }
    if (erro instanceof IaIndisponivelError || erro instanceof IaNaoConfiguradaError) {
      console.error("[refeicoes/foto] estimativa por visão indisponível:", erro.message);
      return NextResponse.json(
        { erro: "a estimativa por foto está indisponível agora — tente de novo ou descreva no texto" },
        { status: 503 },
      );
    }
    throw erro;
  }

  // entradaBruta vem dos nomes que a IA reconheceu — dá um rótulo legível ao
  // registro sem guardar a imagem. Vazio (nada reconhecido) cai num padrão.
  const nomes = macros.items.map((i) => i.name).filter(Boolean);
  const entradaBruta = nomes.length > 0 ? nomes.join(", ") : "Refeição (foto)";

  try {
    const registro = await prismaNutri.refeicao.create({
      data: {
        clienteId: cliente.id,
        clienteRegistroId: parsed.data.clientLogId,
        origem: OrigemRegistro.FOTO,
        entradaBruta,
        itens: JSON.stringify(macros.items),
        kcal: Math.round(macros.totals.kcal),
        proteina: Math.round(macros.totals.protein),
        carbo: Math.round(macros.totals.carbs),
        gordura: Math.round(macros.totals.fat),
        confianca: macros.confidence,
        macrosPendentes: false,
      },
    });
    return NextResponse.json({ sucesso: true, registro: serializar(registro) });
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      const jaSalvo = await prismaNutri.refeicao.findUnique({
        where: { clienteRegistroId: parsed.data.clientLogId },
      });
      if (jaSalvo) {
        return NextResponse.json({ sucesso: true, registro: serializar(jaSalvo) });
      }
    }
    throw erro;
  }
}
