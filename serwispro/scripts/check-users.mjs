import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const r = await client.execute("SELECT email, passwordHash FROM User");
if (r.rows.length === 0) {
  console.log("BRAK UŻYTKOWNIKÓW W TURSO!");
} else {
  r.rows.forEach((row) => console.log(row[0], row[1] ? "✅ ma hasło" : "❌ BRAK HASŁA"));
}
client.close();
