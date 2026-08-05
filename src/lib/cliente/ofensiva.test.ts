import { describe, expect, it } from "vitest";
import { calcularOfensiva, nivelDaChama } from "./ofensiva";

describe("calcularOfensiva", () => {
  it("conta dias seguidos terminando hoje", () => {
    const o = calcularOfensiva(["2026-08-01", "2026-07-31", "2026-07-30"], "2026-08-01");
    expect(o).toEqual({ dias: 3, ativaHoje: true });
  });

  it("sem registro hoje, mantém a ofensiva que terminou ontem, como pendente", () => {
    const o = calcularOfensiva(["2026-07-31", "2026-07-30"], "2026-08-01");
    expect(o).toEqual({ dias: 2, ativaHoje: false });
  });

  it("um buraco de um dia zera a contagem", () => {
    // Nada ontem nem hoje: a sequência de anteontem pra trás não conta mais.
    const o = calcularOfensiva(["2026-07-30", "2026-07-29"], "2026-08-01");
    expect(o).toEqual({ dias: 0, ativaHoje: false });
  });

  it("sem nenhum registro, ofensiva zero", () => {
    expect(calcularOfensiva([], "2026-08-01")).toEqual({ dias: 0, ativaHoje: false });
  });

  it("atravessa a virada do mês sem drift de fuso", () => {
    const o = calcularOfensiva(["2026-08-01", "2026-07-31"], "2026-08-01");
    expect(o.dias).toBe(2);
  });

  it("ignora dias duplicados e furos futuros", () => {
    const o = calcularOfensiva(["2026-08-01", "2026-08-01", "2026-07-31"], "2026-08-01");
    expect(o.dias).toBe(2);
  });
});

describe("nivelDaChama", () => {
  it("sem ofensiva, chama apagada (cinza) e pequena", () => {
    const n = nivelDaChama(0);
    expect(n.nivel).toBe(0);
    expect(n.cor).toBe("#6b7280");
    expect(n.proximoEm).toBe(1);
  });

  it("cresce e muda de cor a cada marco", () => {
    expect(nivelDaChama(1).rotulo).toBe("Faísca");
    expect(nivelDaChama(3).rotulo).toBe("Esquentando");
    expect(nivelDaChama(7).rotulo).toBe("Chama azul");
    expect(nivelDaChama(7).cor).toBe("#38bdf8");
    // tamanho é estritamente crescente conforme sobe de nível
    expect(nivelDaChama(7).tamanho).toBeGreaterThan(nivelDaChama(3).tamanho);
  });

  it("o ápice é verde, a partir de 30 dias, sem próximo marco", () => {
    const n = nivelDaChama(45);
    expect(n.rotulo).toBe("Impecável");
    expect(n.cor).toBe("#84cc16");
    expect(n.proximoEm).toBeNull();
    expect(n.tamanho).toBe(56);
  });

  it("conta certo quantos dias faltam pro próximo marco", () => {
    expect(nivelDaChama(5).proximoEm).toBe(2); // faltam 2 pra chama azul (7)
    expect(nivelDaChama(10).proximoEm).toBe(4); // faltam 4 pro nível 14
  });

  it("é robusto a valores negativos ou fracionários", () => {
    expect(nivelDaChama(-3).nivel).toBe(0);
    expect(nivelDaChama(7.9).rotulo).toBe("Chama azul");
  });
});
