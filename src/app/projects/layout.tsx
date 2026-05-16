import type { ReactNode } from "react";
import { ProjectsShell } from "@/components/projects/ProjectsShell";

export default function ProjectsLayout({ children }: { children: ReactNode }) {
  return <ProjectsShell>{children}</ProjectsShell>;
}
