import { NextResponse } from "next/server";
import { buildPortfolioData } from "@/lib/portfolio/buildPortfolioData";
import { describeSupabaseAdminConfig, getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const apiKey = req.headers.get("x-moni-api-key")?.trim();
  const expected = process.env.MONI_API_KEY?.trim();
  if (!expected || apiKey !== expected) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const { userId } = await ctx.params;
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: describeSupabaseAdminConfig() }, { status: 503 });
  }

  const data = await buildPortfolioData(admin, userId);
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    user: {
      id: data.profile!.id,
      displayName: data.profile!.displayName,
      username: data.profile!.username,
      bio: data.profile!.bio,
    },
    tier: data.tier,
    badges: data.badges,
    milestones: data.milestones.map((m) => ({
      type: m.type,
      title: m.title,
      achievedAt: m.achievedAt,
    })),
    projects: data.projects,
    stats: {
      posts: data.postCount,
      streak: data.activityStreak,
      activityTotal: data.activityTotal,
    },
  });
}
