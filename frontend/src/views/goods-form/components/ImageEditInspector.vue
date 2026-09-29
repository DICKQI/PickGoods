<template>
  <section
    class="edit-inspector"
    :class="{ 'is-disabled': disabled }"
    :aria-disabled="disabled"
    :inert="disabled || undefined"
    aria-label="编辑参数"
  >
    <header class="edit-inspector__header">
      <div>
        <strong>{{ activeToolMeta.label }}</strong>
        <span>{{ activeToolMeta.description }}</span>
      </div>
    </header>

    <div v-if="activeTool === 'crop'" class="edit-panel">
      <div class="edit-panel__section">
        <span class="edit-panel__label">画面比例</span>
        <div class="ratio-grid">
          <button
            v-for="ratio in ASPECT_RATIOS"
            :key="ratio.value"
            type="button"
            class="ratio-option"
            :class="{ 'is-active': ratio.value === selectedAspectRatio }"
            @click="selectAspectRatio(ratio.value)"
          >
            <span class="ratio-option__shape" :class="`ratio-option__shape--${ratio.value}`" />
            <span class="ratio-option__label">{{ ratio.label }}</span>
            <small>{{ ratio.description }}</small>
          </button>
        </div>
      </div>

      <div class="edit-panel__section">
        <span class="edit-panel__label">快捷旋转</span>
        <div class="quick-actions">
          <el-button :icon="RefreshLeft" @click="emit('quick-rotate', -90)">向左 90°</el-button>
          <el-button :icon="RefreshRight" @click="emit('quick-rotate', 90)">向右 90°</el-button>
        </div>
      </div>
    </div>

    <div v-else-if="activeTool === 'adjust'" class="edit-panel">
      <SliderControl
        label="亮度"
        :model-value="filterState.brightness"
        :min="0"
        :max="200"
        suffix="%"
        @update:model-value="updateFilter('brightness', $event)"
        @change="emit('commit')"
      />
      <SliderControl
        label="对比度"
        :model-value="filterState.contrast"
        :min="0"
        :max="200"
        suffix="%"
        @update:model-value="updateFilter('contrast', $event)"
        @change="emit('commit')"
      />
      <SliderControl
        label="饱和度"
        :model-value="filterState.saturation"
        :min="0"
        :max="200"
        suffix="%"
        @update:model-value="updateFilter('saturation', $event)"
        @change="emit('commit')"
      />

      <div class="advanced-section">
        <button
          type="button"
          class="advanced-section__toggle"
          :aria-expanded="colorAdvancedOpen"
          @click="colorAdvancedOpen = !colorAdvancedOpen"
        >
          <span>高级色彩（HSL）</span>
          <el-icon :class="{ 'is-open': colorAdvancedOpen }"><ArrowDown /></el-icon>
        </button>

        <div v-show="colorAdvancedOpen" class="advanced-section__body">
          <p class="advanced-hint">逐色调整以右侧输出预览为准。</p>
          <div class="hsl-tabs">
            <button
              v-for="tab in HSL_COLOR_TABS"
              :key="tab.key"
              type="button"
              class="hsl-tab"
              :class="[`hsl-tab--${tab.key}`, { 'is-active': activeHslColor === tab.key }]"
              @click="emit('update:activeHslColor', tab.key)"
            >
              {{ tab.label }}
            </button>
          </div>
          <button type="button" class="inline-reset" @click="emit('reset-current-hsl')">
            重置当前颜色
          </button>
          <SliderControl
            label="色相"
            :model-value="activeHsl.h"
            :min="-180"
            :max="180"
            suffix="°"
            @update:model-value="updateHsl('h', $event)"
            @change="emit('commit')"
          />
          <SliderControl
            label="饱和度偏移"
            :model-value="activeHsl.s"
            :min="-100"
            :max="100"
            suffix="%"
            show-sign
            @update:model-value="updateHsl('s', $event)"
            @change="emit('commit')"
          />
          <SliderControl
            label="亮度偏移"
            :model-value="activeHsl.l"
            :min="-100"
            :max="100"
            suffix="%"
            show-sign
            @update:model-value="updateHsl('l', $event)"
            @change="emit('commit')"
          />
        </div>
      </div>
    </div>

    <div v-else-if="activeTool === 'correct'" class="edit-panel">
      <SliderControl
        label="拉直"
        :model-value="filterState.rotation ?? 0"
        :min="-180"
        :max="180"
        suffix="°"
        show-sign
        @update:model-value="updateFilter('rotation', $event)"
        @change="emit('commit')"
      />

      <div class="advanced-section">
        <button
          type="button"
          class="advanced-section__toggle"
          :aria-expanded="perspectiveAdvancedOpen"
          @click="perspectiveAdvancedOpen = !perspectiveAdvancedOpen"
        >
          <span>透视矫正</span>
          <el-icon :class="{ 'is-open': perspectiveAdvancedOpen }"><ArrowDown /></el-icon>
        </button>
        <div v-show="perspectiveAdvancedOpen" class="advanced-section__body">
          <p class="advanced-hint">透视效果以右侧输出预览为准。</p>
          <SliderControl
            label="水平透视"
            :model-value="filterState.perspectiveHorizontal"
            :min="-100"
            :max="100"
            suffix="%"
            show-sign
            @update:model-value="updateFilter('perspectiveHorizontal', $event)"
            @change="emit('commit')"
          />
          <SliderControl
            label="垂直透视"
            :model-value="filterState.perspectiveVertical"
            :min="-100"
            :max="100"
            suffix="%"
            show-sign
            @update:model-value="updateFilter('perspectiveVertical', $event)"
            @change="emit('commit')"
          />
        </div>
      </div>
    </div>

    <div v-else class="edit-panel">
      <div class="switch-row">
        <div>
          <strong>圆角矩形</strong>
          <span>圆角外区域将保持透明</span>
        </div>
        <el-switch
          :model-value="enableRoundedRect"
          :disabled="!roundedAvailable"
          @update:model-value="updateRoundedEnabled"
        />
      </div>
      <SliderControl
        label="圆角大小"
        :model-value="roundedRadius"
        :min="0"
        :max="50"
        suffix="%"
        :disabled="!enableRoundedRect || !roundedAvailable"
        @update:model-value="emit('update:roundedRadius', $event)"
        @change="emit('commit')"
      />
      <p v-if="!roundedAvailable" class="field-hint">圆形和椭圆比例已自带形状裁切。</p>

      <div class="edit-panel__divider" />

      <div class="switch-row">
        <div>
          <strong>画面边距</strong>
          <span>在图片四周增加白色留白</span>
        </div>
        <el-switch
          :model-value="enableMargin"
          @update:model-value="updateMarginEnabled"
        />
      </div>
      <SliderControl
        label="边距大小"
        :model-value="marginPercent"
        :min="0"
        :max="30"
        suffix="%"
        :disabled="!enableMargin"
        @update:model-value="emit('update:marginPercent', $event)"
        @change="emit('commit')"
      />

      <div class="transparency-note" :class="{ 'is-active': producesTransparency }">
        <el-icon><InfoFilled /></el-icon>
        <span>{{ producesTransparency ? '当前结果将保留透明画布。' : '当前结果不包含透明区域；启用边距时会使用白色底色。' }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, h, ref, type Component } from 'vue'
