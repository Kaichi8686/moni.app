import { OfficeApp } from "@/components/office/OfficeApp";
import { OfficeVisualApp } from "@/components/office/visual/OfficeVisualApp";

/** NEXT_PUBLIC_NEW_OFFICE=1 で見た目モック。旧画面は無改変のまま切替。 */
export default function OfficePage() {
  const useVisual = process.env.NEXT_PUBLIC_NEW_OFFICE === "1";
  return useVisual ? <OfficeVisualApp /> : <OfficeApp />;
}
