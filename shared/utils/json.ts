import { jsonrepair } from 'jsonrepair'

export function dig(object: { [key: string]: any }, path: string, separator = '.', noThrow = false): any {
  const parts = path.split(separator)
  let digging = object
  for (const p of parts) {
    if (typeof digging !== 'object' || !(p in digging)) {
      if (noThrow) {
        return undefined
      }
      else {
        throw new Error(`Error in dig: object ${JSON.stringify(object)} contains no entry at path ${path}`)
      }
    }
    else {
      digging = digging[p]
    }
  }
  return digging
}

// ------------------------------------------------------------------------------------------------------------------------

export function toJsonExcludingProps(object: any, exclude: string[]): any {
  const props = Object.keys(object).reduce((obj: any, prop: any) => {
    if (!exclude.includes(prop)) {
      obj[prop] = object[prop]
    }
    return obj
  }, {})
  return props
}

// ------------------------------------------------------------------------------------------------------------------------

export function parseJSONC(s: string) {
  const commentRe = /((?:^|\n)[^"\n]*?(?:"(?:[^"\n]|\\")*"[^"\n]*?)*)\/\/[^\n]*/mg
  const commaRe = /,(\s*[}\]])/mg
  s = s.replace(commentRe, '$1').replace(commaRe, '$1')
  console.debug('parsing JSONC - replaced line comments and trailing commas in raw text, resulting in', s)
  return JSON.parse(s)
}

// ------------------------------------------------------------------------------------------------------------------------

function balanceDelimiters(s: string): string {
  const stack: string[] = []
  let lastValidIndex = s.length

  for (let i = 0; i < s.length; i++) {
    const char = s[i]
    if (char === '{' || char === '[') {
      stack.push(char)
    }
    else if (char === '}' || char === ']') {
      if (stack.length === 0) {
        // If we encounter a closing delimiter without a matching opening delimiter,
        // we consider the string invalid up to this point.
        lastValidIndex = i
        break
      }
      const lastOpen = stack.pop()
      if ((char === '}' && lastOpen !== '{') || (char === ']' && lastOpen !== '[')) {
        // If the closing delimiter does not match the last opening delimiter,
        // we consider the string invalid up to this point.
        lastValidIndex = i
        break
      }
    }
  }

  let result = s.slice(0, lastValidIndex)
  // If there are unmatched opening delimiters, close them in the correct order
  while (stack.length > 0) {
    const lastOpen = stack.pop()
    if (lastOpen === '{') {
      result += '}'
    }
    else if (lastOpen === '[') {
      result += ']'
    }
  }

  console.log('Balanced JSON delimiters - result:', result)
  return result
}

export function parseUnstructuredJSON(s: string | object) {
  if (s && typeof s === 'object') {
    return s
  }
  let json
  try {
    json = JSON.parse(jsonrepair(s))
    return json
  } catch (e) {
    throw new Error(`Error parsing JSON output in model response: ${String(e)}`)
  }
}

export function sortRecursively(s: any) {
  const coll = new Intl.Collator('en-US', {
    numeric: true,
    sensitivity: 'base',
  })
  if (s && typeof s === 'object') {
    if (Array.isArray(s)) {
      s.sort((a, b) => coll.compare(a, b))
    } else {
      const entries = Object.entries(s)
      entries.sort(([k], [l]) => coll.compare(k, l))
      for (const [_, v] of entries) {
        sortRecursively(v)
      }
      s = Object.fromEntries(entries)
    }
  }
  return s
}
