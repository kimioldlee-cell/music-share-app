import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

// Maximum avatar size: ~100KB (base64 encoded)
const MAX_SIZE = 150 * 1024;

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "请先登录" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { avatar } = body;

    if (!avatar || typeof avatar !== "string") {
      return NextResponse.json(
        { success: false, error: "缺少头像数据" },
        { status: 400 }
      );
    }

    // Validate base64 format
    if (!avatar.startsWith("data:image/")) {
      return NextResponse.json(
        { success: false, error: "仅支持图片格式" },
        { status: 400 }
      );
    }

    // Size check
    if (Buffer.byteLength(avatar, "utf8") > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: "头像文件过大，请使用小于 100KB 的图片" },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { avatar },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error uploading avatar:", error);
    return NextResponse.json(
      { success: false, error: "头像上传失败" },
      { status: 500 }
    );
  }
}
