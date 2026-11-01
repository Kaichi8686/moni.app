import { clampNumber, projectCompoundSeries } from "./math";
import type {
  InvestSimAllocation,
  InvestSimInput,
  InvestSimMethodId,
  InvestSimResult,
} from "./types";

function pickRate(methods: InvestSimMethodId[]): number {
  if (methods.includes("low_risk")) return 0.035;
  if (methods.includes("jp_only")) return 0.045;
  if (methods.includes("index_only") || methods.includes("us_or_global")) return 0.06;
  return 0.05;
}

function buildAllocation(methods: InvestSimMethodId[]): InvestSimAllocation[] {
  const noIndividual = methods.includes("no_individual") || methods.includes("index_only");
  const low = methods.includes("low_risk");
  const jp = methods.includes("jp_only");
  const us = methods.includes("us_or_global");
  const nisa = methods.includes("nisa_only");

  if (low) {
    return [
      {
        name: nisa ? "NISA・債券寄りファンド" : "債券・預金寄り",
        percent: 55,
        reason: "値動きを抑えめにするため多めに置く想定です。",
      },
      {
        name: jp ? "国内株式インデックス" : "全世界株式インデックス",
        percent: 35,
        reason: "成長も少し取りにいくための土台です。",
      },
      {
        name: "現金クッション",
        percent: 10,
        reason: "急な出費・買い増しタイミング用の余裕です。",
      },
    ];
  }

  if (jp) {
    return [
      {
        name: "国内株式インデックス",
        percent: noIndividual ? 70 : 55,
        reason: "国内のみの限定に合わせた中核です。",
      },
      {
        name: noIndividual ? "国内債券インデックス" : "国内個別株（学習枠）",
        percent: noIndividual ? 20 : 25,
        reason: noIndividual
          ? "振れ幅を少し抑えるクッションです。"
          : "少額で学びながら触る枠（全体の一部）です。",
      },
      {
        name: "現金クッション",
        percent: noIndividual ? 10 : 20,
        reason: "継続しやすくするための予備資金です。",
      },
    ];
  }

  if (us) {
    return [
      {
        name: "全世界株式インデックス",
        percent: 50,
        reason: "分散の土台にします。",
      },
      {
        name: "米国株式インデックス",
        percent: 35,
        reason: "米国・全世界中心の指定に合わせます。",
      },
      {
        name: "現金クッション",
        percent: 15,
        reason: "積立を止めないための余裕です。",
      },
    ];
  }

  return [
    {
      name: nisa ? "NISA・全世界株式インデックス" : "全世界株式インデックス",
      percent: noIndividual ? 75 : 60,
      reason: "長期・分散の基本形です。",
    },
    {
      name: noIndividual ? "債券インデックス" : "テーマ学習枠（少額）",
      percent: noIndividual ? 15 : 20,
      reason: noIndividual
        ? "振れを少し抑えるための配分です。"
        : "好奇心用。大きくしすぎない前提です。",
    },
    {
      name: "現金クッション",
      percent: 10,
      reason: "生活防衛＋買い増し余力です。",
    },
  ];
}

export function ruleBasedInvestSim(input: InvestSimInput): InvestSimResult {
  const budget = clampNumber(input.budgetYen, 0, 1_000_000_000);
  const monthly = clampNumber(input.monthlyYen, 0, 10_000_000);
  const years = clampNumber(Math.round(input.years), 1, 50);
  const rate = pickRate(input.methods);
  const yearly = projectCompoundSeries({
    principal: budget,
    monthly,
    years,
    annualRate: rate,
  });
  const last = yearly[yearly.length - 1]!;
  const allocation = buildAllocation(input.methods);
  const methodNote =
    input.methods.length > 0
      ? `方法の限定（${input.methods.length}件）を守ったデモ配分です。`
      : "方法の限定が少ないので、標準的な長期分散のデモです。";
  const custom = input.customLimits.trim();

  return {
    title: years <= 5 ? "短期〜中期の堅実シミュレーション" : "長期積立シミュレーション",
    summary:
      `初期 ${Math.round(budget).toLocaleString("ja-JP")}円` +
      (monthly > 0 ? `＋毎月 ${Math.round(monthly).toLocaleString("ja-JP")}円` : "") +
      `を、約${years}年・年率およそ${(rate * 100).toFixed(1)}%想定で複利シミュレーションしました。` +
      methodNote +
      (custom ? ` 追加の限定「${custom}」も前提に含めています。` : ""),
    assumedAnnualReturnPct: Math.round(rate * 1000) / 10,
    allocation,
    yearly,
    finalBalance: last.balance,
    totalContributed: last.contributed,
    estimatedGain: Math.max(0, last.balance - last.contributed),
    assumptions: [
      `年率約${(rate * 100).toFixed(1)}%が毎月複利で続く単純モデル`,
      monthly > 0 ? "毎月同額を月末に積み立てる想定" : "追加積立なし（一括寄り）の想定",
      "税金・手数料・為替はざっくり無視（学習用）",
      input.methods.includes("nisa_only") ? "NISA枠内で運用する前提" : "口座の種類は特定しない前提",
    ],
    risks: [
      "実際の市場は上下し、この通りには増えません",
      "短期間で取り崩すと、想定より少なくなることがあります",
      "生活費を削りすぎると続かないので、無理のない額にすることが大事です",
    ],
    nextSteps: [
      "自分の「使わないお金」の上限を再確認する",
      "指定した方法の限定が、証券口座の商品でどう選べるか調べる",
      "最初の1ヶ月だけ少額で「続けられるか」を試す",
    ],
    disclaimer:
      "学習用のデモシミュレーションです。投資助言・特定商品の推奨ではありません。API未設定時またはAI失敗時の代替結果です。",
  };
}
