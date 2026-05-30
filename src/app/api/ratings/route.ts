import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

// POST: submit or update a rating for a song
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "请先登录后再评分" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { songId, value } = body;

    if (!songId || typeof value !== "number") {
      return NextResponse.json(
        { success: false, error: "缺少歌曲ID或评分值" },
        { status: 400 }
      );
    }

    // Clamp and round to nearest 0.5
    const clamped = Math.max(0.5, Math.min(5, value));
    const rounded = Math.round(clamped * 2) / 2;

    // Upsert: one rating per user per song
    const rating = await prisma.rating.upsert({
      where: {
        userId_songId: {
          userId: user.id,
          songId,
        },
      },
      update: { value: rounded },
      create: {
        userId: user.id,
        songId,
        value: rounded,
      },
    });

    // Return aggregated stats for this song
    const aggregation = await prisma.rating.aggregate({
      where: { songId },
      _avg: { value: true },
      _count: { value: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        rating,
        songId,
        averageRating: aggregation._avg.value
          ? Math.round(aggregation._avg.value * 10) / 10
          : rounded,
        ratingCount: aggregation._count.value,
      },
    });
  } catch (error) {
    console.error("Error submitting rating:", error);
    return NextResponse.json(
      { success: false, error: "评分提交失败" },
      { status: 500 }
    );
  }
}

// GET: fetch the current user's rating for a specific song
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const songId = searchParams.get("songId");

    if (!songId) {
      return NextResponse.json(
        { success: false, error: "缺少歌曲ID" },
        { status: 400 }
      );
    }

    const user = await getCurrentUser();
    let userRating = null;

    if (user) {
      userRating = await prisma.rating.findUnique({
        where: {
          userId_songId: {
            userId: user.id,
            songId,
          },
        },
      });
    }

    // Aggregate stats
    const aggregation = await prisma.rating.aggregate({
      where: { songId },
      _avg: { value: true },
      _count: { value: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        songId,
        averageRating: aggregation._avg.value
          ? Math.round(aggregation._avg.value * 10) / 10
          : 0,
        ratingCount: aggregation._count.value,
        userRating: userRating ? userRating.value : null,
      },
    });
  } catch (error) {
    console.error("Error fetching rating:", error);
    return NextResponse.json(
      { success: false, error: "获取评分失败" },
      { status: 500 }
    );
  }
}
