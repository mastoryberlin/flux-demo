export function isTruthy(v: any) { return !!v }
export function nonNull(v: any) { return !!v }

// ------------------------------------------------------------------------------------------------------------------------

export function capitalizeFirstLetter(s: string) {
  if (!s) { return '' }
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ------------------------------------------------------------------------------------------------------------------------

export function getAllValues(obj: object) {
  let values = [] as string[]
  for (const value of Object.values(obj)) {
    if (typeof value === 'object') {
      values = values.concat(getAllValues(value))
    } else {
      values.push(value)
    }
  }
  return values
}

// ------------------------------------------------------------------------------------------------------------------------

export function noop(): void { }

// ------------------------------------------------------------------------------------------------------------------------

export function pickRandomArrayItem<T>(array: readonly T[]) {
  if (array.length) {
    const n = array.length
    let i = Math.floor(Math.random() * n)
    i = Math.max(0, Math.min(i, n - 1))
    return array[i]
  } else {
    throw 'pickRandomArrayItem: Array is empty'
  }
}

// ------------------------------------------------------------------------------------------------------------------------

export function removeFromArray<T>(array: T[], item: T) {
  try {
    const i = array.indexOf(item)
    if (i >= 0) {
      array.splice(i, 1)
    }
  } catch (e) {
    console.warn('Unable to remove array element', item, 'from array', array, '- I will silently ignore this, hoping for the best!')
  }
  return array
}

// ------------------------------------------------------------------------------------------------------------------------

// Thanks to https://bluedesk.blogspot.com/2023/11/settingresetting-vue-reactive-objects.html

/**
 * Recursively copies each field from src to dest, avoiding the loss of
 * reactivity. Used to copy values from an ordinary object to a reactive object.
 */
export function deepAssign<T extends object>(destObj: T, srcObj: T): void {
  const dest = destObj
  const src = toRaw(srcObj)
  if (src instanceof Date) {
    throw new Error('[deepAssign] Dates must be copied manually.')
  } else if (Array.isArray(src)) {
    for (let i = 0; i < src.length; ++i) {
      if (src[i] === null) {
        (dest as any)[i] = null
      } else if (src[i] instanceof Date) {
        (dest as any)[i] = new Date(src[i].getTime())
      } else if (Array.isArray(src[i])
        || typeof src[i] === 'object') {
        deepAssign((dest as any)[i], src[i])
      } else {
        (dest as any)[i] = toRaw(src[i])
      }
    }
  } else if (typeof src === 'object') {
    for (const k in src) {
      if (src[k] === null) {
        (dest as any)[k] = null
      } else if (src[k] instanceof Date) {
        (dest[k] as any) = new Date((src[k] as any).getTime())
      } else if (Array.isArray(src[k])
        || typeof src[k] === 'object') {
        deepAssign(dest[k] as any, src[k] as any)
      } else {
        (dest[k] as any) = toRaw(src[k])
      }
    }
  } else {
    throw new Error('[deepAssign] Unknown type: ' + (typeof src))
  }
}

// ------------------------------------------------------------------------------------------------------------------------

export type ContentFileExtension =
  | ''
  | 'json'
  | 'jsonc'
  | 'flow'
  | 'md'
  | 'yml'
  | 'yaml'
  | 'js'
  | 'ts'
  | 'vue'
  | 'csv'

const fileExtensionRe = /\.(\w+)$/
export function getFileExtension(path: string): ContentFileExtension {
  const m = path.match(fileExtensionRe)
  if (m) {
    return m[1]!.toLowerCase() as ContentFileExtension
  } else {
    return ''
  }
}

export function withoutFileExtension(path: string) {
  return path.replace(fileExtensionRe, '')
}
