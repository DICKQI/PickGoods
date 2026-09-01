<template>
  <div class="convert-goods-form-root">
    <div class="convert-goods-form-scroll">
      <div class="convert-tip">
        <el-icon class="convert-tip-icon"><InfoFilled /></el-icon>
        <span>金额会自动带入（定金 + 尾款），购入日期就是补款日~ 默认先存成草稿，之后还能补图片哦</span>
      </div>
      <el-form :ref="setFormRef" :model="convertForm" :rules="convertRules" label-position="top" class="preorder-editor-form">
      <section class="preorder-editor-section">
        <div class="preorder-editor-section-title">
          <h4>谷子信息</h4>
          <p>名称已经帮你填好预购名啦~</p>
        </div>
        <el-form-item label="谷子名称" prop="name">
          <el-input v-model="convertForm.name" maxlength="200" />
        </el-form-item>
        <div class="preorder-editor-grid">
          <el-form-item label="IP作品" prop="ip">
            <el-select v-model="convertForm.ip" placeholder="选择IP" filterable style="width: 100%" @change="handleConvertIpChange">
              <el-option v-for="ip in ipOptions" :key="ip.id" :label="ip.name" :value="ip.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="品类" prop="category">
            <el-tree-select
              v-model="convertForm.category"
              :data="categoryTreeOptions"
              :props="{ label: 'name', value: 'id', children: 'children' }"
              placeholder="选择品类"
              style="width: 100%"
              check-strictly
              filterable
            />
          </el-form-item>
        </div>
        <el-form-item label="角色" :required="convertForm.status !== 'draft'">
          <el-select v-model="convertForm.characters" placeholder="选择角色（可多选）" multiple filterable :disabled="!convertForm.ip" style="width: 100%">
            <el-option v-for="c in ipCharacters" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
          <div v-if="convertForm.status === 'draft'" class="convert-hint">草稿状态可以先不选角色哦~</div>
        </el-form-item>
      </section>

      <section class="preorder-editor-section">
        <div class="preorder-editor-section-title">
          <h4>状态与归属</h4>
          <p>不是草稿时，至少要带上一位角色哦~</p>
        </div>
        <el-form-item label="状态">
          <el-radio-group v-model="convertForm.status" class="convert-status-group">
            <el-radio-button value="draft">草稿</el-radio-button>
            <el-radio-button value="in_cabinet">在馆</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <div class="preorder-editor-grid">
          <el-form-item label="主题">
            <el-select v-model="convertForm.theme" placeholder="选填" clearable filterable style="width: 100%">
              <el-option v-for="theme in themeOptions" :key="theme.id" :label="theme.name" :value="theme.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="convertForm.notes" type="textarea" :rows="2" placeholder="选填" />
          </el-form-item>
        </div>
      </section>
      </el-form>
    </div>

    <div class="preorder-editor-form-footer">
      <el-button class="preorder-editor-cancel" @click="$emit('close')">取消</el-button>
      <el-button class="preorder-editor-submit" type="primary" :loading="convertSubmitting" @click="submit">
        转正
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { InfoFilled } from '@element-plus/icons-vue'
import { usePreorderConvert } from '@/composables/usePreorderConvert'
import type { Preorder } from '@/api/types'

const props = defineProps<{
  visible: boolean
  target: Preorder | null
}>()

const emit = defineEmits<{
  close: []
  converted: []
}>()

const convert = usePreorderConvert()
// 顶层解包：模板对嵌套对象内的 ref 不自动解包
const {
  convertForm,
  convertRules,
  convertSubmitting,
  handleConvertIpChange,
  ipOptions,
  themeOptions,
  ipCharacters,
  categoryTreeOptions,
} = convert

const setFormRef = (el: unknown) => {
  convert.convertRef.value = el
}

// 打开 / 切换目标时初始化转正表单并确保元数据可用
watch(
  [() => props.visible, () => props.target],
  ([visible]) => {
    if (visible && props.target) {
      convert.openConvert(props.target)
    }
  },
  { immediate: true }
)

const submit = async () => {
  const ok = await convert.submitConvert()
  if (ok) emit('converted')
}

defineExpose({ convert })
</script>

<style scoped>
.convert-goods-form-root {
  display: flex;
  flex-direction: column;
}

