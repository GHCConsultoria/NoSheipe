"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { CHAVE_TEMA } from "@/lib/nutri/tema";

export function ThemeToggle() {
  const [tema, setTema] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const salvo = window.localStorage.getItem(CHAVE_TEMA);
    if (salvo === "light" || salvo === "dark") {
      setTema(salvo);
      return;
    }
    setTema(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }, []);

  function alternar() {
    const proximo = tema === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", proximo);
    window.localStorage.setItem(CHAVE_TEMA, proximo);
    setTema(proximo);
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label="Alternar tema claro/escuro"
      title="Alternar tema claro/escuro"
      className="fixed bottom-4 right-4 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-rule bg-paper-raised text-ink-soft shadow-sm transition-colors hover:border-sheipe hover:text-ink"
    >
      {tema === "dark" ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
    </button>
  );
}
