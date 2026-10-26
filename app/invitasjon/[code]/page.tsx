import { redirect } from "next/navigation";

/** Legacy invite paths redirect to the canonical /invite URL. */
export default function InvitasjonRedirectPage() {
  redirect("/invite");
}
