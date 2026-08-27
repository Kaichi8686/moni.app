/**
 * ビジネス書・フレームワークを参考にした組み込みロードマップ型
 * アプリケーション / サービス / ハードウェア の3系統
 */
import { enrichPhaseGuides, TEMPLATE_USAGE_GUIDES } from "@/lib/projects/builtinRoadmapGuides";
import type { PhaseColor } from "@/lib/roadmap/types";
import type { ProjectTemplateDefinition, TemplateArchetype, TemplateListItem } from "@/lib/projects/templateTypes";

export type { TemplateArchetype };

export type BuiltinRoadmapTemplate = {
  id: string;
  archetype: TemplateArchetype;
  name: string;
  description: string;
  /** 参考にした本・フレームワーク */
  sources: string[];
  /** 向いている人・進め方（initBuiltinGuides で付与） */
  usageGuide?: string;
  definition: ProjectTemplateDefinition;
};

const COLORS: PhaseColor[] = ["purple", "blue", "green", "amber", "red"];

function def(
  id: string,
  phases: ProjectTemplateDefinition["phases"],
): ProjectTemplateDefinition {
  return {
    version: 1,
    builtinTemplateId: id,
    phases: phases.map((p, i) => ({ ...p, color: p.color ?? COLORS[i % COLORS.length] })),
  };
}

