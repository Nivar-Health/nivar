"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api";
import { formatINR } from "@/lib/format";
import type { Booking } from "@/lib/types";
import { cn } from "@/lib/utils";

const REASONS = [
  "Customer requested",
  "No nurse available in this slot",
  "Address not serviceable",
  "Duplicate booking",
];

export function CancelDialog({
  booking,
  open,
  onOpenChange,
  onCancelled,
}: {
  booking: Booking;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled?: (b: Booking) => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const paid = booking.payment?.status === "paid";

  const submit = async () => {
    setSaving(true);
    try {
      const res = await api.post<{ booking: Booking }>(`/bookings/${booking.id}/cancel`, {
        reason: reason.trim() || undefined,
      });
      toast.success(`${booking.code} cancelled`, {
        description: paid ? `${formatINR(booking.amount)} marked for refund.` : undefined,
      });
      onCancelled?.(res.booking);
      onOpenChange(false);
      setReason("");
    } catch (err) {
      toast.error("Couldn't cancel this booking", { description: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-5 sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-lg">Cancel {booking.code}?</DialogTitle>
          <DialogDescription>
            {booking.patient.name}&apos;s visit will be cancelled and {booking.nurse ? "the care team and customer" : "the customer"} notified.
            {paid ? ` The payment of ${formatINR(booking.amount)} will be marked as refunded.` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="cancel-reason" className="text-[13px]">
            Reason <span className="font-normal text-muted-foreground">(shared with the customer)</span>
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  reason === r
                    ? "border-primary bg-secondary text-secondary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="Add a short note"
            className="min-h-20"
          />
        </div>
        <DialogFooter className="-mx-5 -mb-5 px-5">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Keep booking
          </Button>
          <Button
            onClick={submit}
            disabled={saving}
            className="min-w-32 bg-destructive text-white hover:bg-destructive/90"
          >
            {saving && <Loader2 className="animate-spin" />}
            Cancel booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
