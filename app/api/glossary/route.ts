import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/auth";

export async function GET() {
  const terms = await prisma.glossaryTerm.findMany({
    orderBy: { term: "asc" },
  });
  return NextResponse.json(terms);
}

export async function POST(req: NextRequest) {
  const authError = await requireWriter();
  if (authError) return authError;

  const { term, definition, aliases = [] } = await req.json();

  if (!term?.trim() || !definition?.trim()) {
    return NextResponse.json({ error: "用語名と定義は必須です" }, { status: 400 });
  }

  try {
    const created = await prisma.glossaryTerm.create({
      data: { term: term.trim(), definition: definition.trim(), aliases },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "同じ用語が既に存在します" }, { status: 409 });
    }
    throw err;
  }
}
