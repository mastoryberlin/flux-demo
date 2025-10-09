import defu, { createDefu } from 'defu'

export const idempotentPersistedDefu = createDefu((obj, key, value) => {
  if (Array.isArray(obj[key]) && Array.isArray(value)) {
    obj[key] = value
    return true // don't merge arrays
  }
})
