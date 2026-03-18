import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";

export async function getRequiredSessionUser() {
  const session = await getCurrentSession();
  const userId = session?.user?.id;

  if (!userId) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true }
  });

  if (!user) {
    return {
      error: NextResponse.json({ error: "User not found" }, { status: 404 })
    };
  }

  await prisma.profile.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id }
  });

  return { user };
}
