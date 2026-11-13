import { redirect } from "next/navigation";

/** The inbox was called "Leads"; old links and bookmarks land on its new name. */
export default function AdminLeadsPage() {
  redirect("/admin/callbacks");
}
