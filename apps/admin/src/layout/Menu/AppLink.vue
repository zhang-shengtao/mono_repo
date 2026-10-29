<script setup lang="ts">
  defineOptions({ name: "AppLink" });
  interface Props {
    path: string;
    target: boolean;
  }

  const props = withDefaults(defineProps<Props>(), {
    target: false,
  });

  interface To {
    to?: string;
    href?: string;
    target?: string;
  }

  const to = reactive<To>({
    to: props.path,
  });

  const dom = ref("RouterLink");

  if (props.path.startsWith("http")) {
    dom.value = "a";
    delete to.to;
    to.href = props.path;
    to.target = "_blank";
  } else {
    to.to = props.path;
    delete to.href;
    delete to.target;
    if (props.target) to.target = "_blank";
  }
</script>

<template>
  <component :is="dom" :="to">
    <slot />
  </component>
</template>
