import "server-only";
import type { Slot } from "@/lib/types";
import { supabaseAdmin } from "./supabase";
import { EXPRESS_SLOT, SLOTS, isSlotPast, todayIST } from "./time";

/** A slot with this many non-cancelled bookings is full. */
export const SLOT_CAPACITY = 3;

/**
 * Availability of every bookable slot on `date` (YYYY-MM-DD).
 * Past slots (IST) are unavailable, slots with SLOT_CAPACITY or more bookings are full, and for
 * today the list starts with the always-available express entry.
 */
export async function slotAvailability(date: string): Promise<Slot[]> {
  const { data, error } = await supabaseAdmin()
    .from("bookings")
    .select("slot")
    .eq("scheduled_date", date)
    .neq("status", "cancelled");
  if (error) throw error;

  const bySlot = new Map<string, number>();
  for (const row of (data ?? []) as { slot: string }[]) bySlot.set(row.slot, (bySlot.get(row.slot) ?? 0) + 1);

  const hourly: Slot[] = SLOTS.map((slot) => ({
    slot,
    available: !isSlotPast(date, slot) && (bySlot.get(slot) ?? 0) < SLOT_CAPACITY,
  }));
  return date === todayIST() ? [{ slot: EXPRESS_SLOT, available: true, express: true }, ...hourly] : hourly;
}
