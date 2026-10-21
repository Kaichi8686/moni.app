/** プロジェクト作成時にランダムで当てる初期写真（`public/project-defaults/`） */
export const DEFAULT_PROJECT_PHOTO_PATHS = [
  "/project-defaults/project-default-01.jpg",
  "/project-defaults/project-default-02.jpg",
  "/project-defaults/project-default-03.jpg",
  "/project-defaults/project-default-04.jpg",
  "/project-defaults/project-default-05.jpg",
  "/project-defaults/project-default-06.jpg",
] as const;

/** 作成直後の空っぽ感を避けるため、用意した写真から1枚を選ぶ */
export function pickDefaultProjectPhoto(): string {
  const index = Math.floor(Math.random() * DEFAULT_PROJECT_PHOTO_PATHS.length);
  return DEFAULT_PROJECT_PHOTO_PATHS[index] ?? DEFAULT_PROJECT_PHOTO_PATHS[0];
}
