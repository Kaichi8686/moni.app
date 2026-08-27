/** メッセージ専用: 画面全体を覆い、背面のホーム等が見えないようにする */
export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[45] mx-auto flex w-full max-w-lg flex-col overflow-hidden bg-[#fafaf8]">
      {children}
    </div>
  );
}
