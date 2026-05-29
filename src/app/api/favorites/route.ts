import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "请先登录账号" },
        { status: 401 }
      );
    }

    const { songId } = await request.json();
    if (!songId) {
      return NextResponse.json(
        { success: false, error: "歌曲 ID 不能为空" },
        { status: 400 }
      );
    }

    // Check if favorite exists
    const existingFavorite = await prisma.favorite.findUnique({
      where: {
        userId_songId: {
          userId: user.id,
          songId,
        },
      },
    });

    let favorited = false;
    if (existingFavorite) {
      // Remove it
      await prisma.favorite.delete({
        where: { id: existingFavorite.id },
      });
      favorited = false;
    } else {
      // Create it
      await prisma.favorite.create({
        data: {
          userId: user.id,
          songId,
        },
      });
      favorited = true;
    }

    // Get updated favorites list
    const updatedFavorites = await prisma.favorite.findMany({
      where: { userId: user.id },
      select: { songId: true },
    });

    return NextResponse.json({
      success: true,
      favorited,
      favorites: updatedFavorites.map((f) => f.songId),
    });
  } catch (error) {
    console.error("Favorite toggle error:", error);
    return NextResponse.json(
      { success: false, error: "操作失败，请稍后再试" },
      { status: 500 }
    );
  }
}
