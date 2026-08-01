import { describe, expect, it } from "vitest";
import { montarPromptRelatorio, type DadosRelatorio } from "./relatorio";
import { comparar } from "./comparacao";

const base: DadosRelatorio = {
  nome: "Marina",
  objetivo: "emagrecer",
  peso: { primeiro: 72, ultimo: 70, dias: 30 },
  comparacao: {
    nutricao: {
      dias: comparar(6, 4),
      refeicoes: comparar(18, 12),
      kcalMedia: comparar(420, 500),
    },
    treino: null,
  },
};

describe("montarPromptRelatorio", () => {
  it("inclui a instrução de não inventar dado", () => {
    const p = montarPromptRelatorio(base);
    expect(p).toMatch(/SOMENTE os dados/);
    expect(p).toMatch(/Não invente/);
  });

  it("descreve a variação de peso com o sentido certo", () => {
    const p = montarPromptRelatorio(base);
    expect(p).toContain("72 kg para 70 kg");
    expect(p).toContain("perdeu 2 kg");
  });

  it("lista as métricas de nutrição quando presentes e omite treino quando ausente", () => {
    const p = montarPromptRelatorio(base);
    expect(p).toMatch(/Nutrição/);
    expect(p).not.toMatch(/Treino \(/);
  });

  it("sem peso nem objetivo, não força linhas desses fatos", () => {
    const p = montarPromptRelatorio({
      nome: "João",
      objetivo: null,
      peso: null,
      comparacao: { nutricao: null, treino: { sessoes: comparar(3, 2), dias: comparar(3, 2) } },
    });
    expect(p).not.toMatch(/Peso:/);
    expect(p).not.toMatch(/Objetivo declarado/);
    expect(p).toMatch(/Treino/);
  });
});
