import { describe, expect, it } from 'vitest'
import {
  MOBILE_SWIPE_ENABLED,
  mobileSwipeSequence,
  mobileSwipeStepIndex,
  type MobileIdentity,
} from '@/navigation/mobile'

const collector: MobileIdentity = { isClub: false, isAuthenticated: true }
const clubMember: MobileIdentity = { isClub: true, isAuthenticated: true }
const anonymous: MobileIdentity = { isClub: false, isAuthenticated: false }

const pairs = (identity: MobileIdentity) =>
  mobileSwipeSequence(identity).map(step => `${step.module}:${step.key}`)

describe('mobile swipe sequence', () => {
  it('walks every region in bottom-nav order for a collector', () => {
    expect(pairs(collector)).toEqual([
      'clubs:clubs',
      'showcase:showcase', 'showcase:barn', 'showcase:preorders', 'showcase:journal', 'showcase:stats',
      'organize:location', 'organize:ipcharacter', 'organize:category', 'organize:theme',
      'profile:account', 'profile:clubs', 'profile:achievements', 'profile:rewards', 'profile:settings',
    ])
  })

  it('keeps the club workspace sequence without 我的社团', () => {
    expect(pairs(clubMember)).toEqual([
      'clubs:clubs',
      'workbench:goods', 'workbench:themes', 'workbench:popularity', 'workbench:profile',
      'profile:account', 'profile:settings',
    ])
  })

  it('drops 我的社团 for anonymous visitors', () => {
    expect(pairs(anonymous)).toEqual([
      'clubs:clubs',
      'showcase:showcase', 'showcase:barn', 'showcase:preorders', 'showcase:journal', 'showcase:stats',
      'organize:location', 'organize:ipcharacter', 'organize:category', 'organize:theme',
      'profile:account', 'profile:settings',
    ])
  })

  it('resolves the current index including cross-region neighbours', () => {
    const steps = mobileSwipeSequence(collector)
    expect(mobileSwipeStepIndex(steps, { path: '/showcase', query: { tab: 'showcase' } })).toBe(1)
    expect(mobileSwipeStepIndex(steps, { path: '/showcase', query: { tab: 'stats' } })).toBe(5)
    expect(mobileSwipeStepIndex(steps, { path: '/preorders', query: {} })).toBe(3)
    expect(mobileSwipeStepIndex(steps, { path: '/settings', query: {} })).toBe(14)
    expect(steps[steps.length - 1]?.to).toBe('/settings')
    // 云展柜首个标签的右侧邻居是社团目录，统计标签的左侧邻居是整理的位置页。
    expect(steps[mobileSwipeStepIndex(steps, { path: '/showcase', query: { tab: 'showcase' } }) - 1]?.to).toBe('/clubs')
    expect(steps[mobileSwipeStepIndex(steps, { path: '/showcase', query: { tab: 'stats' } }) + 1]?.to).toBe('/location')
  })

  it('returns -1 for routes that are not part of the sequence', () => {
    const steps = mobileSwipeSequence(collector)
    for (const path of ['/goods/new', '/clubs/1', '/club/goods']) {
      expect(mobileSwipeStepIndex(steps, { path, query: {} })).toBe(-1)
    }
  })

  it('keeps the gesture switch available', () => {
    expect(MOBILE_SWIPE_ENABLED).toBe(true)
  })
})
