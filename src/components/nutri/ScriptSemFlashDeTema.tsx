import { scriptSemFlashDeTema } from "@/lib/nutri/tema";

export function ScriptSemFlashDeTema() {
  return <script dangerouslySetInnerHTML={{ __html: scriptSemFlashDeTema() }} />;
}