import {
  ArrowDown,
  InfoFilled,
  RefreshLeft,
  RefreshRight,
} from '@element-plus/icons-vue'
import { ElSlider } from 'element-plus'
import type { CropFilterState, HslColorKey } from '@/views/goods-form/cropHistory'
import {
  ASPECT_RATIOS,
  HSL_COLOR_TABS,
  IMAGE_EDITOR_TOOLS,
  type ImageEditorTool,
} from '@/views/goods-form/imageEditorConfig'

const SliderControl: Component = {
  props: {
    label: { type: String, required: true },
    modelValue: { type: Number, required: true },
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    suffix: { type: String, default: '' },
    showSign: Boolean,
    disabled: Boolean,
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    const displayValue = computed(() => {
      const sign = props.showSign && props.modelValue > 0 ? '+' : ''
      return `${sign}${props.modelValue}${props.suffix}`
    })

    return () => h('div', { class: 'slider-control' }, [
      h('div', { class: 'slider-control__header' }, [
        h('span', props.label),
        h('strong', displayValue.value),
      ]),
      h(ElSlider, {
        modelValue: props.modelValue,
        min: props.min,
        max: props.max,
        disabled: props.disabled,
        'onUpdate:modelValue': (value: number | number[]) => {
          emit('update:modelValue', Array.isArray(value) ? value[0] : value)
        },
        onChange: () => emit('change'),
      }),
    ])
  },
}

