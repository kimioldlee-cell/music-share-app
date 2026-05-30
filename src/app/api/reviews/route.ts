import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

// POST: submit or update a review (recommended + mainstream)
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "请先登录后再评价" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { songId, recommended, mainstream } = body;

    if (!songId) {
      return NextResponse.json(
        { success: false, error: "缺少歌曲ID" },
        { status: 400 }
      );
    }

    // Upsert: one review per user per song
    const review = await prisma.review.upsert({
      where: {
        userId_songId: {
          userId: user.id,
          songId,
        },
      },
      update: {
        ...(typeof recommended === "boolean" && { recommended }),
        ...(typeof mainstream === "boolean" && { mainstream }),
      },
      create: {
        userId: user.id,
        songId,
        recommended: typeof recommended === "boolean" ? recommended : true,
        mainstream: typeof mainstream === "boolean" ? mainstream : true,
      },
    });

    // Return aggregated stats
    const agg = await prisma.review.aggregate({
      where: { songId },
      _count: { recommended: true },
    });

    const recommendCount = await prisma.review.count({
      where: { songId, recommended: true },
    });
    const mainstreamCount = await prisma.review.count({
      where: { songId, mainstream: true },
    });
    const nicheCount = await prisma.review.count({
      where: { songId, mainstream: false },
    });

    return NextResponse.json({
      success: true,
      data: {
        review,
        songId,
        recommendCount,
        mainstreamCount,
        nicheCount,
        totalReviewCount: agg._count.recommended,
      },
    });
  } catch (error) {
    console.error("Error submitting review:", error);
    return NextResponse.json(
      { success: false, error: "评价提交失败" },
      { status: 500 }
    );
  }
}

// GET: fetch current user's review + aggregates for a song
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
    let userReview = null;

    if (user) {
      userReview = await prisma.review.findUnique({
        where: {
          userId_songId: {
            userId: user.id,
            songId,
          },
        },
      });
    }

    const recommendCount = await prisma.review.count({
      where: { songId, recommended: true },
    });
    const mainstreamCount = await prisma.review.count({
      where: { songId, mainstream: true },
    });
    const nicheCount = await prisma.review.count({
      where: { songId, mainstream: false },
    });
    const totalCount = await prisma.review.count({
      where: { songId },
    });

    return NextResponse.json({
      success: true,
      data: {
        songId,
        recommendCount,
        mainstreamCount,
        nicheCount,
        totalReviewCount: totalCount,
        userReview: userReview
          ? {
              recommended: userReview.recommended,
              mainstream: userReview.mainstream,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Error fetching review:", error);
    return NextResponse.json(
      { success: false, error: "获取评价失败" },
      { status: 500 }
    );
  }
}
