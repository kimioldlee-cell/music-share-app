import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({
        success: true,
        authenticated: false,
        user: null,
        favorites: [],
      });
    }

    // Fetch user's favorite song IDs from database
    const dbFavorites = await prisma.favorite.findMany({
      where: { userId: user.id },
      select: { songId: true },
    });

    return NextResponse.json({
      success: true,
      authenticated: true,
      user,
      favorites: dbFavorites.map((f) => f.songId),
    });
  } catch (error) {
    console.error("Get current user error:", error);
    return NextResponse.json(
      { success: false, error: "获取用户信息失败" },
      { status: 500 }
    );
  }
}
