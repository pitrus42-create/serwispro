import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const client = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN! });
  
  // Write test - use unique key to avoid conflicts
  const testKey = "ENC-TEST-" + Date.now();
  const testCity = "Gdańsk";
  const testName = "Łukasz Koślański";
  
  await client.execute({
    sql: `INSERT OR IGNORE INTO "Inquiry" 
      (id, inquiryNumber, publicToken, status, serviceType, source, contactName, investmentCity, 
       formAnswers, priorities, convertedToClient, createdAt, updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    args: [testKey, testKey, testKey, "NOWE", "TEST", "TEST", testName, testCity, "{}", "[]"],
  });
  
  // Read back immediately
  const r = await client.execute({ sql: `SELECT contactName, investmentCity FROM "Inquiry" WHERE id=?`, args: [testKey] });
  const readCity = r.rows[0]?.investmentCity as string ?? "";
  const readName = r.rows[0]?.contactName as string ?? "";
  
  // Cleanup
  await client.execute({ sql: `DELETE FROM "Inquiry" WHERE id=?`, args: [testKey] });
  
  return NextResponse.json({
    wrote: { city: testCity, name: testName },
    read: { 
      city: readCity, 
      cityCodes: [...readCity].map(c => c.charCodeAt(0)),
      cityOk: readCity === testCity,
      name: readName,
      nameOk: readName === testName,
    },
  });
}
