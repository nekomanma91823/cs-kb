/**
 * 記事を直接 pg 経由で保存するスクリプト（認証バイパス用）
 * 使用法: node scripts/save-entry.mjs <title> <tags(comma-separated)> <content-file>
 */
import crypto from "crypto";
import { readFileSync } from "fs";
import pg from "pg";
import { config } from "dotenv";

config(); // .env を読み込む

const { Client } = pg;

const title = process.argv[2];
const tagsArg = process.argv[3];
const contentFile = process.argv[4];

if (!title || !tagsArg || !contentFile) {
  console.error("Usage: node scripts/save-entry.mjs <title> <tags(comma-separated)> <content-file>");
  process.exit(1);
}

const content = readFileSync(contentFile, "utf-8");
const tags = tagsArg.split(",").map(t => t.trim());
const contentHash = crypto.createHash("sha256").update(content).digest("hex");

// cuid 相当の ID 生成（簡易版）
function generateCuid() {
  const timestamp = Date.now().toString(36);
  const randomPart = crypto.randomBytes(8).toString("base64url");
  return `c${timestamp}${randomPart}`.slice(0, 25);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

try {
  await client.connect();
  const id = generateCuid();
  const now = new Date().toISOString();
  const result = await client.query(
    `INSERT INTO knowledge_entries (id, title, content, "contentHash", tags, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, title`,
    [id, title, content, contentHash, tags, now, now]
  );
  console.log(JSON.stringify(result.rows[0]));
} catch (err) {
  console.error(err.message);
  process.exit(1);
} finally {
  await client.end();
}
