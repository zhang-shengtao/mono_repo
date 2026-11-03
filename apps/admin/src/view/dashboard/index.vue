<script setup lang="ts">
  import type { RouteMenuProps } from "@/utils/perms";

  // 动态路由会把当前菜单节点与按钮节点作为 props 传进来
  defineProps<RouteMenuProps>();

  /** MyTable 的实例类型（ref 用，clearSelection 等 API 都在上面） */
  type MyTableRef = InstanceType<GlobalComponents["MyTable"]>;

  /** 列的基础类型（MyTable 的 columns prop 的元素类型：EL 的 props + 组件私有键） */
  type BaseColumn = InstanceType<GlobalComponents["MyTable"]>["$props"]["columns"][number];

  /**
   * 只把「组件自己新增的那几个键」带上数据源的行类型；
   * el-table-column 的 props（filters / filter-method / sortable …）原样沿用 EP 的声明，不重写。
   */
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

  /** selection-change 的入参是选中的行 */
  function action(rows: Row[]) {
    console.log(rows);
  }

  /** 预留给分页 */
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
      <!-- 原来的 v-preview 指令在本地仓库里没有注册，先只保留图片本身 -->
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
