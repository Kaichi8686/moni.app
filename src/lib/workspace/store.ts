import { create } from "zustand";

type WorkspaceUiStore = {
  commandOpen: boolean;
  setCommandOpen: (v: boolean) => void;
  createIssueOpen: boolean;
  setCreateIssueOpen: (v: boolean) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (v: boolean) => void;
  selectedIssueId: string | null;
  setSelectedIssueId: (id: string | null) => void;
};

export const useWorkspaceUiStore = create<WorkspaceUiStore>((set) => ({
  commandOpen: false,
  setCommandOpen: (v) => set({ commandOpen: v }),
  createIssueOpen: false,
  setCreateIssueOpen: (v) => set({ createIssueOpen: v }),
  shortcutsOpen: false,
  setShortcutsOpen: (v) => set({ shortcutsOpen: v }),
  selectedIssueId: null,
  setSelectedIssueId: (id) => set({ selectedIssueId: id }),
}));
