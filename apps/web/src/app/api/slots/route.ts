import { z } from "zod";
import { errorResponse, json } from "@/server/errors";
import { slotAvailability } from "@/server/slots";
import { dateSchema, parseQuery } from "@/server/validate";

const querySchema = z.object({ date: dateSchema });

/** GET /api/slots?date=YYYY-MM-DD -> { date, slots } */
export async function GET(req: Request) {
  try {
    const { date } = parseQuery(req, querySchema);
    return json({ date, slots: await slotAvailability(date) });
  } catch (err) {
    return errorResponse(err);
  }
}
