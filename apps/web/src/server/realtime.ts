import "server-only";
import type { Booking } from "@/lib/types";
import { idOf } from "./booking-status";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./supabase";

// Server-side publishing to Supabase Realtime private channels over the REST broadcast endpoint.
// Topics mirror the old Socket.io rooms: booking:<id>, user:<id>, admin.
export const topics = {
  user: (id: string) => `user:${id}`,
  booking: (id: string) => `booking:${id}`,
  admin: "admin",
};

type Message = { topic: string; event: string; payload: unknown; private: true };

async function broadcast(messages: Message[]): Promise<void> {
  if (!messages.length) return;
  try {
    const res = await fetch(`${SUPABASE_URL()}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: SUPABASE_SERVICE_ROLE_KEY(),
        authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY()}`,
      },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) console.error("Realtime broadcast failed:", res.status, await res.text().catch(() => ""));
  } catch (err) {
    // Realtime is best effort: a failed broadcast never fails the request that caused it.
    console.error("Realtime broadcast error:", err);
  }
}

/** Broadcast the canonical booking JSON to everyone who cares about it. */
export async function emitBookingUpdated(booking: Booking): Promise<void> {
  const payload = { booking };
  const targets = new Set<string>([topics.booking(booking.id), topics.admin]);
  for (const ref of [booking.customer, booking.nurse, booking.doctor]) {
    const id = idOf(ref);
    if (id) targets.add(topics.user(id));
  }
  await broadcast([...targets].map((topic) => ({ topic, event: "booking:updated", payload, private: true })));
}

export interface Notice {
  title: string;
  body: string;
  bookingId?: string;
}

/** Send a `notify` toast to one or more users. */
export async function notifyUsers(userIds: Array<string | null | undefined>, notice: Notice): Promise<void> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  await broadcast(ids.map((id) => ({ topic: topics.user(id), event: "notify", payload: notice, private: true })));
}

export async function notifyAdmins(notice: Notice): Promise<void> {
  await broadcast([{ topic: topics.admin, event: "notify", payload: notice, private: true }]);
}
