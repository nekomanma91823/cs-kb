/**
 * Prisma クライアントのシングルトン管理モジュール。
 *
 * Prisma 7 の破壊的変更:
 *   v6 以前は PrismaClient() を引数なしで呼び出せたが、
 *   v7 からは「ドライバーアダプター」を明示的に渡す必要がある。
 *   これにより Prisma がランタイム非依存になり、Edge Runtime でも動作する。
 *   ここでは Node.js 環境なので @prisma/adapter-pg（pg ライブラリ経由）を使う。
 */

import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * PrismaClient インスタンスを生成するファクトリ関数。
 *
 * PrismaPg アダプターに connectionString を直接渡している理由:
 *   Prisma 7 では prisma.config.ts の datasource.url を参照しなくなった。
 *   アダプター層で接続文字列を管理するのが v7 の想定パターン。
 */
function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  return new PrismaClient({ adapter });
}

/**
 * グローバルオブジェクトを通じて開発環境でのシングルトンを実現する。
 *
 * なぜ globalThis を使うか:
 *   Next.js の開発サーバーは Hot Module Replacement (HMR) によりモジュールを
 *   頻繁に再評価する。ファイルスコープの変数は再評価のたびにリセットされるが、
 *   globalThis は HMR をまたいで生き続けるため、DB 接続が際限なく増殖しない。
 *
 * 本番環境 (NODE_ENV === "production") では HMR が発生しないため
 *   globalThis への保存は不要。毎回 createPrismaClient() を呼んでも
 *   モジュールキャッシュにより実質 1 インスタンスになる。
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
