import { NextResponse } from "next/server";
import { listBooksForUser } from "@/lib/data";

export async function GET() {
  const books = await listBooksForUser();
  return NextResponse.json({ books });
}
