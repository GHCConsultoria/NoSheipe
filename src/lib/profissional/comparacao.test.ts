import { describe, expect, it } from "vitest";
import { comparar } from "./comparacao";

describe("comparar", () => {
  it("marca subida quando o atual é maior", () => {
    expect(comparar(5, 3)).toEqual({ atual: 5, anterior: 3, delta: 2, direcao: "subiu" });
  });

  it("marca descida quando o atual é menor", () => {
    expect(comparar(2, 6)).toEqual({ atual: 2, anterior: 6, delta: -4, direcao: "desceu" });
  });

  it("marca igual quando não muda, com delta zero", () => {
    expect(comparar(4, 4)).toEqual({ atual: 4, anterior: 4, delta: 0, direcao: "igual" });
  });
});
