<script setup lang="ts">
  import type { TableInstance } from "element-plus";
  import type { TableColumnProps } from "element-plus/es/components/table/src/table-column/defaults";

  type KebabCase<S extends string> = S extends `${infer Char}${infer Rest}` ? `${Char extends Lowercase<Char> ? Char : `-${Lowercase<Char>}`}${KebabCase<Rest>}` : S;

  type KebabProps<T> = { [Key in keyof T as KebabCase<Key & string>]?: T[Key] };

  type OwnedKeys = "prop" | "formatter";

  type AnyRow = Record<PropertyKey, any>;

  interface OwnCellScope<Row = AnyRow> {
    row: Row;
    column: any;
    $index: number;
  }

  interface OwnColumnProps<Row extends AnyRow = AnyRow> {
    children?: TableColumn<Row>[];
    slot?: string;
    header?: string;
    prop?: string | ((scope: OwnCellScope<Row>) => unknown);
    formatter?: (scope: OwnCellScope<Row>) => unknown;
  }

  type TableColumn<Row extends AnyRow = AnyRow> = Omit<TableColumnProps<Row>, OwnedKeys> & KebabProps<Omit<TableColumnProps<Row>, OwnedKeys>> & OwnColumnProps<Row>;

  defineOptions({ name: "MyTable", inheritAttrs: false });
  interface Props {
    columns: TableColumn<any>[];
    total?: number;
  }
  withDefaults(defineProps<Props>(), {
    columns: () => [],
    total: 0,
  });
  const elTableRef = useTemplateRef<TableInstance>("elTableRef");
  defineExpose(
    new Proxy(
      {},
      {
        get(_target, key) {
          return elTableRef.value?.[key as keyof TableInstance];
        },
        has(_target, key) {
          return key in (elTableRef.value || {});
        },
      },
    ) as TableInstance,
  );
</script>

<template>
  <el-table ref="elTableRef" :="$attrs">
    <my-table-column v-for="(item, i) in columns" :key="i" :="item">
      <template v-for="(val, key) in $slots" #[key]="scope">
        <component :is="val" :="scope ?? {}" />
      </template>
    </my-table-column>

    <template v-if="$slots.empty" #empty>
      <slot name="empty" />
    </template>
    <template v-if="$slots.append" #append>
      <slot name="append" />
    </template>
  </el-table>
</template>

<style lang="scss" scoped>
  .footer {
    margin-top: 10px;
    justify-content: space-between;
  }
</style>
