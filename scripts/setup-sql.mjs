// Junta las migraciones en supabase/setup.sql para crear la base de un saque
// desde el SQL Editor de Supabase. Correr con: npm run db:setup
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const dir = new URL("../supabase/migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const header = `-- Última Mesa · base completa (generado con "npm run db:setup", no editar a mano)
-- Pegá este archivo entero en Supabase → SQL Editor → Run, en un proyecto nuevo.
-- Incluye: ${files.join(", ")}
--
-- Después, ingresá a la app con tu email una vez y hacete parte del equipo:
--   insert into platform_admins (user_id) select id from auth.users where email = 'tu@email.com';
`;
const body = files.map((f) => `\n-- ===== ${f} =====\n\n${readFileSync(new URL(f, dir), "utf8").trim()}\n`).join("");
writeFileSync(new URL("../supabase/setup.sql", import.meta.url), header + body);
console.log(`supabase/setup.sql listo (${files.length} migraciones)`);
