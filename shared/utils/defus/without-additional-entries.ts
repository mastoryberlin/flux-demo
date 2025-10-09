import { defu, createDefu } from 'defu'

type ArrayBehavior = 'replaceExistingItems' | 'overwriteArray' | 'merge'

function merger(arrayBehavior: ArrayBehavior): Parameters<typeof createDefu>[0] {
  return (obj, key, value) => {
    // console.log('defu - key:', key, 'obj[key]=', obj[key], ', value:', value)
    if (!(key in obj)) { return true }
    const o = obj[key]
    if (Array.isArray(o) && Array.isArray(value)) {
      switch (arrayBehavior) {
        case 'replaceExistingItems':
          for (let i = 0; i < o.length; i++) {
            o[i] = value[i]
          }
          return true
        case 'overwriteArray':
          obj[key] = value
          return true
        case 'merge':
          return false
      }
    }
  }
}

export const defuWithoutAdditionalEntries = (arrayBehavior: ArrayBehavior) => createDefu(merger(arrayBehavior))
