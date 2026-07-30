import { describe, expect, it } from "vitest";
import { combinarTranscricao, ehErroFatalDeFala } from "./useReconhecimentoDeFala";

describe("ehErroFatalDeFala", () => {
  it("trata falta de permissão/microfone como fatal (não reinicia)", () => {
    expect(ehErroFatalDeFala("not-allowed")).toBe(true);
    expect(ehErroFatalDeFala("service-not-allowed")).toBe(true);
    expect(ehErroFatalDeFala("audio-capture")).toBe(true);
  });

  it("não trata silêncio/aborto como fatal — esses a gente reinicia pra dar mais tempo", () => {
    expect(ehErroFatalDeFala("no-speech")).toBe(false);
    expect(ehErroFatalDeFala("aborted")).toBe(false);
    expect(ehErroFatalDeFala("network")).toBe(false);
  });
});

describe("combinarTranscricao", () => {
  it("emenda a sessão nova ao texto já consolidado", () => {
    expect(combinarTranscricao("3 ovos mexidos", "e uma fatia de pão")).toBe("3 ovos mexidos e uma fatia de pão");
  });

  it("não deixa espaço sobrando quando um dos lados está vazio", () => {
    expect(combinarTranscricao("", "primeira frase")).toBe("primeira frase");
    expect(combinarTranscricao("já dito", "")).toBe("já dito");
    expect(combinarTranscricao("  espaços  ", "  em volta  ")).toBe("espaços em volta");
  });

  it("vazio dos dois lados vira string vazia", () => {
    expect(combinarTranscricao("", "")).toBe("");
  });
});
