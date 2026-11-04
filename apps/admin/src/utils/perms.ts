import type { AuthMenuNode } from "@repo/shared";

export interface RouteMenuProps {
  menu?: AuthMenuNode;

  buttons?: AuthMenuNode[];
}

export function usePerms() {
  const route = useRoute();

  const props = computed<RouteMenuProps>(() => {
    const value = route.matched.at(-1)?.props;
    if (!value || typeof value !== "object") return {};
    const viewProps = (value as Record<string, unknown>).default;
    return viewProps && typeof viewProps === "object" ? (viewProps as RouteMenuProps) : {};
  });

  const buttons = computed(() => props.value.buttons ?? []);

  function has(code: string) {
    return buttons.value.some((item) => item.permission === code) || props.value.menu?.permission === code;
  }

  function button(code: string) {
    return buttons.value.find((item) => item.permission === code);
  }

  return { props, buttons, has, button };
}
