import { AppBottomNav } from "@/components/AppBottomNav";
import { EditProfileForm } from "@/components/profile/EditProfileForm";

export default function ProfileEditPage() {
  return (
    <div className="min-h-[100dvh] bg-[#fafaf8] pb-bottom-nav">
      <EditProfileForm />
      <AppBottomNav />
    </div>
  );
}
