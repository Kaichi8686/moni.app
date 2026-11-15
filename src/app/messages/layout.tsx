/** メッセージ専用: 画面全体を覆い、背面のホーム等が見えないようにする */
export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    // inset-0 alone fills the layout viewport. Avoid h-[100dvh] here: on iOS Safari
    // dvh can lag after keyboard/chrome changes and leave a short shell that makes
    // nested fixed chrome (tab bar) appear too high.
    <div className="fixed inset-0 z-[45] mx-auto w-full max-w-lg bg-[#fafaf8]">
      {children}
    </div>
  );
}
