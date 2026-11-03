<script setup lang="ts">
  interface CellScope {
    row: any;
    column: any;
    $index: number;
  }

  defineOptions({ name: "MyTableColumn", inheritAttrs: false });

  defineSlots<Record<string, (scope: Partial<CellScope>) => any>>();

  interface Props {
    children?: any[];
    header?: string;
    slot?: string;
    prop?: string | ((scope: CellScope) => unknown);
    formatter?: (scope: CellScope) => unknown;
  }

  const props = withDefaults(defineProps<Props>(), {
    header: "",
    prop: "",
    slot: "",
  });

  /** 透传给 el-table-column 的 props：$attrs 全量 + prop（只有字符串才传） */
  function tableColumnProp(attrs: Record<string, any>) {
    const obj: Record<string, any> = { ...attrs };
    if (typeof props.prop === "string") obj.prop = props.prop;
    return obj;
  }

  function rowKey(key: string | ((scope: CellScope) => unknown) | undefined, row: any, column: any, $index: number, formatter?: (scope: CellScope) => unknown) {
    if (!key) return "";
    if (typeof formatter === "function") return formatter({ row, column, $index });
    if (typeof key === "function") return key({ row, column, $index });
    const keys = key.split(".");
    let value: any = "";
    keys.forEach((item) => {
      if (item.endsWith("]")) {
        const arr = item.split("[");
        const i = arr[1].split("]")[0];
        value = value ? value[arr[0]][i] : row[arr[0]][i];
      } else {
        value = value ? value[item] : row[item];
      }
    });
    return value;
  }

  const NO_DEFAULT_SLOT_TYPES = ["selection", "index", "expand", "编辑", "操作"];
  function isShowDefaultSlot(slotName: string | undefined, type: unknown) {
    return !(NO_DEFAULT_SLOT_TYPES.includes(String(type ?? "")) && !slotName);
  }
</script>

<template>
  <el-table-column :="tableColumnProp($attrs)">
    <template #default="{ row, column, $index }">
      <template v-if="Array.isArray(children) && children.length">
        <my-table-column v-for="(item, i) in children" :key="i" :="item">
          <template v-for="(_, key) in $slots" #[key]="scope">
            <slot :name="key" :="scope ?? {}" />
          </template>
        </my-table-column>
      </template>
      <template v-else-if="children === undefined && isShowDefaultSlot(slot, $attrs.type || $attrs.label)">
        <slot v-if="!!slot" :name="slot" :="{ row, column, $index }" />
        <template v-else>{{ rowKey(prop, row, column, $index, formatter) }}</template>
      </template>
    </template>

    <template v-if="!!header" #header="scope">
      <slot :name="header" :="scope" />
    </template>
  </el-table-column>
</template>
