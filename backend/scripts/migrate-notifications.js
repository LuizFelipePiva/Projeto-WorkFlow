import { readFile } from "node:fs/promises";
import db from "../src/shared/config/db.js";

try {
  const sql = await readFile(new URL("../sql/notifications.sql", import.meta.url), "utf8");
  await db.query(sql);
  console.log("Tabela notificacoes pronta. Os registros existentes foram preservados.");
} catch (error) {
  console.error("Não foi possível preparar as notificações:", error.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
