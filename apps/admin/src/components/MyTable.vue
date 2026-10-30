<script lang="ts" setup>
  import type { TableInstance } from "element-plus";
  interface Props {
    columns: [];
  }
  withDefaults(defineProps<Props>(), {});

  const elTableRef = useTemplateRef<TableInstance>("elTableRef");
  defineExpose(
    new Proxy(
      {},
      {
        get(target, key) {
          return elTableRef.value?.[key as keyof TableInstance];
        },
        has(target, key) {
          return key in (elTableRef.value || {});
        },
      },
    ),
  );
</script>

<template>
  <el-table :="$attrs" ref="elTableRef" border>
    <my-table-column v-for="(item, i) in columns" :key="i"></my-table-column>
    <template v-for="(val, key) in $slots" #[key]="scope">
      <component :is="val" :="scope" />
    </template>
  </el-table>
</template>
