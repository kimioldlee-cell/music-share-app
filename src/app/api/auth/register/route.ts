import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession } from "@/lib/auth-utils";

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { success: false, error: "所有字段均为必填项" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "密码长度必须至少为 6 位" },
        { status: 400 }
      );
    }

    // Check unique email
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "该邮箱已被注册" },
        { status: 400 }
      );
    }

    // Hash password & create user
    const passwordHash = hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: passwordHash,
        name,
      },
    });

    // Automatically log in user after successful registration
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
    console.error("Registration error:", error);
    return NextResponse.json(
      { success: false, error: "注册失败，请稍后再试" },
      { status: 500 }
    );
  }
}
