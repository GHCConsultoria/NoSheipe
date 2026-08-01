import { describe, expect, it } from "vitest";
import { COPO_PADRAO_ML, calcularHidratacao } from "./hidratacao";

describe("calcularHidratacao", () => {
  it("soma os copos e calcula o percentual contra a meta", () => {
    const h = calcularHidratacao([{ ml: 250 }, { ml: 250 }, { ml: 500 }], 2000);
    expect(h).toEqual({ consumidoMl: 1000, metaMl: 2000, percentual: 50, copoMl: COPO_PADRAO_ML });
  });

  it("sem registros, o percentual é zero, não NaN", () => {
    const h = calcularHidratacao([], 2000);
    expect(h.consumidoMl).toBe(0);
    expect(h.percentual).toBe(0);
  });

  it("passa de 100% quando bebeu além da meta — não trava no teto", () => {
    const h = calcularHidratacao([{ ml: 2500 }], 2000);
    expect(h.percentual).toBe(125);
  });

  it("meta zerada não vira divisão por zero", () => {
    const h = calcularHidratacao([{ ml: 250 }], 0);
    expect(h.percentual).toBe(0);
  });
});
