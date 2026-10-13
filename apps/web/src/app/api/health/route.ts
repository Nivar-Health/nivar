import { json } from "@/server/errors";

export async function GET() {
  return json({ ok: true });
}
