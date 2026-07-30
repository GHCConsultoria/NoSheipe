import { describe, expect, it } from "vitest";
import { ehAbaAtiva } from "./abaAtiva";

/**
 * Regressão: com a raiz casando por igualdade exata, a ficha de um cliente
 * em /pro/clientes/{id} não marcava aba nenhuma — a barra inteira apagada,
 * sem indicar onde a pessoa está.
 */

const PRO = "/pro";
const ABAS_PRO = ["/pro", "/pro/clientes/novo", "/pro/conta"];

/** Qual aba fica ativa neste caminho — nenhuma ou mais de uma é erro. */
function ativa(caminho: string, raiz: string, abas: string[]): string | string[] {
  const acesas = abas.filter((href) => ehAbaAtiva(caminho, raiz, href, abas));
  return acesas.length === 1 ? acesas[0] : acesas;
}

describe("aba ativa na área do profissional", () => {
  it("marca Clientes na raiz", () => {
    expect(ativa("/pro", PRO, ABAS_PRO)).toBe("/pro");
  });

  it("marca Novo no cadastro", () => {
    expect(ativa("/pro/clientes/novo", PRO, ABAS_PRO)).toBe("/pro/clientes/novo");
  });

  it("marca Conta na conta", () => {
    expect(ativa("/pro/conta", PRO, ABAS_PRO)).toBe("/pro/conta");
  });

  it("volta pra Clientes na ficha de um cliente — o caso que estava quebrado", () => {
    expect(ativa("/pro/clientes/cms6abc123", PRO, ABAS_PRO)).toBe("/pro");
  });

  it("cai na raiz em rota aninhada que ninguém previu", () => {
    expect(ativa("/pro/relatorios/2026/julho", PRO, ABAS_PRO)).toBe("/pro");
  });
});

describe("aba ativa na área do cliente", () => {
  const RAIZ = "/p/tok123";
  const ABAS = ["/p/tok123", "/p/tok123/historico", "/p/tok123/perfil"];

  it("marca Hoje na raiz", () => {
    expect(ativa("/p/tok123", RAIZ, ABAS)).toBe("/p/tok123");
  });

  it("marca Histórico e Perfil nas suas rotas", () => {
    expect(ativa("/p/tok123/historico", RAIZ, ABAS)).toBe("/p/tok123/historico");
    expect(ativa("/p/tok123/perfil", RAIZ, ABAS)).toBe("/p/tok123/perfil");
  });

  it("nunca acende duas ao mesmo tempo", () => {
    for (const caminho of ["/p/tok123", "/p/tok123/historico", "/p/tok123/perfil"]) {
      const acesas = ABAS.filter((href) => ehAbaAtiva(caminho, RAIZ, href, ABAS));
      expect(acesas).toHaveLength(1);
    }
  });
});
