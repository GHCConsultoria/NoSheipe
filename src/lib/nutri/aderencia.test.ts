import { describe, expect, it } from "vitest";
import {
  calcularAderenciaSemana,
  calcularSaldoDoDia,
  estaForaDaMeta,
  limitesDaSemanaEmSaoPaulo,
  limitesDoDiaEmSaoPaulo,
} from "./aderencia";

describe("calcularSaldoDoDia", () => {
  it("soma os registros do dia e calcula o percentual contra a meta", () => {
    const saldo = calcularSaldoDoDia(
      [
        { kcal: 500, proteina: 30, carbo: 40, gordura: 10 },
        { kcal: 300, proteina: 20, carbo: 10, gordura: 5 },
      ],
      { metaKcal: 2000, metaProteina: 100, metaCarbo: 200, metaGordura: 60 },
    );

    expect(saldo.kcal).toEqual({ consumido: 800, meta: 2000, percentual: 40 });
    expect(saldo.proteina).toEqual({ consumido: 50, meta: 100, percentual: 50 });
  });

  it("sem registros, o percentual é zero, não NaN", () => {
    const saldo = calcularSaldoDoDia([], { metaKcal: 2000, metaProteina: 100, metaCarbo: 200, metaGordura: 60 });
    expect(saldo.kcal).toEqual({ consumido: 0, meta: 2000, percentual: 0 });
  });
});

describe("limitesDoDiaEmSaoPaulo", () => {
  it("21h UTC (18h em SP) fica no mesmo dia local, não no dia seguinte", () => {
    const referencia = new Date("2026-03-10T21:00:00.000Z");
    const { inicio, fim } = limitesDoDiaEmSaoPaulo(referencia);

    // Meia-noite de 10/03 em America/Sao_Paulo (UTC-3) é 2026-03-10T03:00:00Z.
    expect(inicio.toISOString()).toBe("2026-03-10T03:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-03-11T03:00:00.000Z");
    expect(referencia >= inicio && referencia < fim).toBe(true);
  });

  it("madrugada UTC que ainda é o dia anterior em SP cai no dia anterior", () => {
    // 2026-03-11T01:00:00Z é 2026-03-10T22:00 em America/Sao_Paulo.
    const referencia = new Date("2026-03-11T01:00:00.000Z");
    const { inicio, fim } = limitesDoDiaEmSaoPaulo(referencia);

    expect(inicio.toISOString()).toBe("2026-03-10T03:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-03-11T03:00:00.000Z");
  });
});

describe("limitesDaSemanaEmSaoPaulo", () => {
  it("numa terça-feira, a semana começa na segunda e 2 dias já se passaram", () => {
    // 2026-03-10 é terça-feira; meio-dia UTC ainda é 10/03 em SP.
    const referencia = new Date("2026-03-10T12:00:00.000Z");
    const { inicio, fim, diasDecorridos } = limitesDaSemanaEmSaoPaulo(referencia);

    expect(inicio.toISOString()).toBe("2026-03-09T03:00:00.000Z"); // segunda 09/03, 00h em SP
    expect(fim.toISOString()).toBe("2026-03-11T03:00:00.000Z"); // fim do dia de hoje (10/03)
    expect(diasDecorridos).toBe(2);
  });

  it("num domingo, a semana inteira (7 dias) já decorreu", () => {
    // 2026-03-15 é domingo.
    const referencia = new Date("2026-03-15T12:00:00.000Z");
    const { inicio, diasDecorridos } = limitesDaSemanaEmSaoPaulo(referencia);

    expect(inicio.toISOString()).toBe("2026-03-09T03:00:00.000Z");
    expect(diasDecorridos).toBe(7);
  });
});

describe("calcularAderenciaSemana", () => {
  it("escala a meta diária pelos dias decorridos em vez da semana inteira", () => {
    const saldo = calcularAderenciaSemana(
      [
        { kcal: 2000, proteina: 100, carbo: 200, gordura: 60 },
        { kcal: 2000, proteina: 100, carbo: 200, gordura: 60 },
      ],
      { metaKcal: 2000, metaProteina: 100, metaCarbo: 200, metaGordura: 60 },
      2,
    );

    // 4000 consumidos / (2000 * 2 dias) = 100%, não 4000/2000 = 200%.
    expect(saldo.kcal).toEqual({ consumido: 4000, meta: 4000, percentual: 100 });
  });
});

describe("estaForaDaMeta", () => {
  it("dentro da faixa 70-130% não é destacado", () => {
    expect(estaForaDaMeta(70)).toBe(false);
    expect(estaForaDaMeta(100)).toBe(false);
    expect(estaForaDaMeta(130)).toBe(false);
  });

  it("abaixo de 70% ou acima de 130% é destacado", () => {
    expect(estaForaDaMeta(69)).toBe(true);
    expect(estaForaDaMeta(131)).toBe(true);
  });
});
