import { describe, expect, it } from "vitest";
import { ordenarRanking } from "./ranking";

describe("ordenarRanking", () => {
  const entradas = [
    { clienteId: "a", apelido: "Ana", metros: 12000 },
    { clienteId: "b", apelido: "Bru", metros: 30500 },
    { clienteId: "c", apelido: "Cau", metros: 8000 },
  ];

  it("ordena do maior km pro menor e numera as posições", () => {
    const r = ordenarRanking(entradas, "c");
    expect(r.map((e) => e.apelido)).toEqual(["Bru", "Ana", "Cau"]);
    expect(r.map((e) => e.posicao)).toEqual([1, 2, 3]);
  });

  it("converte metros em km com uma casa", () => {
    const r = ordenarRanking(entradas, "x");
    expect(r[0].km).toBe(30.5);
    expect(r[1].km).toBe(12);
  });

  it("marca quem é você", () => {
    const r = ordenarRanking(entradas, "c");
    expect(r.find((e) => e.ehVoce)?.apelido).toBe("Cau");
    expect(r.filter((e) => e.ehVoce)).toHaveLength(1);
  });

  it("não muta o array original", () => {
    const copia = [...entradas];
    ordenarRanking(entradas, "a");
    expect(entradas).toEqual(copia);
  });
});
