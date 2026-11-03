/**
 * 一次性修复脚本：把「角色模板」补齐到「持有该角色的账号」身上。
 *
 * 背景：permissions 是真正的鉴权数据源（jwt 插件按 permissions ⋈ code.bind_menu_id 判权限），
 * role_menus 只是角色模板。历史上 role.update 只删不增，导致角色后来加进去的菜单
 * 不会补给已经持有该角色的账号 —— 典型症状是「角色里明明勾了『分配权限』按钮，
 * 但二级管理员账号调 PUT /admin/user/permission 一直 403」。
 *
 * 只补不改不删：已经有这条菜单的账号跳过（同一菜单只能来自一个角色，主键 user_id + menus_id），
 * 补进来的授权按 role_menus.is_transmit 带过去，created_by / updated_by 记为角色创建人。
 *
 * 用法：pnpm --filter @repo/services db:sync:permissions
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

const databaseUrl = process.env.APP_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("APP_DATABASE_URL is required");
}

const db = drizzle(databaseUrl);

const before = await db.execute<{ count: string }>(sql`select count(*)::text as count from ${sql.identifier("permissions")}`);

const inserted = await db.execute<{ user_id: number; menus_id: number; roles_id: number }>(sql`
  insert into permissions (user_id, menus_id, roles_id, is_transmit, is_disabled, created_by, updated_by)
  select
    holder.user_id,
    rm.menus_id,
    rm.roles_id,
    rm.is_transmit,
    false,
    coalesce(role.created_by, holder.user_id),
    coalesce(role.created_by, holder.user_id)
  from (
    -- 「谁持有哪个角色」没有单独的关联表，permissions.roles_id 就是这份关系
    select distinct roles_id, user_id from permissions
  ) as holder
  join role_menus as rm on rm.roles_id = holder.roles_id
  left join roles as role on role.roles_id = rm.roles_id
  where not exists (
    select 1 from permissions as owned
    where owned.user_id = holder.user_id and owned.menus_id = rm.menus_id
  )
  returning user_id, menus_id, roles_id
`);

const after = await db.execute<{ count: string }>(sql`select count(*)::text as count from ${sql.identifier("permissions")}`);

if (inserted.rows.length > 0) {
  console.table(inserted.rows);
}

console.log(`permissions rows: ${before.rows[0]?.count ?? 0} -> ${after.rows[0]?.count ?? 0}（补齐 ${inserted.rows.length} 条）`);

await db.$client.end();
