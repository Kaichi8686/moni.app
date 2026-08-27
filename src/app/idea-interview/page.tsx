import { redirect } from "next/navigation";

/** Legacy entry — keep bookmarks working by sending users into the Ideas hub excavate tab. */
export default function IdeaInterviewRedirectPage() {
  redirect("/idea");
}
