import { notFound } from "next/navigation";
import { FriendPreviewDevClient } from "./FriendPreviewDevClient";

/** Local visual QA for the Explore friend preview (disabled in production). */
export default function FriendPreviewDevPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <FriendPreviewDevClient />;
}
