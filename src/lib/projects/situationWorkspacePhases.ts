import { addDays } from "date-fns";
import { formatRoadmapStepNotes } from "@/lib/ai/roadmapStepDisplay";
import type { UserSituation } from "@/lib/projects/userSituation";

type SituationStepDef = {
  timeline: string;
  action: string;
  why: string;
  how: string;
  fallback: string;
};

const STEPS: Record<UserSituation, SituationStepDef[]> = {
  festival: [
    { timeline: "今日", action: "先生に企画のOKをもらう約束を取る", why: "許可がないと何も動けないから", how: "放課後に直接話しかける or メモを渡す", fallback: "メールで送ってもOK" },
    { timeline: "今週中", action: "必要な材料・機材のリストを書き出す", why: "何が足りないか早くわかると安心だから", how: "3人で10分だけ集まって書き出す", fallback: "1人でもメモ帳に書き始めればOK" },
    { timeline: "今週中", action: "予算を3パターンで出す", why: "お金の見通しが立つと次の判断ができるから", how: "安い・普通・理想の3列でざっくり計算", fallback: "1パターンだけでも先に出す" },
    { timeline: "来週までに", action: "役割分担を決める", why: "誰が何をするか決まると動き出せるから", how: "付箋でやることを書いて貼る", fallback: "まずリーダー1人だけ決めてもOK" },
    { timeline: "今月中", action: "本番までの締め切り表を作る", why: "遅れに気づけるから", how: "カレンダーに大きな締め切りだけ書く", fallback: "次の1週間だけでもOK" },
  ],
  study: [
    { timeline: "今日", action: "調べたいテーマを1行で書く", why: "テーマがはっきりすると迷わないから", how: "5分でノートに書き出す", fallback: "3つ候補を書いて1つ選ぶ" },
    { timeline: "今週中", action: "身近な人3人に話を聞く", why: "自分の考えが深まるから", how: "友達・家族に5分ずつ質問する", fallback: "1人だけでもOK" },
    { timeline: "今週中", action: "スライド1枚だけ作る", why: "発表の形が見えてくるから", how: "結論と理由だけ書く", fallback: "紙1枚に手書きでもOK" },
    { timeline: "来週までに", action: "資料の出どころを3つメモする", why: "根拠があると説得力が出るから", how: "本・ニュース・先生の話など", fallback: "1つだけでもOK" },
    { timeline: "今月中", action: "発表の流れを声に出して練習する", why: "本番がスムーズになるから", how: "3分だけ鏡の前で話す", fallback: "友達1人に聞いてもらう" },
  ],
  startup: [
    { timeline: "今日", action: "作りたいものを紙に絵で書く", why: "頭の中が形になるから", how: "スマホメモでも手書きでもOK", fallback: "箇条書き3行だけでもOK" },
    { timeline: "今週中", action: "使ってくれそうな人を3人リストアップする", why: "誰のためかがはっきりするから", how: "友達・先輩・部活の仲間など", fallback: "1人だけでもOK" },
    { timeline: "今週中", action: "1人にLINEで感想を聞く", why: "本当に困っているか確かめられるから", how: "「こういうのあったら使う？」と聞く", fallback: "口頭で聞いてもOK" },
    { timeline: "来週までに", action: "試せる最小版を1つ作る", why: "動くものがあると次が決まるから", how: "紙・スプレッドシート・簡単なページなど", fallback: "画面の絵だけでもOK" },
    { timeline: "今月中", action: "改善点を3つ書き出す", why: "次に何を直すか決まるから", how: "聞いた感想をメモして整理", fallback: "1つだけでもOK" },
  ],
  community: [
    { timeline: "今日", action: "活動の目的を1行で書く", why: "迷ったときに戻れるから", how: "「誰のために何をするか」だけ書く", fallback: "箇条書き3つでもOK" },
    { timeline: "今週中", action: "一緒にやれそうな人を1人探す", why: "一人より続けやすいから", how: "友達・先生・地域の人に声をかける", fallback: "SNSで募集してもOK" },
    { timeline: "今週中", action: "地域のイベントに一度顔を出す", why: "場の空気がわかるから", how: "近所のイベント情報を調べて参加", fallback: "オンラインの情報収集でもOK" },
    { timeline: "来週までに", action: "SNSで活動を1投稿する", why: "仲間や協力者が見つかることがあるから", how: "写真1枚＋短い説明", fallback: "クラスLINEで共有でもOK" },
    { timeline: "今月中", action: "初回の小さな活動日を決める", why: "日が決まると本気になるから", how: "30分だけでもOKな日をカレンダーに入れる", fallback: "候補日を3つ出すだけでもOK" },
  ],
  unclear: [
    { timeline: "今日", action: "やりたいことを3つ書き出す", why: "選択肢が見えると一歩目が決まるから", how: "5分タイマーをかけて書く", fallback: "1つだけ書いてもOK" },
    { timeline: "今週中", action: "その中から1つだけ選ぶ", why: "全部やろうとすると動けないから", how: "「今週一番ワクワクする」を1つ", fallback: "友達に相談して決めてもOK" },
    { timeline: "今週中", action: "15分だけ試してみる", why: "合うかどうか体でわかるから", how: "調べる・作る・人に聞く、どれでも", fallback: "5分だけでもOK" },
    { timeline: "来週までに", action: "続けるかやめるか決める", why: "迷い続けないため", how: "「もう1週間やる／やめる」を決める", fallback: "先生や先輩に相談してもOK" },
    { timeline: "今月中", action: "次の小さな目標を1つ決める", why: "続ける力がつくから", how: "「来週までに〇〇する」と書く", fallback: "口頭で友達に宣言でもOK" },
  ],
};

export function buildSituationWorkspacePhaseRows(projectId: string, situation: UserSituation) {
  const defs = STEPS[situation];
  const base = new Date();
  base.setHours(0, 0, 0, 0);

  return defs.map((def, idx) => {
    const start = addDays(base, idx * 7);
    const end = addDays(start, 6);
    return {
      project_id: projectId,
      title: `${def.timeline}：${def.action}`,
      goal: def.why,
      description: `やること: ${def.action}\n${formatRoadmapStepNotes(def.how, def.fallback)}`,
      status: idx === 0 ? "in_progress" : "planned",
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      color: "purple",
      order: idx,
    };
  });
}
