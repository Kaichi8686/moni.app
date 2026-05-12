-- 作成者は必ず project_members に入る + RLS で「オーナー＝事実上のメンバー」に整合
-- 既存DBにもそのまま適用可能

-- 1) projects: 非公開でもオーナー自身は常に閲覧可能
drop policy if exists "projects read public or member" on public.projects;
create policy "projects read public or member" on public.projects for select using (
  visibility = 'public'
  or public.project_is_member(id, auth.uid())
  or owner_id = auth.uid()
);

-- 2) オーナーはメンバー一覧を読める（主に最初の1行挿入前の整合・運用用）
drop policy if exists "members read project members only" on public.project_members;
create policy "members read project members only" on public.project_members for select using (
  public.project_is_member(project_id, auth.uid())
  or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
);

-- 3) 新規: まだ project_members に自分がいなくても、作成者自身が「owner 行」を追加できる
drop policy if exists "members insert self as project owner" on public.project_members;
create policy "members insert self as project owner" on public.project_members for insert with check (
  user_id = auth.uid()
  and role = 'owner'
  and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
);

-- 4) projects 更新・削除: メンバーテーブル不整合時でも owner_id で操作可能
drop policy if exists "projects update owner admin" on public.projects;
create policy "projects update owner admin" on public.projects for update using (
  public.project_has_role(id, auth.uid(), array['owner', 'admin']) or owner_id = auth.uid()
);
drop policy if exists "projects delete owner only" on public.projects;
create policy "projects delete owner only" on public.projects for delete using (
  public.project_has_role(id, auth.uid(), array['owner']) or owner_id = auth.uid()
);

-- 5) 既存データ: projects はあるが owner が project_members にいない行を補正
insert into public.project_members (project_id, user_id, role)
select p.id, p.owner_id, 'owner'
from public.projects p
where not exists (
  select 1
  from public.project_members m
  where m.project_id = p.id
    and m.user_id = p.owner_id
)
on conflict (project_id, user_id) do update set role = 'owner';
