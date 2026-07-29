import type { Metadata } from "next";
import { ScriptSemFlashDeTema } from "@/components/nutri/ScriptSemFlashDeTema";
import { ThemeToggle } from "@/components/nutri/ThemeToggle";

export const metadata: Metadata = {
  title: "NoSheipe",
  description: "Painel do profissional — nutrição e treino num só lugar.",
  icons: {
    icon: "/icons/nosheipe-192.png",
    apple: "/icons/nosheipe-180.png",
  },
};

export default function ProRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ScriptSemFlashDeTema />
      {children}
      <ThemeToggle />
    </>
  );
}
