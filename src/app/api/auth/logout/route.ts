import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth-utils";

export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { success: false, error: "退出登录失败" },
      { status: 500 }
    );
  }
}