.convert-goods-form-scroll {
  min-height: 0;
}

@media (min-width: 769px) {
  .convert-goods-form-root {
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
  }

  .convert-goods-form-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
  }
}

.convert-tip {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 18px 28px 0;
  padding: 10px 14px;
  border: 1px solid rgba(142, 125, 255, 0.2);
  border-radius: 12px;
  background: rgba(142, 125, 255, 0.08);
  color: #6b5fe8;
  font-size: 13px;
  line-height: 1.6;
}

.convert-tip-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.preorder-editor-form {
  padding: 20px 28px 4px;
}

.preorder-editor-section {
  margin-bottom: 18px;
  padding: 18px 20px;
  border: 1px solid rgba(212, 175, 55, 0.14);
  border-radius: 16px;
  background:
    radial-gradient(circle at top right, rgba(162, 155, 254, 0.09), transparent 42%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.88));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 12px 26px -26px rgba(17, 24, 39, 0.5);
}

.preorder-editor-section-title {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 16px;
}

.preorder-editor-section-title::before {
  content: '';
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--primary-gold);
  box-shadow: 0 0 0 4px rgba(212, 175, 55, 0.12);
}

.preorder-editor-section-title h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  color: #2f2a20;
}

.preorder-editor-section-title p {
  margin: 0 0 0 auto;
  font-size: 12px;
  color: #9ca3af;
}

.preorder-editor-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}

.preorder-editor-form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.preorder-editor-form :deep(.el-form-item__label) {
  margin-bottom: 6px;
  color: #5f5874;
  font-weight: 800;
  font-size: 13px;
  line-height: 1.4;
}

.preorder-editor-form :deep(.el-input__wrapper),
.preorder-editor-form :deep(.el-select__wrapper),
.preorder-editor-form :deep(.el-textarea__inner) {
  min-height: 44px;
  border: 1px solid rgba(212, 175, 55, 0.16);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 6px 18px -14px rgba(162, 155, 254, 0.45);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.preorder-editor-form :deep(.el-input__wrapper.is-focus),
.preorder-editor-form :deep(.el-select__wrapper.is-focused) {
  border-color: rgba(162, 155, 254, 0.5);
  box-shadow: 0 0 0 3px rgba(196, 181, 253, 0.2), 0 10px 22px -14px rgba(162, 155, 254, 0.5);
}

.convert-status-group {
  width: 100%;
  display: flex;
}

.convert-status-group :deep(.el-radio-button) {
  flex: 1;
}

.convert-hint {
  font-size: 12px;
  color: #c0c4cc;
  line-height: 1.6;
}

.preorder-editor-cancel,
.preorder-editor-submit {
  min-width: 96px;
  min-height: 40px;
  border-radius: 12px;
  font-weight: 800;
}

.preorder-editor-cancel {
  border: 1px solid rgba(212, 175, 55, 0.35);
  color: #8a650b;
  background: rgba(255, 248, 230, 0.6);
}

.preorder-editor-cancel:hover {
  background: rgba(255, 248, 230, 0.95);
  border-color: rgba(212, 175, 55, 0.5);
  color: #8a650b;
}

.preorder-editor-submit {
  border: none;
  background: linear-gradient(135deg, var(--accent-purple), var(--accent-purple-hover));
  box-shadow: 0 8px 20px -8px rgba(142, 125, 255, 0.55);
}

.preorder-editor-submit:hover {
  background: linear-gradient(135deg, var(--accent-purple-hover), var(--accent-purple-dark));
}

.preorder-editor-form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 12px 28px 20px;
  background: rgba(255, 255, 255, 0.92);
  border-top: 1px solid rgba(212, 175, 55, 0.12);
}

@media (max-width: 768px) {
  .convert-tip {
    margin: 14px 14px 0;
  }

  .preorder-editor-form {
    padding: 16px 14px 4px;
  }

  .preorder-editor-section {
    margin-bottom: 14px;
    padding: 14px;
  }

  .preorder-editor-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .preorder-editor-form-footer {
    position: sticky;
    bottom: 0;
    padding: 10px 14px calc(10px + env(safe-area-inset-bottom));
  }

  .preorder-editor-cancel,
  .preorder-editor-submit {
    flex: 1;
    min-height: 48px;
  }
}
</style>
