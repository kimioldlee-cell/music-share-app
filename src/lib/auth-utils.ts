import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

// PBKDF2 Password Hashing
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedValue: string): boolean {
  const [salt, hash] = storedValue.split(":");
  if (!salt || !hash) return false;
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return hash === verifyHash;
}

// Session Management
export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 Days

  const session = await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  // Set HTTP-only secure cookie
  cookies().set("session_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  return session;
}

export async function destroySession() {
  const token = cookies().get("session_token")?.value;
  if (token) {
    try {
      await prisma.session.delete({
        where: { token },
      });
    } catch (e) {
      // Ignored if session doesn't exist in DB
    }
  }
  cookies().delete("session_token");
}

export async function getCurrentUser() {
  const token = cookies().get("session_token")?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          createdAt: true,
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) {
    // Session expired
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    }
    return null;
  }

  return session.user;
}
