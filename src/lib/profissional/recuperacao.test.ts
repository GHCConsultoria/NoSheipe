import { describe, expect, it } from "vitest";
import {
  emailRecuperacaoSchema,
  montarUrlDeRetorno,
  redefinirSenhaSchema,
  resolverOrigem,
} from "./recuperacao";

describe("redefinirSenhaSchema", () => {
  it("aceita senha de 6+ com confirmação igual", () => {
    const r = redefinirSenhaSchema.safeParse({ senha: "abcdef", confirmacao: "abcdef" });
    expect(r.success).toBe(true);
  });

  it("recusa senha curta", () => {
    const r = redefinirSenhaSchema.safeParse({ senha: "abc", confirmacao: "abc" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toMatch(/6 caracteres/);
  });

  it("recusa confirmação diferente, apontando o campo certo", () => {
    const r = redefinirSenhaSchema.safeParse({ senha: "abcdef", confirmacao: "abcdeg" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toMatch(/não conferem/);
      expect(r.error.issues[0]?.path).toEqual(["confirmacao"]);
    }
  });
});

describe("emailRecuperacaoSchema", () => {
  it("normaliza espaço em volta do e-mail", () => {
    const r = emailRecuperacaoSchema.safeParse({ email: "  a@b.com " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("a@b.com");
  });

  it("recusa e-mail inválido", () => {
    expect(emailRecuperacaoSchema.safeParse({ email: "não-é-email" }).success).toBe(false);
  });
});

describe("resolverOrigem", () => {
  it("prefere o header Origin", () => {
    expect(resolverOrigem({ origin: "https://app.example.com", host: "outro" })).toBe("https://app.example.com");
  });

  it("tira barra final do Origin pra não duplicar na concatenação", () => {
    expect(resolverOrigem({ origin: "https://app.example.com/" })).toBe("https://app.example.com");
  });

  it("cai pro Host + protocolo quando não tem Origin", () => {
    expect(resolverOrigem({ host: "app.example.com", proto: "https" })).toBe("https://app.example.com");
  });

  it("assume https quando o protocolo não veio", () => {
    expect(resolverOrigem({ host: "app.example.com" })).toBe("https://app.example.com");
  });

  it("devolve null quando não dá pra saber a origem", () => {
    expect(resolverOrigem({})).toBeNull();
    expect(resolverOrigem({ origin: "  " })).toBeNull();
  });
});

describe("montarUrlDeRetorno", () => {
  it("embute o destino final no next, codificado", () => {
    expect(montarUrlDeRetorno("https://app.example.com")).toBe(
      "https://app.example.com/api/auth/callback?next=%2Fpro%2Fredefinir",
    );
  });
});
