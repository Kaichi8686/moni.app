import type { SlotId } from "@/lib/bunkasai/slots";

export type BunkasaiSignup = {
  id: string;
  slot_id: SlotId;
  member_token: string;
  member_number: number;
  created_at: string;
  updated_at: string;
};
