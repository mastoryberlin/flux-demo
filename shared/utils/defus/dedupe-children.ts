import defu, { createDefu } from 'defu'

export type ChildInsertionMode = 'push' | 'unshift'

function merger(mode: ChildInsertionMode): Parameters<typeof createDefu>[0] {
  return (obj, key, value) => {
    if (key === 'children') {
      const sourceChildren = obj[key] as any[]
      if (typeof sourceChildren === 'object' && Array.isArray(sourceChildren)
        && typeof value === 'object' && Array.isArray(value)) {
        for (
          let i = mode === 'push' ? 0 : value.length - 1;
          mode === 'push' ? i < value.length : i >= 0;
          i += mode === 'push' ? 1 : -1
        ) {
          const newChild = value[i]
          let indexOfOldChildWithSameId
          if (typeof newChild === 'object'
            && 'self' in newChild
            && typeof newChild.self === 'object'
            && 'id' in newChild.self
            && ((indexOfOldChildWithSameId = sourceChildren.findIndex(c => c?.self?.id === newChild.self.id)) > -1)
          ) {
            const oldChildWithSameId = sourceChildren[indexOfOldChildWithSameId]
            sourceChildren[indexOfOldChildWithSameId] = dedupeChildrenDefu(mode)(newChild, oldChildWithSameId)
          } else {
            sourceChildren[mode](newChild)
          }
        }
        return true
      }
    }
  }
}

export const dedupeChildrenDefu = (mode: ChildInsertionMode) => createDefu(merger(mode))
