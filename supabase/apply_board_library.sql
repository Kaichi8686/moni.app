-- Multiple boards per project already exist (unique on project_id + title).
-- Delete was missing from the original policies, so the library's delete action needs this.

drop policy if exists "boards delete members" on public.project_boards;
create policy "boards delete members" on public.project_boards
  for delete using (public.project_is_member(project_id, auth.uid()));

drop policy if exists "board elements delete members" on public.project_board_elements;
create policy "board elements delete members" on public.project_board_elements
  for delete using (
    exists (
      select 1 from public.project_boards b
      where b.id = board_id and public.project_is_member(b.project_id, auth.uid())
    )
  );
