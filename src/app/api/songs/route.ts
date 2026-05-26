import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, title, artist, cover, genre, language, comment, platform } = body;

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

    const songs = await prisma.song.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      { success: true, data: songs },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Error fetching songs:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch songs" }, { status: 500 });
  }
}