/** カタログ本体 */
export const BUILTIN_ROADMAP_TEMPLATES: BuiltinRoadmapTemplate[] = [
  // ─── アプリケーション型 ───
  {
    id: "app-lean-mvp",
    archetype: "application",
    name: "リーン・MVP（検証駆動）",
    description: "仮説→実験→学習のループで無駄なくプロダクトを育てる型",
    sources: ["エリック・リース『リーン・スタートアップ』", "アッシュ・モーリア『ランニング・リーン』"],
    definition: def("app-lean-mvp", [
      { title: "課題仮説の言語化", goal: "誰のどんな課題か1文で言える", durationDays: 7, tasks: [{ title: "顧客セグメントを3つ書き出す" }, { title: "課題仮説を3本立てる" }] },
      { title: "顧客開発インタビュー", goal: "対象10人と深掘りヒアリング", durationDays: 14, tasks: [{ title: "インタビュー台本を作る" }, { title: "5人分実施・メモ整理" }] },
      { title: "ソリューション仮説", goal: "解決策を1枚の仮説キャンバスに", durationDays: 7 },
      { title: "MVP設計", goal: "学習に必要な最小機能だけ定義", durationDays: 10, tasks: [{ title: "Must / Won't を決める" }, { title: "ワイヤー3画面" }] },
      { title: "MVP実装・リリース", goal: "計測できる状態で公開", durationDays: 28 },
      { title: "計測・学習", goal: "行動データと定性FBを統合", durationDays: 14, tasks: [{ title: "北極星指標を1つ決める" }, { title: "週次レビュー" }] },
      { title: "ピボット or スケール判断", goal: "続行・方向転換・中止を決める", durationDays: 7 },
    ]),
  },
  {
    id: "app-mom-test",
    archetype: "application",
    name: "顧客課題の発見（モム・テスト）",
    description: "作る前に本当の課題があるか会話で確かめる型",
    sources: ["ロブ・フィッツパトリック『モム・テスト』"],
    definition: def("app-mom-test", [
      { title: "対象顧客の定義", goal: "最初のセグメントを1つに絞る", durationDays: 5 },
      { title: "ライフスタイル・文脈調査", goal: "課題が起きる場面を観察・聞く", durationDays: 14 },
      { title: "過去行動の深掘り", goal: "既に使っている代替手段を特定", durationDays: 10 },
      { title: "課題の優先順位", goal: "Must-have か Nice-to-have か判定", durationDays: 7 },
      { title: "プロトタイプ仮説", goal: "紙・動画で概念だけ見せる", durationDays: 10 },
      { title: "コミットメントの確認", goal: "予約・前払い・紹介のいずれかを得る", durationDays: 14 },
      { title: "本開発のGo判断", goal: "需要の証拠をチームで共有", durationDays: 5 },
    ]),
  },
  {
    id: "app-chasm",
    archetype: "application",
    name: "チャズム越え（B2B/B2Cプロダクト）",
    description: "アーリーアダプターから主流市場へ渡るための型",
    sources: ["ジェフリー・ムーア『クロス・ザ・チャズム』"],
    definition: def("app-chasm", [
      { title: "ビーチヘッド選定", goal: "最初に支配するニッチを1つ決める", durationDays: 10 },
      { title: "ホールプロダクト定義", goal: "その顧客が買う完結パッケージを設計", durationDays: 14 },
      { title: "参照顧客3社", goal: "事例・推薦が得られる顧客を獲得", durationDays: 28 },
      { title: "ポジショニング・メッセージ", goal: "競合ではなく代替との比較軸を固定", durationDays: 10 },
      { title: "チャネル・パートナー", goal: "スケールの配布経路を試す", durationDays: 21 },
      { title: "主流市場への拡張", goal: "隣接セグメントへ複製", durationDays: 30 },
    ]),
  },
  {
    id: "app-pmf",
    archetype: "application",
    name: "PMF探索（プロダクトマーケットフィット）",
    description: "継続利用と推奨が自然に起きる状態を目指す型",
    sources: ["ショーン・エリス", "マーク・アンドリーセン PMF概念"],
    definition: def("app-pmf", [
      { title: "コアバリュー定義", goal: "使い続ける理由を1文に", durationDays: 7 },
      { title: "オンボーディング設計", goal: "初回体験で価値に到達", durationDays: 14 },
      { title: "リテンション計測", goal: "D1/D7/D30を可視化", durationDays: 14 },
      { title: "スーパーユーザー分析", goal: "熱狂ユーザー5人の共通点", durationDays: 10 },
      { title: "PMFサーベイ", goal: "「なくなったら困る」40%超を目標", durationDays: 14 },
      { title: "成長実験", goal: "紹介・口コミの仕掛けを1つ試す", durationDays: 21 },
    ]),
  },
  {
    id: "app-blue-ocean",
    archetype: "application",
    name: "ブルーオーシャン（差別化アプリ）",
    description: "競争軸を再定義して未開拓の価値を作る型",
    sources: ["W・チャン・キム『ブルーオーシャン戦略』"],
    definition: def("app-blue-ocean", [
      { title: "戦略キャンバス", goal: "業界の競争要因を可視化", durationDays: 10 },
      { title: "四項行動分析", goal: "削る・減らす・増やす・創るを決める", durationDays: 7 },
      { title: "非顧客の探索", goal: "今使っていない層の障壁を特定", durationDays: 14 },
      { title: "エラースト・テスト", goal: "新価値曲線をプロトで検証", durationDays: 14 },
      { title: "MVPと価格実験", goal: "新しい比較軸で購買を試す", durationDays: 21 },
      { title: "スケール設計", goal: "参入障壁（ネットワーク等）を考える", durationDays: 14 },
    ]),
  },
  {
    id: "app-b2b-saas",
    archetype: "application",
    name: "B2B SaaS立ち上げ",
    description: "企業向けサブスクの発見から契約までの型",
    sources: ["アーロン・ロス『予測可能な収益』", "SaaS指標一般"],
    definition: def("app-b2b-saas", [
      { title: "ICP定義", goal: "理想顧客プロファイルを文書化", durationDays: 7 },
      { title: "課題・予算・決裁", goal: "BANT相当をヒアリング設計", durationDays: 14 },
      { title: "PoC提案", goal: "有償パイロット1件の契約", durationDays: 21 },
      { title: "MVP・セキュリティ最低限", goal: "企業が試せる環境", durationDays: 35 },
      { title: "オンボーディング・CS", goal: "導入成功指標を顧客と合意", durationDays: 21 },
      { title: "ARR拡張", goal: "アップセル・紹介の仕組み", durationDays: 30 },
    ]),
  },
  {
    id: "app-mobile-launch",
    archetype: "application",
    name: "モバイルアプリ・ストア公開",
    description: "iOS/Androidストア向けのリリース準備型",
    sources: ["ストアガイドライン", "グロースハック実践"],
    definition: def("app-mobile-launch", [
      { title: "ストア戦略", goal: "カテゴリ・キーワード方針", durationDays: 7 },
      { title: "UI/UX完成", goal: "主要フローとアクセシビリティ", durationDays: 21 },
      { title: "テストフライト・β", goal: "20人以上の外部テスト", durationDays: 14 },
      { title: "ASO素材", goal: "スクショ・説明文・動画", durationDays: 10 },
      { title: "審査・公開", goal: "ストア申請とリリース", durationDays: 14 },
      { title: "計測・改善", goal: "クラッシュ率・レビュー対応", durationDays: 21 },
    ]),
  },
  {
    id: "app-edtech",
    archetype: "application",
    name: "学習・教育アプリ",
    description: "学習効果と継続率を軸にしたEdTech型",
    sources: ["ブルームのタクソノミー", "ゲーミフィケーション設計"],
    definition: def("app-edtech", [
      { title: "学習目標・カリキュラム", goal: "到達目標と単元構成", durationDays: 14 },
      { title: "ペダゴジー設計", goal: "説明→練習→評価のループ", durationDays: 14 },
      { title: "プロトタイプ授業", goal: "対象10人で1モジュール試験", durationDays: 14 },
      { title: "アプリ実装", goal: "進捗・フィードバック機能", durationDays: 35 },
      { title: "学習データ分析", goal: "脱落ポイントを特定", durationDays: 14 },
      { title: "正式提供・改善", goal: "継続率目標を設定", durationDays: 21 },
    ]),
  },

  // ─── サービス型 ───
  {
    id: "svc-bmc",
    archetype: "service",
    name: "ビジネスモデル・キャンバス",
    description: "9ブロックで事業の全体像を描いて検証する型",
    sources: ["アレックス・オスターワルダー『ビジネスモデル・ジェネレーション』"],
    definition: def("svc-bmc", [
      { title: "顧客セグメント・価値提案", goal: "キャンバス中央2ブロック", durationDays: 10 },
      { title: "チャネル・関係", goal: "届け方と関係性を設計", durationDays: 7 },
      { title: "収益・コスト構造", goal: "単位経済性の仮説", durationDays: 10 },
      { title: "主要活動・リソース・パートナー", goal: "実行体制を具体化", durationDays: 10 },
      { title: "実験計画", goal: "各ブロックのリスク順に検証", durationDays: 21 },
      { title: "ピボット・スケール", goal: "キャンバスを更新して次期計画", durationDays: 14 },
    ]),
  },
  {
    id: "svc-vpc",
    archetype: "service",
    name: "バリュープロポジション設計",
    description: "顧客のジョブと提供価値のフィットを探る型",
    sources: ["アレックス・オスターワルダー『バリュー・プロポジション・デザイン』"],
    definition: def("svc-vpc", [
      { title: "カスタマープロフィール", goal: "ジョブ・痛み・利得を整理", durationDays: 10 },
      { title: "バリューマップ", goal: "利得創造・痛み軽減を列挙", durationDays: 7 },
      { title: "フィット仮説", goal: "どの組み合わせが最強か", durationDays: 7 },
      { title: "コンセプトテスト", goal: "5人にストーリーで見せる", durationDays: 14 },
      { title: "オファー設計", goal: "価格・パッケージ・保証", durationDays: 10 },
      { title: "提供開始・改善", goal: "NPSまたは再購買で検証", durationDays: 21 },
    ]),
  },
  {
    id: "svc-blueprint",
    archetype: "service",
    name: "サービスブループリント",
    description: "見えない裏側まで含めたサービス設計の型",
    sources: ["サービス・マーケティング", "サービスデザイン"],
    definition: def("svc-blueprint", [
      { title: "顧客ジャーニー", goal: "接点前後の感情・行動", durationDays: 10 },
      { title: "フロントステージ", goal: "顧客が見る体験を設計", durationDays: 10 },
      { title: "バックステージ", goal: "内部オペレーションを定義", durationDays: 14 },
      { title: "サポートプロセス", goal: "システム・人・ルール", durationDays: 10 },
      { title: "パイロット提供", goal: "小規模で1サイクル完走", durationDays: 14 },
      { title: "品質・標準化", goal: "マニュアルとKPI", durationDays: 21 },
    ]),
  },
  {
    id: "svc-lean-service",
    archetype: "service",
    name: "リーン・サービス改善",
    description: "無駄を減らしながらサービス品質を上げる型",
    sources: ["リーン・シックスシグマ（サービス応用）", "『リーン・スタートアップ』"],
    definition: def("svc-lean-service", [
      { title: "価値の流れマップ", goal: "顧客が待つ・無駄な手戻りを可視化", durationDays: 10 },
      { title: "ボトルネック特定", goal: "改善優先1箇所", durationDays: 7 },
      { title: "小さな実験", goal: "1週間で試せる改善", durationDays: 14 },
      { title: "標準作業", goal: "再現可能な手順書", durationDays: 14 },
      { title: "スケール", goal: "需要増にも耐える体制", durationDays: 21 },
    ]),
  },
  {
    id: "svc-community",
    archetype: "service",
    name: "コミュニティ・サブスク",
    description: "継続課金とコミュニティ運営の型",
    sources: ["1000 True Fans", "サブスクリプション経済"],
    definition: def("svc-community", [
      { title: "コアメンバー設計", goal: "誰のための場か明確化", durationDays: 10 },
      { title: "価値のリズム", goal: "週次・月次の提供内容", durationDays: 10 },
      { title: "オンボーディング", goal: "初月離脱を防ぐ導線", durationDays: 14 },
      { title: "βコミュニティ", goal: "30人で運営テスト", durationDays: 21 },
      { title: "正式ローンチ", goal: "料金プラン公開", durationDays: 14 },
      { title: "エンゲージメント", goal: "UGC・イベント・紹介", durationDays: 30 },
    ]),
  },
  {
    id: "svc-local-experience",
    archetype: "service",
    name: "ローカル体験・店舗型",
    description: "対面・地域密着の体験ビジネス向け型",
    sources: ["『店舗集客の教科書』系", "体験経済"],
    definition: def("svc-local-experience", [
      { title: "コンセプト・立地", goal: "誰に何をどこで", durationDays: 10 },
      { title: "試作・ソフトオープン", goal: "限定公開でフィードバック", durationDays: 21 },
      { title: "オペレーション", goal: "スタッフ・在庫・予約", durationDays: 14 },
      { title: "集客・口コミ", goal: "地元SNS・紹介施策", durationDays: 21 },
      { title: "リピート設計", goal: "会員・スタンプ・次回来店", durationDays: 14 },
      { title: "収支安定", goal: "損益分岐・繁忙期対策", durationDays: 21 },
    ]),
  },
  {
    id: "svc-consulting",
    archetype: "service",
    name: "B2Bコンサル・受託",
    description: "提案から納品・継続契約までの型",
    sources: ["コンサルティング手法一般", "SPINセリング"],
    definition: def("svc-consulting", [
      { title: "ニッチ・権威づけ", goal: "専門領域と実績ストーリー", durationDays: 14 },
      { title: "リード獲得", goal: "紹介・コンテンツ・営業1件", durationDays: 21 },
      { title: "課題診断", goal: "無料診断 or ヒアリング", durationDays: 10 },
      { title: "提案・見積", goal: "成果物・期間・価格明確化", durationDays: 10 },
      { title: "初回プロジェクト", goal: "期待値通りの納品", durationDays: 35 },
      { title: "継続・拡張", goal: "リテイナー or アップセル", durationDays: 21 },
    ]),
  },
  {
    id: "svc-event",
    archetype: "service",
    name: "イベント・ワークショップ",
    description: "単発・定期イベントの企画運営型",
    sources: ["イベントプロデュース実務", "エンゲージメント設計"],
    definition: def("svc-event", [
      { title: "目的・KPI", goal: "開催の成功指標", durationDays: 5 },
      { title: "企画・プログラム", goal: "タイムテーブル確定", durationDays: 14 },
      { title: "会場・協賛・予算", goal: "収支シミュレーション", durationDays: 14 },
      { title: "集客", goal: "目標人数の50%申込", durationDays: 21 },
      { title: "リハーサル", goal: "当日トラブル想定", durationDays: 7 },
      { title: "開催・振り返り", goal: "アンケートと次回改善", durationDays: 5 },
    ]),
  },

  // ─── ハードウェア型 ───
  {
    id: "hw-prototype-to-production",
    archetype: "hardware",
    name: "試作から量産（ものづくり）",
    description: "PoC→試作→量産準備の標準フェーズ型",
    sources: ["スコット・ミラー『ハードウェア・スタートアップ』", "Dragon Innovation"],
    definition: def("hw-prototype-to-production", [
      { title: "要件・スペック", goal: "性能・コスト・サイズの上限", durationDays: 10 },
      { title: "Proof of Concept", goal: "核心技術だけ動く", durationDays: 21 },
      { title: "α試作", goal: "見た目込み1台", durationDays: 28 },
      { title: "β試作・ユーザテスト", goal: "10人に使わせる", durationDays: 21 },
      { title: "DFM・部品選定", goal: "量産可能なBOM", durationDays: 28 },
      { title: "量産試作（Pilot）", goal: "小ロット製造", durationDays: 35 },
      { title: "認証・出荷", goal: "法規・物流の準備", durationDays: 21 },
    ]),
  },
  {
    id: "hw-crowdfunding",
    archetype: "hardware",
    name: "クラウドファンディング",
    description: "Kickstarter等で資金と需要を確かめる型",
    sources: ["クラウドファンディング実務", "コミュニティ先行"],
    definition: def("hw-crowdfunding", [
      { title: "ストーリー・ペルソナ", goal: "なぜ今・誰のため", durationDays: 10 },
      { title: "プロトタイプ・デモ動画", goal: "信頼できる見せ方", durationDays: 28 },
      { title: "リワード設計", goal: "価格帯・限定数", durationDays: 10 },
      { title: "プレローンチ", goal: "メールリスト500以上", durationDays: 21 },
      { title: "キャンペーン", goal: "目標金額達成", durationDays: 35 },
      { title: "生産・履行", goal: "遅延リスク管理", durationDays: 90 },
    ]),
  },
  {
    id: "hw-iot",
    archetype: "hardware",
    name: "IoT・接続デバイス",
    description: "デバイス＋ファームウェア＋クラウドの型",
    sources: ["IoTアーキテクチャ", "エッジ・クラウド連携"],
    definition: def("hw-iot", [
      { title: "ユースケース・データ", goal: "何を計測し誰が見るか", durationDays: 10 },
      { title: "ハード選定", goal: "センサー・MCU・通信方式", durationDays: 14 },
      { title: "ファームウェアPoC", goal: "データがクラウドに届く", durationDays: 21 },
      { title: "アプリ・ダッシュボード", goal: "ユーザーが価値を感じるUI", durationDays: 28 },
      { title: "セキュリティ・OTA", goal: "更新と認証の最低限", durationDays: 21 },
      { title: "フィールドテスト", goal: "実環境2週間", durationDays: 14 },
      { title: "量産・運用", goal: "監視・アラート", durationDays: 35 },
    ]),
  },
  {
    id: "hw-maker-education",
    archetype: "hardware",
    name: "教育・メイカーキット",
    description: "学習用キット・STEAM教材の型",
    sources: ["メーカー教育", "コンストラクティビズム"],
    definition: def("hw-maker-education", [
      { title: "学習目標・年齢", goal: "作って学ぶゴール", durationDays: 10 },
      { title: "キット設計", goal: "部品点数・難易度", durationDays: 21 },
      { title: "組み立てテスト", goal: "対象10人で試作", durationDays: 14 },
      { title: "教材・カリキュラム", goal: "手順書・動画", durationDays: 21 },
      { title: "安全・法規", goal: "小物・電池等の確認", durationDays: 14 },
      { title: "販売・学校導入", goal: "パイロット校1校", durationDays: 28 },
    ]),
  },
  {
    id: "hw-wearable",
    archetype: "hardware",
    name: "ウェアラブル",
    description: "身につけるデバイスの開発型",
    sources: ["ヒューマンセンタリック設計", "バッテリー・装着性"],
    definition: def("hw-wearable", [
      { title: "装着シナリオ", goal: "いつ・どこで・何時間", durationDays: 10 },
      { title: "エルゴノミクス試作", goal: "複数フォームファクター", durationDays: 21 },
      { title: "センサー精度", goal: "必要精度の検証", durationDays: 21 },
      { title: "バッテリー・発熱", goal: "1日利用の実測", durationDays: 14 },
      { title: "アプリ連携", goal: "データ同期・通知", durationDays: 21 },
      { title: "ベータ・認証", goal: "20人試用・法規", durationDays: 28 },
    ]),
  },
  {
    id: "hw-sustainable",
    archetype: "hardware",
    name: "サステナブル・製品",
    description: "環境配慮とライフサイクルを組み込んだ型",
    sources: ["サーキュラーエコノミー", "LCA概論"],
    definition: def("hw-sustainable", [
      { title: "ライフサイクル定義", goal: "原材料から廃棄まで", durationDays: 10 },
      { title: "素材・サプライ", goal: "再生材・調達リスク", durationDays: 14 },
      { title: "耐久・修理設計", goal: "分解・交換部品", durationDays: 21 },
      { title: "プロトタイプ", goal: "性能と環境の両立", durationDays: 28 },
      { title: "LCA簡易評価", goal: "改善ポイント1つ", durationDays: 14 },
      { title: "マーケ・ストーリー", goal: "価値の伝え方", durationDays: 14 },
    ]),
  },
  {
    id: "hw-retail-product",
    archetype: "hardware",
    name: "量販・小売向け製品",
    description: "店頭・ECで売る物理プロダクトの型",
    sources: ["『PL・ブランディング』", "小売バイヤー対応"],
    definition: def("hw-retail-product", [
      { title: "市場・価格帯", goal: "競合棚・想定価格", durationDays: 10 },
      { title: "デザイン・パッケージ", goal: "棚で目立つ要素", durationDays: 21 },
      { title: "コスト・粗利", goal: "量産時40%粗利目安", durationDays: 14 },
      { title: "試売・POP", goal: "小規模店舗でテスト", durationDays: 21 },
      { title: "バイヤー・流通", goal: "卸・ECチャネル", durationDays: 28 },
      { title: "量産・在庫", goal: "MOQ・キャッシュフロー", durationDays: 35 },
    ]),
  },
  {
    id: "hw-robotics",
    archetype: "hardware",
    name: "ロボティクス・メカトロ",
    description: "動く機構を含むプロダクト開発型",
    sources: ["メカトロニクス設計", "制御工学入門"],
    definition: def("hw-robotics", [
      { title: "動作要件", goal: "速度・荷重・精度", durationDays: 10 },
      { title: "メカ・駆動試作", goal: "核心機構1つ", durationDays: 28 },
      { title: "制御・ソフト", goal: "センサー閉ループ", durationDays: 28 },
      { title: "安全・フェイルセーフ", goal: "異常時の挙動", durationDays: 14 },
      { title: "統合プロト", goal: "全体動作デモ", durationDays: 21 },
      { title: "現場テスト", goal: "実使用環境", durationDays: 21 },
    ]),
  },
];

