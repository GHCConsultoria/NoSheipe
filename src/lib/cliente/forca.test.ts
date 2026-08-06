import { describe, expect, it } from "vitest";
import { estimar1RM, recordesPorExercicio, volumeDaSessao, formatarCarga } from "./forca";

describe("estimar1RM", () => {
  it("uma repetição máxima devolve a própria carga", () => {
    expect(estimar1RM(100, 1)).toBeCloseTo(103.33, 1); // Epley não é exato em 1 rep, mas ~carga
  });
  it("mais reps com a mesma carga estima 1RM maior", () => {
    expect(estimar1RM(80, 10)).toBeGreaterThan(estimar1RM(80, 5));
  });
  it("carga ou reps inválidos zeram", () => {
    expect(estimar1RM(0, 5)).toBe(0);
    expect(estimar1RM(50, 0)).toBe(0);
  });
});

describe("recordesPorExercicio", () => {
  it("pega a maior carga por exercício e ignora séries sem peso", () => {
    const rec = recordesPorExercicio([
      { exercicio: "Supino", cargaKg: 60, reps: 10 },
      { exercicio: "Supino", cargaKg: 80, reps: 5 },
      { exercicio: "Supino", cargaKg: null, reps: 12 },
      { exercicio: "Agachamento", cargaKg: 100, reps: 5 },
    ]);
    const supino = rec.find((r) => r.exercicio === "Supino");
    expect(supino?.melhorCargaKg).toBe(80);
    expect(rec.find((r) => r.exercicio === "Agachamento")?.melhorCargaKg).toBe(100);
  });

  it("ordena do maior pro menor peso", () => {
    const rec = recordesPorExercicio([
      { exercicio: "Rosca", cargaKg: 20, reps: 12 },
      { exercicio: "Terra", cargaKg: 120, reps: 5 },
    ]);
    expect(rec[0].exercicio).toBe("Terra");
  });

  it("o melhor 1RM pode vir de uma série mais leve com muitas reps", () => {
    // 60kg×15 (e1RM 90) supera 85kg×1 (e1RM ~87,8) no 1RM estimado.
    const rec = recordesPorExercicio([
      { exercicio: "Supino", cargaKg: 85, reps: 1 },
      { exercicio: "Supino", cargaKg: 60, reps: 15 },
    ]);
    const supino = rec[0];
    expect(supino.melhorCargaKg).toBe(85); // recorde de carga continua o mais pesado
    expect(supino.melhor1RM).toBeCloseTo(90, 0); // mas o 1RM estimado vem da série de 15
  });

  it("sem nenhuma carga, não há recorde", () => {
    expect(recordesPorExercicio([{ exercicio: "Prancha", cargaKg: null, reps: null }])).toEqual([]);
  });
});

describe("volumeDaSessao", () => {
  it("soma carga × reps das séries válidas", () => {
    expect(
      volumeDaSessao([
        { exercicio: "Supino", cargaKg: 80, reps: 5 }, // 400
        { exercicio: "Supino", cargaKg: 80, reps: 5 }, // 400
        { exercicio: "Prancha", cargaKg: null, reps: 60 }, // ignora
      ]),
    ).toBe(800);
  });
});

describe("formatarCarga", () => {
  it("inteiro sem casa decimal, meio-quilo com uma casa", () => {
    expect(formatarCarga(80)).toBe("80 kg");
    expect(formatarCarga(82.5)).toBe("82.5 kg");
  });
});