const props = defineProps<{
  activeTool: ImageEditorTool
  selectedAspectRatio: string
  filterState: CropFilterState
  activeHslColor: HslColorKey
  enableRoundedRect: boolean
  roundedRadius: number
  enableMargin: boolean
  marginPercent: number
  sourceHasTransparency: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:selectedAspectRatio': [value: string]
  'update:activeHslColor': [value: HslColorKey]
  'update:enableRoundedRect': [value: boolean]
  'update:roundedRadius': [value: number]
  'update:enableMargin': [value: boolean]
  'update:marginPercent': [value: number]
  'update-filter': [patch: Partial<CropFilterState>]
  'update-hsl': [key: HslColorKey, axis: 'h' | 's' | 'l', value: number]
  'quick-rotate': [degrees: number]
  'reset-current-hsl': []
  commit: []
}>()

const colorAdvancedOpen = ref(false)
const perspectiveAdvancedOpen = ref(false)

const activeToolMeta = computed(() => (
  IMAGE_EDITOR_TOOLS.find((tool) => tool.key === props.activeTool)
  ?? IMAGE_EDITOR_TOOLS[0]!
))

const activeHsl = computed(() => (
  props.filterState.hslAdjustments[props.activeHslColor]
  ?? { h: 0, s: 0, l: 0 }
))

const roundedAvailable = computed(() => (
  props.selectedAspectRatio === 'free' || props.selectedAspectRatio === '1:1'
))

const producesTransparency = computed(() => (
  !(props.enableMargin && props.marginPercent > 0)
  && (
    props.sourceHasTransparency
    || props.selectedAspectRatio === 'circle'
    || props.selectedAspectRatio.endsWith('-ellipse')
    || (props.enableRoundedRect && props.roundedRadius > 0)
  )
))

const updateFilter = <K extends keyof CropFilterState>(key: K, value: number) => {
  emit('update-filter', { [key]: value } as Pick<CropFilterState, K>)
}

const updateHsl = (axis: 'h' | 's' | 'l', value: number) => {
  emit('update-hsl', props.activeHslColor, axis, value)
}

const selectAspectRatio = (value: string) => {
  emit('update:selectedAspectRatio', value)
}

const updateRoundedEnabled = (value: boolean | string | number) => {
  emit('update:enableRoundedRect', Boolean(value))
  emit('commit')
}

const updateMarginEnabled = (value: boolean | string | number) => {
  emit('update:enableMargin', Boolean(value))
  emit('commit')
}
</script>

<style scoped>
.edit-inspector {
  min-height: 0;
  background: #fff;
}

.edit-inspector.is-disabled {
  opacity: 0.55;
  pointer-events: none;
}

.edit-inspector__header {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 13px 16px 12px;
  border-bottom: 1px solid rgba(29, 33, 41, 0.08);
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(12px);
}

.edit-inspector__header > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.edit-inspector__header strong {
  color: #252a33;
  font-size: 14px;
}

.edit-inspector__header span {
  color: #8b929e;
  font-size: 11px;
}

.edit-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 16px;
}

.edit-panel__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.edit-panel__label {
  color: #4f5662;
  font-size: 12px;
  font-weight: 700;
}

.edit-panel__divider {
  height: 1px;
  background: rgba(29, 33, 41, 0.08);
}

.ratio-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.ratio-option {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  grid-template-rows: auto auto;
  column-gap: 8px;
  align-items: center;
  min-height: 58px;
  padding: 8px 9px;
  border: 1px solid #e6e8ed;
  border-radius: 11px;
  background: #fff;
  color: #4f5662;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.16s ease, background-color 0.16s ease, box-shadow 0.16s ease;
}

