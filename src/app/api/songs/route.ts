import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Helper to check admin authorization
function isAdmin(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  return token === process.env.ADMIN_PASSWORD;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, title, artist, cover, genre, language, comment, platform, isCreator, isPinned } = body;

    // Check if user is attempting to set creator/pinned flag and verify auth
    const hasAdminFlags = isCreator || isPinned;
    const authorized = isAdmin(request);

    if (hasAdminFlags && !authorized) {
      return NextResponse.json({ success: false, error: "Unauthorized admin actions" }, { status: 403 });
    }

    // Check if there is a logged-in user to associate with
    const user = await getCurrentUser();

    const newSong = await prisma.song.create({
      data: {
        url,
        title,
        artist,
        cover,
        genre: genre || "其他",
        language: language || "其他",
        comment,
        platform,
        isCreator: hasAdminFlags ? !!isCreator : false,
        isPinned: hasAdminFlags ? !!isPinned : false,
        userId: user ? user.id : null, // Store userId if logged in
      },
    });

    return NextResponse.json({ success: true, data: newSong });
  } catch (error) {
    console.error("Error creating song:", error);
    return NextResponse.json({ success: false, error: "Failed to add song" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const genre = searchParams.get("genre");
    const language = searchParams.get("language");

    const where: any = {};
    if (genre && genre !== "全部") where.genre = genre;
    if (language && language !== "全部") where.language = language;

    // Sort: Pinned songs always stay at the top, then ordered by submission time
    const songs = await prisma.song.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [
        { isPinned: "desc" },
        { createdAt: "desc" }
      ],
    });

    // Batch-fetch rating aggregations for all songs in one go
    const songIds = songs.map((s) => s.id);
    const ratingAggs = await prisma.rating.groupBy({
      by: ["songId"],
      where: { songId: { in: songIds } },
      _avg: { value: true },
      _count: { value: true },
    });

    const ratingMap: Record<string, { averageRating: number; ratingCount: number }> = {};
    for (const agg of ratingAggs) {
      ratingMap[agg.songId] = {
        averageRating: agg._avg.value ? Math.round(agg._avg.value * 10) / 10 : 0,
        ratingCount: agg._count.value,
      };
    }

    // Batch-fetch review aggregations
    const reviewAggs = await prisma.review.groupBy({
      by: ["songId"],
      where: { songId: { in: songIds } },
      _count: { recommended: true },
    });
    const recommendCounts = await prisma.review.groupBy({
      by: ["songId"],
      where: { songId: { in: songIds }, recommended: true },
      _count: { songId: true },
    });
    const mainstreamCounts = await prisma.review.groupBy({
      by: ["songId"],
      where: { songId: { in: songIds }, mainstream: true },
      _count: { songId: true },
    });
    const nicheCounts = await prisma.review.groupBy({
      by: ["songId"],
      where: { songId: { in: songIds }, mainstream: false },
      _count: { songId: true },
    });

    const reviewMap: Record<string, { recommendCount: number; mainstreamCount: number; nicheCount: number; totalReviewCount: number }> = {};
    for (const agg of reviewAggs) {
      reviewMap[agg.songId] = {
        recommendCount: 0,
        mainstreamCount: 0,
        nicheCount: 0,
        totalReviewCount: agg._count.recommended,
      };
    }
    for (const r of recommendCounts) {
      if (reviewMap[r.songId]) reviewMap[r.songId].recommendCount = r._count.songId;
    }
    for (const m of mainstreamCounts) {
      if (reviewMap[m.songId]) reviewMap[m.songId].mainstreamCount = m._count.songId;
    }
    for (const n of nicheCounts) {
      if (reviewMap[n.songId]) reviewMap[n.songId].nicheCount = n._count.songId;
    }

    // Fetch current user's reviews for highlight state
    const user = await getCurrentUser();
    let userReviewMap: Record<string, { recommended: boolean; mainstream: boolean }> = {};
    if (user) {
      const userReviews = await prisma.review.findMany({
        where: { userId: user.id, songId: { in: songIds } },
      });
      for (const r of userReviews) {
        userReviewMap[r.songId] = { recommended: r.recommended, mainstream: r.mainstream };
      }
    }

    const enriched = songs.map((song) => ({
      ...song,
      averageRating: ratingMap[song.id]?.averageRating ?? 0,
      ratingCount: ratingMap[song.id]?.ratingCount ?? 0,
      recommendCount: reviewMap[song.id]?.recommendCount ?? 0,
      mainstreamCount: reviewMap[song.id]?.mainstreamCount ?? 0,
      nicheCount: reviewMap[song.id]?.nicheCount ?? 0,
      totalReviewCount: reviewMap[song.id]?.totalReviewCount ?? 0,
      userReview: userReviewMap[song.id] ?? null,
    }));

    return NextResponse.json(
      { success: true, data: enriched },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Error fetching songs:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch songs" }, { status: 500 });
  }
}

// DELETE to remove a song
export async function DELETE(request: Request) {
  try {
    if (!isAdmin(request)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing song ID" }, { status: 400 });
    }

    await prisma.song.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Song deleted successfully" });
  } catch (error) {
    console.error("Error deleting song:", error);
    return NextResponse.json({ success: false, error: "Failed to delete song" }, { status: 500 });
  }
}

// PATCH to toggle pinned status
export async function PATCH(request: Request) {
  try {
    if (!isAdmin(request)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, isPinned, isCreator } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing song ID" }, { status: 400 });
    }

    const updateData: any = {};
    if (typeof isPinned === "boolean") updateData.isPinned = isPinned;
    if (typeof isCreator === "boolean") updateData.isCreator = isCreator;

    const updatedSong = await prisma.song.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updatedSong });
  } catch (error) {
    console.error("Error updating song:", error);
    return NextResponse.json({ success: false, error: "Failed to update song" }, { status: 500 });
  }
}
