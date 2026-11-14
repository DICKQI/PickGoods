import { describe, expect, it } from 'vitest'
import { isEndpointUnsupportedError } from '@/utils/request'

describe('isEndpointUnsupportedError', () => {
  it('treats 405 / 404 as "this server version has no such endpoint"', () => {
    // DRF 把未实现的 action 路径落到 /api/ips/{pk}/ 详情路由：POST → 405、GET → 404
    expect(isEndpointUnsupportedError({ response: { status: 405 } })).toBe(true)
    expect(isEndpointUnsupportedError({ response: { status: 404 } })).toBe(true)
    expect(isEndpointUnsupportedError({ status: 405 })).toBe(true)
  })

  it('keeps other failures as ordinary errors', () => {
    expect(isEndpointUnsupportedError({ response: { status: 500 } })).toBe(false)
    expect(isEndpointUnsupportedError({ response: { status: 403 } })).toBe(false)
    expect(isEndpointUnsupportedError({ response: { status: 400 } })).toBe(false)
    expect(isEndpointUnsupportedError({ message: 'boom' })).toBe(false)
    expect(isEndpointUnsupportedError(null)).toBe(false)
    expect(isEndpointUnsupportedError(undefined)).toBe(false)
  })
})
