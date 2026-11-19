/** メッセージ: 他タブと同じドキュメントフローで描画する。
 *  `fixed inset-0` だと iOS Safari が layout viewport を縮めたままにし、
 *  `position:fixed; bottom:0` のタブバーが画面途中に浮いて下に空白ができる。 */
export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col bg-[#ffffff]">
      {children}
    </div>
  );
}
