import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "../../../../../prisma/nutri/generated";
import { prismaNutri } from "@/lib/nutri/prisma";
import { StatusCliente, registrarSchema } from "@/lib/cliente/schemas";
import { extrairMacros, IaRespostaInvalidaError, IaNaoConfiguradaError } from "@/lib/nutri/ia";

function serializar(registro: {
  id: string;
  entradaBruta: string;
  itens: string;
  kcal: number;
  proteina: number;
  carbo: number;
  gordura: number;
  confianca: number;
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
    registradoEm: registro.registradoEm.toISOString(),
  };
}

/**
 * Recebe o relato de refeição do cliente (texto ou transcrição de áudio —
 * os dois chegam como texto, `origem` só rotula), chama a IA pra extrair
 * macros e salva. Sem sessão: o token na própria requisição é a
 * credencial, igual ao resto de /p/[token].
 *
 * É rota de API, e não Server Action como o registro de treino, porque a
 * chamada à IA pode demorar e aqui a resposta devolve o registro estimado.
 */
export async function POST(request: NextRequest) {
  const corpoBruto: unknown = await request.json().catch(() => null);
  const parsed = registrarSchema.safeParse(corpoBruto);
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

  // Idempotência: reprocessar o mesmo clientLogId não duplica nem chama a
  // IA de novo — devolve o que já está salvo.
  const existente = await prismaNutri.refeicao.findUnique({
    where: { clienteRegistroId: parsed.data.clientLogId },
  });
  if (existente) {
    return NextResponse.json({ sucesso: true, registro: serializar(existente) });
  }

  let macros;
  try {
    macros = await extrairMacros(parsed.data.rawText);
  } catch (erro) {
    if (erro instanceof IaRespostaInvalidaError || erro instanceof IaNaoConfiguradaError) {
      return NextResponse.json({ erro: erro.message }, { status: 422 });
    }
    throw erro;
  }

  try {
    const registro = await prismaNutri.refeicao.create({
      data: {
        clienteId: cliente.id,
        clienteRegistroId: parsed.data.clientLogId,
        origem: parsed.data.origem,
        entradaBruta: parsed.data.rawText,
        itens: JSON.stringify(macros.items),
        kcal: Math.round(macros.totals.kcal),
        proteina: Math.round(macros.totals.protein),
        carbo: Math.round(macros.totals.carbs),
        gordura: Math.round(macros.totals.fat),
        confianca: macros.confidence,
      },
    });
    return NextResponse.json({ sucesso: true, registro: serializar(registro) });
  } catch (erro) {
    // Corrida entre dois envios com o mesmo clientLogId (duplo clique):
    // a unique constraint pegou, então o registro já existe.
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
