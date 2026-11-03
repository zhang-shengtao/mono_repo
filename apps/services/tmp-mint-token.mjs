import { createHmac } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { Client } from "pg";
import Redis from "../../node_modules/.pnpm/ioredis@5.11.1/node_modules/ioredis/built/index.js";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).split("#")[0].trim()];
    }),
);

const userId = Number(process.argv[2] ?? 1);
const outFile = process.argv[3] ?? "tmp-token.txt";

const pg = new Client({ connectionString: env.APP_DATABASE_URL });
await pg.connect();
const { rows } = await pg.query("select user_id, parent_id, account, nickname, status from admin_user where user_id = $1", [userId]);
await pg.end();
if (rows.length === 0) throw new Error(`no user ${userId}`);

const user = rows[0];
const profile = { user_id: user.user_id, parent_id: user.parent_id, account: user.account, nickname: user.nickname, status: user.status };

const redis = new Redis(env.REDIS_URL);
const uid = `e2e-${Date.now()}`;
await redis.set(`${env.REDIS_PREFIX}${uid}`, JSON.stringify(profile), "EX", 7200);
await redis.quit();

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const header = b64({ alg: "HS256", typ: "JWT" });
const payload = b64({ uid, iss: "admin-system", iat: now, exp: now + 7200 });
const signature = createHmac("sha256", env.ADMIN_JWT_SECRET).update(`${header}.${payload}`).digest("base64url");

writeFileSync(outFile, `${header}.${payload}.${signature}`);
console.log("session ready for", profile.nickname);
