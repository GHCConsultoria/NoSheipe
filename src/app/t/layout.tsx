import { ScriptSemFlashDeTema } from "@/components/nutri/ScriptSemFlashDeTema";
import { ThemeToggle } from "@/components/nutri/ThemeToggle";

export default function PaginaPublicaAlunoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ScriptSemFlashDeTema />
      {children}
      <ThemeToggle />
    </>
  );
}
