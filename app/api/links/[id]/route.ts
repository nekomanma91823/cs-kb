/**
 * DELETE /api/links/[id] - ナレッジリンクの削除
 *
 * リンクの削除は発信元の記事ページから行う（LinkManager コンポーネント）。
 * 削除後は router.refresh() によって記事詳細ページが再フェッチされ、
 * サイドパネルのリンク一覧が自動的に更新される。
 *
 * 関連する記事（entry）は削除しない。リンクのみを削除する。
 * 記事を削除した場合は Prisma スキーマの onDelete: Cascade によって
 * そのエントリに繋がるリンクが自動で削除される（こちらは呼ばれない）。
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriter } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const authError = await requireWriter();
  if (authError) return authError;

  const { id } = await params;

  // 404 チェック: 存在しないリンクを削除しようとした場合（二重送信など）への対応
  const link = await prisma.knowledgeLink.findUnique({ where: { id } });
  if (!link) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.knowledgeLink.delete({ where: { id } });
  // 204 No Content: 削除成功。ボディは不要。
  return new NextResponse(null, { status: 204 });
}
