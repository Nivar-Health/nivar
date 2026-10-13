import { z } from "zod";
import { withAuth } from "@/server/auth";
import { idOf } from "@/server/booking-status";
import { findActiveStaff, loadBooking, notifyStatusChange, publishBooking, transition } from "@/server/bookings";
import { badRequest, json } from "@/server/errors";
import { notifyUsers } from "@/server/realtime";
import { parseBody, uuidSchema } from "@/server/validate";

const schema = z.object({ nurseId: uuidSchema, doctorId: uuidSchema });

export const POST = withAuth<{ id: string }>(
  async (req, { user, params }) => {
    const booking = await loadBooking(params.id);
    const { nurseId, doctorId } = await parseBody(req, schema);
    const [nurse, doctor] = await Promise.all([findActiveStaff(nurseId, "nurse"), findActiveStaff(doctorId, "doctor")]);
    if (!nurse) throw badRequest("Select an active nurse", "invalid_nurse");
    if (!doctor) throw badRequest("Select an active doctor", "invalid_doctor");

    const prevNurse = idOf(booking.nurse);
    const prevDoctor = idOf(booking.doctor);
    await transition(booking, "assigned", {
      actor: user,
      via: "assign",
      noteContext: { nurse, doctor },
      set: { nurse_id: nurse.id, doctor_id: doctor.id },
    });
    const payload = await publishBooking(booking.id);

    const when = `${payload.scheduledDate}, ${payload.slot}`;
    const where = payload.address?.area || payload.address?.city || "";
    const newStaff: string[] = [];
    if (prevNurse !== nurse.id) newStaff.push(nurse.id);
    if (prevDoctor !== doctor.id) newStaff.push(doctor.id);
    const removed = [prevNurse !== nurse.id ? prevNurse : null, prevDoctor !== doctor.id ? prevDoctor : null];
    await Promise.all([
      notifyUsers(newStaff, {
        title: "New visit assigned",
        body: `${payload.code} · ${payload.patient.name}${where ? `, ${where}` : ""} · ${when}`,
        bookingId: payload.id,
      }),
      notifyUsers(removed, { title: "Visit reassigned", body: `${payload.code} has been reassigned to a colleague.` }),
      notifyStatusChange("assigned", payload, user),
    ]);
    return json({ booking: payload });
  },
  { roles: ["admin"] },
);
