<script setup lang="ts">
/** 图标选择器：从 @element-plus/icons-vue 里挑一个组件名存进 meta.icon */
import { computed, ref } from "vue";
import * as ElementPlusIconsVue from "@element-plus/icons-vue";

const props = defineProps<{ modelValue?: string }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const iconNames = Object.keys(ElementPlusIconsVue);
const keyword = ref("");
const visible = ref(false);

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return iconNames;
  return iconNames.filter((name) => name.toLowerCase().includes(kw));
});

function select(name: string): void {
  emit("update:modelValue", name);
  visible.value = false;
}

function clear(): void {
  emit("update:modelValue", "");
}
</script>

<template>
  <el-popover v-model:visible="visible" placement="bottom-start" :width="364" trigger="click">
    <template #reference>
      <el-input :model-value="props.modelValue" placeholder="点击选择图标（可留空）" readonly>
        <template #prefix>
          <el-icon v-if="props.modelValue"><component :is="props.modelValue" /></el-icon>
        </template>
        <template v-if="props.modelValue" #suffix>
          <el-icon class="muted" style="cursor: pointer" title="清除" @click.stop="clear"><Close /></el-icon>
        </template>
      </el-input>
    </template>

    <el-input v-model="keyword" placeholder="搜索图标，如 User / Key" clearable style="margin-bottom: 8px" />
    <div class="icon-grid">
      <div
        v-for="name in filtered"
        :key="name"
        class="icon-grid__item"
        :class="{ 'is-active': name === props.modelValue }"
        :title="name"
        @click="select(name)"
      >
        <el-icon :size="19"><component :is="name" /></el-icon>
      </div>
    </div>
    <div v-if="filtered.length === 0" class="muted" style="padding: 12px 0; text-align: center">没有匹配的图标</div>
  </el-popover>
</template>