for (const t of BUILTIN_ROADMAP_TEMPLATES) {
  t.usageGuide = TEMPLATE_USAGE_GUIDES[t.id] ?? t.description;
  enrichPhaseGuides(t.id, t.definition.phases);
}

const byId = new Map(BUILTIN_ROADMAP_TEMPLATES.map((t) => [t.id, t]));

export const ARCHETYPE_LABELS: Record<TemplateArchetype, { label: string; emoji: string; blurb: string }> = {
  application: {
    label: "アプリケーション型",
    emoji: "📱",
    blurb: "ソフトウェア・SaaS・モバイルアプリ（リーン・PMF・チャズム等）",
  },
  service: {
    label: "サービス型",
    emoji: "🤝",
    blurb: "対人・体験・コミュニティ・B2Bサービス（BMC・VPC等）",
  },
  hardware: {
    label: "ハードウェア型",
    emoji: "🔧",
    blurb: "ものづくり・IoT・量産（試作・CF・DFM等）",
  },
};

export function getBuiltinRoadmapTemplate(id: string): BuiltinRoadmapTemplate | undefined {
  return byId.get(id);
}

export function getBuiltinDefinitionByTemplateId(templateId: string): ProjectTemplateDefinition | null {
  const raw = templateId.startsWith("builtin:") ? templateId.slice("builtin:".length) : templateId;
  const t = byId.get(raw);
  return t?.definition ?? null;
}

export function listBuiltinRoadmapTemplateItems(): TemplateListItem[] {
  return BUILTIN_ROADMAP_TEMPLATES.map((t) => ({
    id: `builtin:${t.id}`,
    name: `${ARCHETYPE_LABELS[t.archetype].emoji} ${t.name}`,
    description: t.description,
    kind: "phases" as const,
    phaseCount: t.definition.phases.length,
    isBuiltin: true,
    archetype: t.archetype,
    sources: t.sources,
    usageGuide: t.usageGuide,
  }));
}

export function getBuiltinTemplateMeta(templateId: string): BuiltinRoadmapTemplate | undefined {
  const raw = templateId.startsWith("builtin:") ? templateId.slice("builtin:".length) : templateId;
  return byId.get(raw);
}

export function listBuiltinByArchetype(): Record<TemplateArchetype, TemplateListItem[]> {
  const out: Record<TemplateArchetype, TemplateListItem[]> = {
    application: [],
    service: [],
    hardware: [],
  };
  for (const item of listBuiltinRoadmapTemplateItems()) {
    const arch = item.archetype ?? "application";
    out[arch].push(item);
  }
  return out;
}
