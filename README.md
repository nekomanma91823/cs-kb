# 機械学習用Webサイト

## Cloudflareデプロイ方針

このアプリは Prisma + PostgreSQL を使うため、Edge Runtime 前提の
@cloudflare/next-on-pages ではなく、Node.js Runtime を使える
OpenNext（@opennextjs/cloudflare）でデプロイする。

## Cloudflare設定（推奨）

フルスタック Next.js は Cloudflare Pages ではなく、Cloudflare Workers を使う。

Workers Builds の設定例:

- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm run cf:build`
- Deploy command: `pnpm run cf:deploy`

## ローカル確認コマンド

- `pnpm run cf:build`
- `pnpm run cf:preview`
