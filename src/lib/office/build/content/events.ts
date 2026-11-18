export type DataChip = { id: string; label: string; value: string };
export type Hypothesis = { id: string; text: string; correct: boolean };
export type IntroBeat = {
  actor: string;
  emotion: string;
  line: string;
  action?: string;
};
export type CoachDef = { summary: string; termIds: string[] };

export type EventDef = {
  id: string;
  industry: string | null;
  type: "pinch" | "chance" | "people" | "rival";
  title: string;
  scene: string;
  size: 1 | 2 | 3;
  baseCustomers: number;
  basePrice: number;
  norma: number;
  dataChips: [DataChip, DataChip, DataChip];
  hypotheses: [Hypothesis, Hypothesis, Hypothesis];
  weakTags: string[];
  introBeats: IntroBeat[];
  coach: CoachDef;
};

function beats(lines: [string, string, string?]): IntroBeat[] {
  const [a, b, c] = lines;
  const out: IntroBeat[] = [
    { actor: "newbie", emotion: "worried", line: a, action: "enter" },
    { actor: "veteran", emotion: "worried", line: b },
  ];
  if (c) out.push({ actor: "secretary", emotion: "worried", line: c });
  return out;
}

/** ゴールデンテスト整合：客100・単価500・ノルマ80000 */
export const GOLDEN_EVENT_ID = "evt_lunch_queue";