.ratio-option:hover,
.ratio-option:focus-visible {
  outline: none;
  border-color: rgba(184, 148, 31, 0.45);
  background: #fffcf4;
}

.ratio-option.is-active {
  border-color: rgba(184, 148, 31, 0.58);
  background: #fff9ea;
  box-shadow: 0 0 0 1px rgba(184, 148, 31, 0.12);
}

.ratio-option__shape {
  grid-row: 1 / span 2;
  display: block;
  width: 24px;
  height: 24px;
  border: 1.5px solid currentColor;
  border-radius: 4px;
}

.ratio-option__shape--1\:1 {
  width: 22px;
  height: 22px;
}

.ratio-option__shape--circle {
  width: 23px;
  height: 23px;
  border-radius: 50%;
}

.ratio-option__shape--47\:65-ellipse,
.ratio-option__shape--63\:93-ellipse {
  width: 18px;
  height: 25px;
  border-radius: 50%;
}

.ratio-option__label {
  align-self: end;
  font-size: 12px;
  font-weight: 700;
}

.ratio-option small {
  align-self: start;
  overflow: hidden;
  color: #9299a4;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.quick-actions :deep(.el-button) {
  margin: 0;
}

.slider-control {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.slider-control__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  color: #59606b;
  font-size: 12px;
}

.slider-control__header strong {
  color: #343a44;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.edit-panel :deep(.el-slider) {
  --el-slider-main-bg-color: var(--primary-gold);
}

.edit-panel :deep(.el-slider__button) {
  border-color: #fff;
  background: #fff;
  box-shadow: 0 2px 8px rgba(38, 42, 49, 0.24);
}

.advanced-section {
  padding-top: 4px;
  border-top: 1px solid rgba(29, 33, 41, 0.08);
}

.advanced-section__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 0 6px;
  border: 0;
  background: transparent;
  color: #444b56;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.advanced-section__toggle .el-icon {
  transition: transform 0.18s ease;
}

.advanced-section__toggle .el-icon.is-open {
  transform: rotate(180deg);
}

.advanced-section__body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 12px 0 2px;
}

.advanced-hint {
  margin: -4px 0 0;
  color: #8b929e;
  font-size: 11px;
  line-height: 1.5;
}

.hsl-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.hsl-tab {
  min-width: 32px;
  padding: 5px 9px;
  border: 0;
  border-radius: 999px;
  background: #f2f3f5;
  color: #656c77;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.hsl-tab.is-active {
  color: #fff;
  background: linear-gradient(135deg, #c9a53a, #e3c779);
}

.hsl-tab--red.is-active { background: linear-gradient(135deg, #d87373, #c13a3a); }
.hsl-tab--orange.is-active { background: linear-gradient(135deg, #e9a45b, #cf7c2c); }
.hsl-tab--yellow.is-active { background: linear-gradient(135deg, #d8ba4e, #b89b2f); }
.hsl-tab--green.is-active { background: linear-gradient(135deg, #7bc193, #45a264); }
.hsl-tab--cyan.is-active { background: linear-gradient(135deg, #65b9c7, #3c90a0); }
.hsl-tab--blue.is-active { background: linear-gradient(135deg, #7d9ee0, #496fbe); }
.hsl-tab--purple.is-active { background: linear-gradient(135deg, #a396ff, #7f63d6); }

.inline-reset {
  align-self: flex-end;
  margin-top: -6px;
  padding: 2px 0;
  border: 0;
  background: transparent;
  color: var(--primary-gold-dark);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.switch-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.switch-row > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.switch-row strong {
  color: #424953;
  font-size: 12px;
}

.switch-row span,
.field-hint {
  margin: 0;
  color: #8b929e;
  font-size: 11px;
  line-height: 1.5;
}

.transparency-note {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 9px 10px;
  border-radius: 9px;
  background: #f6f7f9;
  color: #737b87;
  font-size: 11px;
  line-height: 1.5;
}

.transparency-note.is-active {
  background: #fff9e9;
  color: #897020;
}

.transparency-note .el-icon {
  flex: none;
  margin-top: 1px;
}

@media (max-width: 768px) {
  .edit-panel {
    gap: 18px;
    padding: 14px;
  }
}
</style>
