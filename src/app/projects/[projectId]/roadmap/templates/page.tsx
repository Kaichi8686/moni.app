import type { Metadata } from "next";
import { TemplateGallery } from "@/app/projects/[projectId]/roadmap/templates/_components/TemplateGallery";

export const metadata: Metadata = {
  title: "テンプレート | moni",
};

type Props = {
  params: Promise<{ projectId: string }>;
};

export default async function TemplateGalleryPage({ params }: Props) {
  const { projectId } = await params;
  return <TemplateGallery projectId={projectId} />;
};
