import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession } from "@/lib/auth-utils";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "邮箱和密码不能为空" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !verifyPassword(password, user.password)) {
      return NextResponse.json(
        { success: false, error: "邮箱或密码错误" },
        { status: 401 }
      );
    }

    // Create session and set cookie
    await createSession(user.id);

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: "登录失败，请稍后再试" },
      { status: 500 }
    );
  }
}
