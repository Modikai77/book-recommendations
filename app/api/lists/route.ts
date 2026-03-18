import { ListVisibility } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createListSchema = z.object({
  name: z.string().min(1),
  visibility: z.enum(["PRIVATE", "SHARED_LINK"]).optional()
});

export async function GET() {
  const lists = await prisma.list.findMany({
    where: {
      userId: process.env.DEMO_USER_ID ?? "demo-user"
    },
    include: { items: true },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ lists });
}

export async function POST(request: Request) {
  const payload = createListSchema.parse(await request.json());

  const list = await prisma.list.create({
    data: {
      userId: process.env.DEMO_USER_ID ?? "demo-user",
      name: payload.name,
      visibility: (payload.visibility ?? "PRIVATE") as ListVisibility
    }
  });

  return NextResponse.json({ listId: list.id }, { status: 201 });
}
