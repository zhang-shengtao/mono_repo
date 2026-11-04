<script setup lang="ts">
  import type { RouteMenuProps } from "@/utils/perms";

  defineProps<RouteMenuProps>();

  type MyTableRef = InstanceType<GlobalComponents["MyTable"]>;

  type BaseColumn = InstanceType<GlobalComponents["MyTable"]>["$props"]["columns"][number];

  type TableColumn<Row> = Omit<BaseColumn, "children" | "prop" | "formatter"> & {
    children?: TableColumn<Row>[];
    prop?: string | ((scope: { row: Row; column: any; $index: number }) => unknown);
    formatter?: (scope: { row: Row; column: any; $index: number }) => unknown;
  };

  const total = ref(30);
  const url = "https://fuss10.elemecdn.com/e/5d/4a731a90594a4af544c0c25941171jpeg.jpeg";

  interface Row {
    date: string;
    name: string;
    age: number;
    url: string;
    state: string;
    address: string;
    zip: string;
  }

  const tableData: Row[] = [
    {
      date: "2016-05-03",
      name: "测试的",
      age: 11,
      url,
      state: "10",
      address: "No. 189, Grove St, Los Angeles",
      zip: "CA 90036",
    },
    {
      date: "2016-05-02",
      name: "哈哈哈哈",
      age: 13,
      url,
      address: "No. 189, Grove St, Los Angeles",
      state: "5",
      zip: "CA 90036",
    },
    {
      date: "2016-05-04",
      name: "哈哈哈哈",
      age: 12,
      url,
      address: "No. 189, Grove St, Los Angeles",
      state: "7",
      zip: "CA 90036",
    },
    {
      date: "2016-05-01",
      name: "哈哈哈哈",
      age: 9,
      url,
      address: "No. 189, Grove St, Los Angeles",
      state: "2",
      zip: "CA 90036",
    },
  ];

  const text = ref("");

  const columns: TableColumn<Row>[] = [
    {
      type: "selection",
      width: "120",
      fixed: true,
    },
    {
      label: "时间1",
      prop: "date",
      sortable: true,
      width: "300",
    },
    {
      label: "整体",
      children: [
        {
          label: "姓名",
          prop: "name",
          width: "300",
        },
        {
          label: "地址信息",
          children: [
            {
              label: "年龄",
              prop: (option) => option.row.age,
              width: "300",
              "column-key": "age",

              filters: [
                { text: "11岁", value: "11" },
                { text: "12岁", value: "12" },
                { text: "13岁", value: "13" },
              ],
              "filter-method": (value, row) => String(row.age) === value,
            },
            {
              label: "地址",
              prop: "address",
              width: "300",
            },
            {
              label: "state1111",
              prop: "state",
              width: "300",
            },
            {
              label: "图片",
              prop: "url",
              width: "300",
              slot: "image",
            },
            {
              label: "zpiyayya",
              prop: "zip",
              width: "300",
              header: "input",
            },
          ],
        },
      ],
    },
    {
      label: "编辑",
      fixed: "right",
      slot: "edit",
      width: "100",
    },
  ];

  const MyTabels = useTemplateRef<MyTableRef>("MyTabels");

  function clearSelection() {
    MyTabels.value?.clearSelection();
  }

  function action(rows: Row[]) {
    console.log(rows);
  }

  function handlePagination(page: number) {
    console.log(page);
  }

  onMounted(() => {
    console.log("onMounted");
  });
  onBeforeMount(() => {
    console.log("onBeforeMount");
  });
</script>

<template>
  <el-card class="box-card">
    <el-button @click="clearSelection">左侧的</el-button>
    <my-table ref="MyTabels" :data="tableData" :total="total" :columns="columns" @selection-change="action">
      <template #input="{ column, $index }">
        <el-input v-model="text" placeholder="请输入zip"></el-input>
      </template>

      <template #edit="{ row, column, $index }">
        <el-tag>Tag{{ $index }}</el-tag>
      </template>

      <template #image="{ row, column, $index }">
        <img :src="url" width="50" height="50" alt="" srcset="" />
      </template>
      <template #expand="{ row, column, $index }">
        <div>展开行内容{{ row.state }}</div>
      </template>
      <template #empty>
        <div>空的数据</div>
      </template>
    </my-table>
  </el-card>
</template>

<style lang="scss" scoped></style>
