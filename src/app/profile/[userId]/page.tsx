import { ProfileScreen } from "@/components/profile/ProfileScreen";

type Props = { params: Promise<{ userId: string }> };

export default async function UserProfilePage({ params }: Props) {
  const { userId } = await params;
  return <ProfileScreen userId={userId} />;
}
