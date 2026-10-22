/**
 * v-perm 按钮级权限指令。
 *
 * 用法：
 *   <el-button v-perm="'system:user:add'">新增</el-button>
 *   <el-button v-perm="['system:user:put', 'system:user:delete']">更多</el-button>
 *
 * 数组语义是「命中任意一个即可」。权限码来自当前用户菜单树里的按钮节点，
 * 超管（parent_id === 0）直接放行。
 */
import type { Directive } from "vue";
import { useAuthStore } from "@/stores/auth";

function apply(el: HTMLElement, value: string | string[] | undefined): void {
  const codes = (Array.isArray(value) ? value : [value]).filter((code): code is string => Boolean(code));
  if (codes.length === 0) return;

  const auth = useAuthStore();
  if (codes.some((code) => auth.can(code))) return;
  el.remove();
}

export const permissionDirective: Directive<HTMLElement, string | string[]> = {
  mounted(el, binding) {
    apply(el, binding.value);
  },
  updated(el, binding) {
    apply(el, binding.value);
  },
};
