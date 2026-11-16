/**
 * Close a full-screen workspace panel (settings / members / invite / calendar / activity).
 * Uses replace so browser-back after leaving the site does not reopen the same panel.
 */
export function closeWorkspacePanel(
  router: { replace: (href: string) => void },
  projectId: string,
): void {
  router.replace(`/projects/${projectId}/overview`);
}
