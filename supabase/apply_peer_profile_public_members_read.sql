-- プロフィール画面で「相手が参加している公開プロジェクト」を一覧するため、
-- project_members のうち「公開プロジェクトに属する行」はログインユーザー誰でも SELECT 可にする。
-- （非公開プロジェクトの所属は従来どおりメンバー・オーナーのみ閲覧可能）

drop policy if exists "members read public project roster" on public.project_members;

create policy "members read public project roster" on public.project_members for select using (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and p.visibility = 'public'
  )
);
