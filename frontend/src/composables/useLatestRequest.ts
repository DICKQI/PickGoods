export function createLatestRequestGuard() {
  let sequence = 0
  return {
    next() {
      sequence += 1
      return sequence
    },
    isLatest(requestSequence: number) {
      return requestSequence === sequence
    },
    invalidate() {
      sequence += 1
    },
  }
}
