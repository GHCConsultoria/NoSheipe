import { describe, expect, it } from "vitest";
import {
  calcularRecordes,
  conquistasDeCorrida,
  formatarDuracao,
  formatarPace,
  paceSegundosPorKm,
  recordesPorDistancia,
} from "./corrida";

describe("paceSegundosPorKm", () => {
  it("5 km em 25 min = 300 s/km", () => {
    expect(paceSegundosPorKm(5000, 1500)).toBe(300);
  });
  it("distância zero não divide por zero", () => {
    expect(paceSegundosPorKm(0, 1500)).toBe(0);
  });
});

describe("formatarPace", () => {
  it("formata como min:seg /km", () => {
    expect(formatarPace(330)).toBe("5:30 /km");
    expect(formatarPace(300)).toBe("5:00 /km");
  });
  it("pace zero vira travessão", () => {
    expect(formatarPace(0)).toBe("—");
  });
});

describe("formatarDuracao", () => {
  it("abaixo de 1h mostra minutos", () => {
    expect(formatarDuracao(1500)).toBe("25 min");
  });
  it("1h ou mais mostra h e min", () => {
    expect(formatarDuracao(3900)).toBe("1h05");
  });
});

describe("calcularRecordes", () => {
  it("pega o melhor pace, a maior distância e o total", () => {
    const r = calcularRecordes([
      { distanciaMetros: 5000, duracaoSegundos: 1500 }, // 300 s/km
      { distanciaMetros: 10000, duracaoSegundos: 3300 }, // 330 s/km
      { distanciaMetros: 3000, duracaoSegundos: 810 }, // 270 s/km (melhor)
    ]);
    expect(r.melhorPaceSegKm).toBe(270);
    expect(r.maiorDistanciaMetros).toBe(10000);
    expect(r.totalMetros).toBe(18000);
    expect(r.quantidade).toBe(3);
  });

  it("ignora tiros curtos (< 1 km) no recorde de pace", () => {
    const r = calcularRecordes([
      { distanciaMetros: 400, duracaoSegundos: 60 }, // 150 s/km, mas curto: não conta
      { distanciaMetros: 5000, duracaoSegundos: 1500 }, // 300 s/km
    ]);
    expect(r.melhorPaceSegKm).toBe(300);
    // A distância curta ainda entra no total e no "maior".
    expect(r.maiorDistanciaMetros).toBe(5000);
    expect(r.totalMetros).toBe(5400);
  });

  it("sem corridas longas o suficiente, melhor pace é null", () => {
    const r = calcularRecordes([{ distanciaMetros: 500, duracaoSegundos: 120 }]);
    expect(r.melhorPaceSegKm).toBeNull();
  });
});

describe("recordesPorDistancia", () => {
  it("dá o melhor pace por marco, contando corridas mais longas", () => {
    const r = recordesPorDistancia([
      { distanciaMetros: 5000, duracaoSegundos: 1500 }, // 5:00 /km
      { distanciaMetros: 10000, duracaoSegundos: 2700 }, // 4:30 /km — mais rápido
    ]);
    const cinco = r.find((x) => x.metros === 5000);
    const dez = r.find((x) => x.metros === 10000);
    // O 10k (mais rápido) também qualifica pro marco de 5k.
    expect(cinco?.melhorPaceSegKm).toBe(270);
    expect(dez?.melhorPaceSegKm).toBe(270);
  });

  it("não inclui marco que ninguém alcançou", () => {
    const r = recordesPorDistancia([{ distanciaMetros: 3000, duracaoSegundos: 900 }]);
    expect(r).toHaveLength(0);
  });
});

describe("conquistasDeCorrida", () => {
  it("marca distância numa corrida e volume acumulado", () => {
    const c = conquistasDeCorrida([
      { distanciaMetros: 10000, duracaoSegundos: 3000 },
      { distanciaMetros: 42000, duracaoSegundos: 15000 },
    ]);
    const porId = Object.fromEntries(c.map((x) => [x.id, x.alcancada]));
    expect(porId.d5).toBe(true);
    expect(porId.d10).toBe(true);
    expect(porId.d21).toBe(true); // a de 42 km passou dos 21
    expect(porId.v50).toBe(true); // 52 km somados
    expect(porId.v100).toBe(false);
  });

  it("sem corridas, nada alcançado", () => {
    expect(conquistasDeCorrida([]).every((x) => !x.alcancada)).toBe(true);
  });
});
