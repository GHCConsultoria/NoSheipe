import { describe, expect, it } from "vitest";
import { ehEmailJaRegistrado } from "./erros-auth";

/**
 * Confundir "e-mail já registrado" com outro erro do Auth tem custo real
 * nos dois sentidos: um falso positivo esconde o motivo verdadeiro (senha
 * fraca vira "já tem conta"), e um falso negativo devolve a mensagem crua
 * do GoTrue, em inglês, sem dizer o que fazer.
 */
describe("ehEmailJaRegistrado", () => {
  it("reconhece a mensagem que o Supabase devolveu em produção", () => {
    expect(ehEmailJaRegistrado("A user with this email address has already been registered")).toBe(true);
  });

  it("reconhece as outras variações do GoTrue", () => {
    expect(ehEmailJaRegistrado("User already registered")).toBe(true);
    expect(ehEmailJaRegistrado("user already exists")).toBe(true);
  });

  it("não confunde com outros erros do Auth", () => {
    expect(ehEmailJaRegistrado("Password should be at least 6 characters")).toBe(false);
    expect(ehEmailJaRegistrado("Unable to validate email address: invalid format")).toBe(false);
    expect(ehEmailJaRegistrado("Email rate limit exceeded")).toBe(false);
    // O caso traiçoeiro: fala de registro, mas não é duplicata.
    expect(ehEmailJaRegistrado("Signups not allowed for this instance")).toBe(false);
  });

  it("aguenta ausência de mensagem", () => {
    expect(ehEmailJaRegistrado(undefined)).toBe(false);
    expect(ehEmailJaRegistrado(null)).toBe(false);
    expect(ehEmailJaRegistrado("")).toBe(false);
  });
});
