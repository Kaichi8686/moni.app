import { redirect } from "next/navigation";

/** Legacy entry — open Ideas hub AI excavate overlay. */
export default function IdeaInterviewRedirectPage() {
  redirect("/idea?ai=excavate");
}
