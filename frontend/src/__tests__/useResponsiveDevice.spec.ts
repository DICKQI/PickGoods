import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { getResponsiveDeviceState, useResponsiveDevice } from '@/composables/useResponsiveDevice'

describe('getResponsiveDeviceState', () => {
  it.each([
    { width: 390, height: 844, coarse: false, expectedMobile: true, expectedTallPhone: false },
    { width: 1200, height: 2670, coarse: true, expectedMobile: true, expectedTallPhone: true },
    { width: 2670, height: 1200, coarse: true, expectedMobile: false, expectedTallPhone: false },
    { width: 1366, height: 768, coarse: false, expectedMobile: false, expectedTallPhone: false },
    { width: 1440, height: 900, coarse: false, expectedMobile: false, expectedTallPhone: false },
  ])(
    'classifies $width x $height with coarse=$coarse',
    ({ width, height, coarse, expectedMobile, expectedTallPhone }) => {
      const state = getResponsiveDeviceState({ width, height, coarsePointer: coarse })

      expect(state.viewportWidth).toBe(width)
      expect(state.viewportHeight).toBe(height)
      expect(state.isCoarsePointer).toBe(coarse)
      expect(state.isMobile).toBe(expectedMobile)
      expect(state.isTallPhone).toBe(expectedTallPhone)
    },
  )
})

describe('useResponsiveDevice', () => {
  it('exposes responsive refs for component consumers', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1200,
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 2670,
    })
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      value: 1,
    })

    const observed: ReturnType<typeof useResponsiveDevice>[] = []
    const Probe = defineComponent({
      setup() {
        const device = useResponsiveDevice()
        observed.push(device)
        return () => null
      },
    })

    mount(Probe)

    expect(observed[0]?.isMobile.value).toBe(true)
    expect(observed[0]?.isTallPhone.value).toBe(true)
    expect(observed[0]?.viewportWidth.value).toBe(1200)
  })
})
