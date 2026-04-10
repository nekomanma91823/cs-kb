import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/auth";

type Params = Promise<{ id: string }>;

export async function PUT(req: NextRequest, { params }: { params: Params }) {
  const authError = await requireWriter();
  if (authError) return authError;

  const { id } = await params;
  const { term, definition, aliases = [] } = await req.json();

  if (!term?.trim() || !definition?.trim()) {
    return NextResponse.json({ error: "用語名と定義は必須です" }, { status: 400 });
  }

  try {
    const updated = await prisma.glossaryTerm.update({
      where: { id },
      data: { term: term.trim(), definition: definition.trim(), aliases },
    });
    return NextResponse.json(updated);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "同じ用語が既に存在します" }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  const authError = await requireWriter();
  if (authError) return authError;

  const { id } = await params;
  await prisma.glossaryTerm.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
