import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    let platform = "unknown";
    let title = "";
    let artist = "";
    let cover = "";

    if (url.includes("163.com") || url.includes("126.net")) {
      platform = "netease";
      // Extract ID: ...id=12345
      const idMatch = url.match(/id=(\d+)/);
      if (idMatch) {
        const id = idMatch[1];
        const res = await fetch(`http://music.163.com/api/song/detail/?id=${id}&ids=[${id}]`);
        const data = await res.json();
        if (data && data.songs && data.songs.length > 0) {
          const song = data.songs[0];
          title = song.name;
          artist = song.artists.map((a: any) => a.name).join(", ");
          cover = song.album.picUrl;
        }
      }
    } else if (url.includes("apple.com")) {
      platform = "apple";
      // Basic fallback for Apple Music, since API sometimes blocked
      // Try to extract from URL: https://music.apple.com/us/album/song-name/123?i=456
      const urlParts = new URL(url).pathname.split("/");
      // Usually looks like /us/album/album-name/12345
      const possibleName = urlParts[urlParts.length - 2];
      if (possibleName) {
        title = decodeURIComponent(possibleName).replace(/-/g, " ");
        // Capitalize words
        title = title.replace(/\b\w/g, l => l.toUpperCase());
      }
      cover = "https://music.apple.com/assets/meta/apple-music.png"; // Fallback cover
    }

    return NextResponse.json({ success: true, data: { platform, title, artist, cover } });
  } catch (error) {
    console.error("Parse error:", error);
    return NextResponse.json({ success: false, error: "Failed to parse" }, { status: 500 });
  }
}
