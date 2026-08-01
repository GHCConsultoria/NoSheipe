import { describe, expect, it } from "vitest";
import { calcularOfensiva } from "./ofensiva";

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