export const OFFICE_EVENTS: EventDef[] = [
  {
    id: GOLDEN_EVENT_ID,
    industry: null,
    type: "pinch",
    title: "昼ピークの行列",
    scene: "queue",
    size: 2,
    baseCustomers: 100,
    basePrice: 500,
    norma: 80_000,
    dataChips: [
      { id: "d1", label: "待ち時間", value: "平均18分" },
      { id: "d2", label: "離脱率", value: "列の25%が帰る" },
      { id: "d3", label: "学生比率", value: "来客の4割" },
    ],
    hypotheses: [
      { id: "h_queue", text: "待ちが長くて客が逃げている", correct: true },
      { id: "h_taste", text: "味の評価が急に落ちた", correct: false },
      { id: "h_price", text: "値段が高すぎて敬遠されている", correct: false },
    ],
    weakTags: ["queue", "ops", "youth"],
    introBeats: beats([
      "先輩、昼の列がドアの外まで出てます…！",
      "待ってる途中で帰る人もいる。さばき方を変えよう。",
      "現場データを見て、原因の仮説を1つ選んでね。",
    ]),
    coach: {
      summary: "待ちとターゲットを整えると、客数と単価が同時に伸びるよ。",
      termIds: ["customers", "unit_price", "rotation", "target"],
    },
  },
  {
    id: "evt_rainy_day",
    industry: null,
    type: "pinch",
    title: "雨の日の閑散",
    scene: "rainy",
    size: 2,
    baseCustomers: 60,
    basePrice: 550,
    norma: 45_000,
    dataChips: [
      { id: "d1", label: "来客", value: "晴れの半分" },
      { id: "d2", label: "滞在", value: "いつもより長い" },
      { id: "d3", label: "検索", value: "『近く 雨』が増" },
    ],
    hypotheses: [
      { id: "h1", text: "雨対策の訴求が弱い", correct: true },
      { id: "h2", text: "メニューが古くなった", correct: false },
      { id: "h3", text: "店員が足りない", correct: false },
    ],
    weakTags: ["weather", "promo", "scarcity"],
    introBeats: beats([
      "雨だとガラガラです…",
      "来た人は長くいてくれる。呼び込みが課題だね。",
    ]),
    coach: {
      summary: "天候ピンチは『今来る理由』を足すのが効く。",
      termIds: ["customers", "scarcity", "target"],
    },
  },
  {
    id: "evt_sold_out",
    industry: null,
    type: "chance",
    title: "看板メニュー売り切れ",
    scene: "sold_out",
    size: 2,
    baseCustomers: 90,
    basePrice: 480,
    norma: 55_000,
    dataChips: [
      { id: "d1", label: "欠品", value: "Aセットが午後に切れる" },
      { id: "d2", label: "代替", value: "案内がバラバラ" },
      { id: "d3", label: "単価", value: "代替注文は低め" },
    ],
    hypotheses: [
      { id: "h1", text: "代替の提案が弱く単価が落ちている", correct: true },
      { id: "h2", text: "店の場所が分かりにくい", correct: false },
      { id: "h3", text: "ライバルの値段が安い", correct: false },
    ],
    weakTags: ["upsell", "bundle", "service"],
    introBeats: beats([
      "人気のセットがもう無いです！",
      "代わりをうまく出せば、単価を守れる。",
    ]),
    coach: {
      summary: "欠品はピンチだけど、セット提案で単価を守れる。",
      termIds: ["unit_price", "set_sales", "service"],
    },
  },
  {
    id: "evt_sns_fire",
    industry: null,
    type: "people",
    title: "微妙な口コミ拡散",
    scene: "sns_fire",
    size: 2,
    baseCustomers: 110,
    basePrice: 520,
    norma: 70_000,
    dataChips: [
      { id: "d1", label: "投稿", value: "待ち時間の不満が増加" },
      { id: "d2", label: "いいね", value: "料理写真は好調" },
      { id: "d3", label: "再来", value: "初来店のリピート低め" },
    ],
    hypotheses: [
      { id: "h1", text: "体験の最初（待ち）が悪印象になっている", correct: true },
      { id: "h2", text: "味そのものが悪い", correct: false },
      { id: "h3", text: "価格表示が間違っている", correct: false },
    ],
    weakTags: ["sns", "queue", "service"],
    introBeats: beats([
      "SNSで待ちの愚痴が広がってます…",
      "味は好評。入口の体験を直そう。",
    ]),
    coach: {
      summary: "口コミは入口体験から生まれる。待ちと接客が鍵。",
      termIds: ["wom", "service", "rotation"],
    },
  },
  {
    id: "evt_rival_open",
    industry: null,
    type: "rival",
    title: "向かいにお店オープン",
    scene: "rival",
    size: 3,
    baseCustomers: 80,
    basePrice: 500,
    norma: 55_000,
    dataChips: [
      { id: "d1", label: "客流", value: "昼の常連が減" },
      { id: "d2", label: "比較", value: "向こうはセットが強い" },
      { id: "d3", label: "強み", value: "うちは空間の評判○" },
    ],
    hypotheses: [
      { id: "h1", text: "差別化が伝わらず流されている", correct: true },
      { id: "h2", text: "雨のせいだけ", correct: false },
      { id: "h3", text: "レジが壊れている", correct: false },
    ],
    weakTags: ["diff", "bundle", "promo"],
    introBeats: beats([
      "向かいがオープンして、常連が減りました…",
      "同じ土俵で殴り合わず、違いを出そう。",
    ]),
    coach: {
      summary: "ライバル対策は安売りより、選ばれる理由づくり。",
      termIds: ["diff", "set_sales", "target"],
    },
  },
  {
    id: "evt_new_hire",
    industry: null,
    type: "people",
    title: "新人初日のどたばた",
    scene: "new_hire",
    size: 1,
    baseCustomers: 70,
    basePrice: 450,
    norma: 40_000,
    dataChips: [
      { id: "d1", label: "ミス", value: "オーダー遅れが増加" },
      { id: "d2", label: "雰囲気", value: "新人は元気" },
      { id: "d3", label: "ベテラン", value: "フォローで手一杯" },
    ],
    hypotheses: [
      { id: "h1", text: "オペが属人的で新人に渡せていない", correct: true },
      { id: "h2", text: "メニューが多すぎるだけ", correct: false },
      { id: "h3", text: "客が意地悪", correct: false },
    ],
    weakTags: ["ops", "team", "service"],
    introBeats: beats([
      "今日から新人なのに、もう迷子です…",
      "手順を短く共有すれば回る。",
    ]),
    coach: {
      summary: "人が増えても、流れが見えないと客数は落ちる。",
      termIds: ["ops", "rotation", "service"],
    },
  },
  // —— 業種別 ——
  {
    id: "evt_food_lunch",
    industry: "food",
    type: "chance",
    title: "学食並みの昼ラッシュ",
    scene: "queue",
    size: 2,
    baseCustomers: 120,
    basePrice: 480,
    norma: 75_000,
    dataChips: [
      { id: "d1", label: "客層", value: "近隣の学生が多い" },
      { id: "d2", label: "回転", value: "席が空かない" },
      { id: "d3", label: "追加注文", value: "ドリンク率が低い" },
    ],
    hypotheses: [
      { id: "h1", text: "回転と追加提案が弱い", correct: true },
      { id: "h2", text: "看板が暗い", correct: false },
      { id: "h3", text: "値段が安すぎる", correct: false },
    ],
    weakTags: ["queue", "upsell", "youth"],
    introBeats: beats([
      "飲食の昼、席が埋まりっぱなし！",
      "回して、ついで買いも取りにいこう。",
    ]),
    coach: {
      summary: "飲食は回転×ついで買いが売上の型。",
      termIds: ["rotation", "unit_price", "customers"],
    },
  },
  {
    id: "evt_fashion_display",
    industry: "fashion",
    type: "chance",
    title: "ウィンドウの反応が薄い",
    scene: "viral",
    size: 2,
    baseCustomers: 50,
    basePrice: 2200,
    norma: 130_000,
    dataChips: [
      { id: "d1", label: "通行", value: "前は通るが入り薄い" },
      { id: "d2", label: "客単価", value: "入店者は高め" },
      { id: "d3", label: "SNS", value: "コーデ投稿が少ない" },
    ],
    hypotheses: [
      { id: "h1", text: "入店のきっかけ（世界観）が弱い", correct: true },
      { id: "h2", text: "在庫が多すぎる", correct: false },
      { id: "h3", text: "店員が多すぎる", correct: false },
    ],
    weakTags: ["diff", "promo", "sns"],
    introBeats: beats([
      "前は通るのに、入ってくれない…",
      "差別化が見える演出を足そう。",
    ]),
    coach: {
      summary: "ファッションは『入る理由』が客数を決める。",
      termIds: ["diff", "wom", "customers"],
    },
  },
  {
    id: "evt_tech_bug",
    industry: "tech",
    type: "pinch",
    title: "デモ機がフリーズ",
    scene: "equipment",
    size: 2,
    baseCustomers: 40,
    basePrice: 3000,
    norma: 140_000,
    dataChips: [
      { id: "d1", label: "体験", value: "デモ失敗で離脱" },
      { id: "d2", label: "興味", value: "説明会の予約は残ってる" },
      { id: "d3", label: "代替", value: "紙の資料しかない" },
    ],
    hypotheses: [
      { id: "h1", text: "体験の代替導線がない", correct: true },
      { id: "h2", text: "価格が安すぎる", correct: false },
      { id: "h3", text: "ロゴがダサい", correct: false },
    ],
    weakTags: ["ops", "service", "tech"],
    introBeats: beats([
      "デモ機が落ちて、説明が止まりました…",
      "止まっても売れる流れを用意しよう。",
    ]),
    coach: {
      summary: "テックは体験が商品。止まっても案内できる型が要る。",
      termIds: ["ops", "service", "unit_price"],
    },
  },
  {
    id: "evt_event_gate",
    industry: "event",
    type: "pinch",
    title: "入場ゲート渋滞",
    scene: "deadline",
    size: 3,
    baseCustomers: 200,
    basePrice: 800,
    norma: 200_000,
    dataChips: [
      { id: "d1", label: "待ち", value: "ゲート前30分" },
      { id: "d2", label: "物販", value: "開場後のピークが短い" },
      { id: "d3", label: "クレーム", value: "整理の不満" },
    ],
    hypotheses: [
      { id: "h1", text: "入場オペがボトルネック", correct: true },
      { id: "h2", text: "演目がつまらない", correct: false },
      { id: "h3", text: "チケットが高い", correct: false },
    ],
    weakTags: ["queue", "ops", "promo"],
    introBeats: beats([
      "ゲートが詰まって、中の売上が止まります！",
      "入口を直すと、会場全体が回る。",
    ]),
    coach: {
      summary: "イベントは入口の回転が全体売上を決める。",
      termIds: ["rotation", "customers", "ops"],
    },
  },
  {
    id: "evt_shop_complaint",
    industry: "shop",
    type: "people",
    title: "接客クレーム連鎖",
    scene: "complaint",
    size: 2,
    baseCustomers: 75,
    basePrice: 1200,
    norma: 100_000,
    dataChips: [
      { id: "d1", label: "クレーム", value: "説明不足が共通" },
      { id: "d2", label: "リピート", value: "低下中" },
      { id: "d3", label: "商品", value: "評価は普通〜良い" },
    ],
    hypotheses: [
      { id: "h1", text: "説明とフォローの型がない", correct: true },
      { id: "h2", text: "商品が全部不良", correct: false },
      { id: "h3", text: "家賃が高い", correct: false },
    ],
    weakTags: ["service", "repeat", "mood"],
    introBeats: beats([
      "同じ系統のクレームが続いてます…",
      "接客の型を揃えれば守れる。",
    ]),
    coach: {
      summary: "お店系は信頼がリピート＝客数の土台。",
      termIds: ["service", "repeat", "customers"],
    },
  },
  {
    id: "evt_media_algo",
    industry: "media",
    type: "chance",
    title: "投稿が伸びない週",
    scene: "viral",
    size: 2,
    baseCustomers: 30,
    basePrice: 4000,
    norma: 140_000,
    dataChips: [
      { id: "d1", label: "再生", value: "先週比 −40%" },
      { id: "d2", label: "保存", value: "有益系だけ残る" },
      { id: "d3", label: "導線", value: "プロフクリック低い" },
    ],
    hypotheses: [
      { id: "h1", text: "話題性と導線の設計が弱い", correct: true },
      { id: "h2", text: "機材が古いだけ", correct: false },
      { id: "h3", text: "編集者が多すぎる", correct: false },
    ],
    weakTags: ["sns", "promo", "scarcity"],
    introBeats: beats([
      "いつも通り投稿してるのに伸びません…",
      "限定感と次の行動をセットで出そう。",
    ]),
    coach: {
      summary: "発信は『見る理由』と『次の一手』が客数になる。",
      termIds: ["wom", "scarcity", "customers"],
    },
  },
];

export function eventById(id: string): EventDef | undefined {
  return OFFICE_EVENTS.find((e) => e.id === id);
}
