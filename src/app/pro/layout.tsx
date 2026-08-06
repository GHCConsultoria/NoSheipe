import type { Metadata } from "next";
import { ScriptSemFlashDeTema } from "@/components/nutri/ScriptSemFlashDeTema";

export const metadata: Metadata = {
  title: "SHEIPE",
  description: "Painel do profissional — nutrição e treino num só lugar.",
  icons: {
    icon: "/icons/nosheipe-192.png",
    apple: "/icons/nosheipe-180.png",
  },
};

/**
 * O botão de tema saiu daqui quando a barra de abas entrou, pelo mesmo
 * motivo que saiu da área do cliente: era `fixed bottom-4 right-4` e passou
 * a disputar o rodapé com a navegação no celular. Agora mora numa linha da
 * aba Conta — e o login, que fica fora do grupo (painel) e portanto sem
 * barra, também não precisa dele: ali não há nada pra configurar.
 */
export default function ProRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ScriptSemFlashDeTema />
      {children}
    </>
  );
}
