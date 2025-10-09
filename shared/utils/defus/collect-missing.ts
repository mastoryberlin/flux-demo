import * as jdp from 'jsondiffpatch'
import { dig } from '../json'
import { idempotentPersistedDefu } from './idempotent-persisted'

export function defuToCollectMissing(...args: any[]): any {
  if (args.length === 0) return {}
  if (args.length === 1) return args[0]

  const target = args[0]
  const defaults = args.slice(1)

  const inst = jdp.create({
    omitRemovedValues: true,
  })

  // Merge all defaults ...
  const mergedDefaults = idempotentPersistedDefu({}, ...defaults)
  // ... and compare them with the target data
  const diff = inst.diff(mergedDefaults, target)

  if (diff) {
    function applyDiff(d: jdp.Delta, prop = '', path = '') {
      const originalValue = dig(mergedDefaults, path, '.', true)
      // console.log('APPLYING DIFF/DELTA', d, '- prop:', prop, ', path:', path, 'v:', v)
      if (!d) { return }
      if (Array.isArray(d)) {
        switch (d.length) {
          case 1:
            // add
            // console.log('- add')
            return d[0]
          case 2:
            // modify
            // console.log('- modify')
            {
              if (originalValue && Array.isArray(originalValue) && d[1] && Array.isArray(d[1])) {
                return [...d[1], ...originalValue]
              } else {
                return d[1]
              }
            }
            break
          case 3:
            switch (d[2]) {
              case 0:
                // console.log('--> deletion op, ignoring')
                break
              case 2:
                // text diff - not supported yet
                throw 'text diffs are not supported yet'
              case 3:
                // array moves - not supported yet
                break
            }
        }
      } else if (typeof d === 'object') {
        const array = d._t === 'a'
        const json: any = array ? [] : {}
        // console.log('- object mode - json:', json)
        for (const [k, v] of Object.entries(d)) {
          const p = path ? [path, k].join('.') : k
          json[k] = applyDiff(v, k, p)
        }
        if (array && originalValue && Array.isArray(originalValue)) {
          const newValue = [...originalValue]
          //   jdp.patch(newValue, d)
          //   if (newValue.length === originalValue.length
          //     && newValue.every(v => originalValue.includes(v))
          //   ) {
          //     return undefined
          //   }
          json.push(...newValue)
        }
        return json
      }
      return undefined
    }
    return applyDiff(diff)
  } else {
    return {}
  }
}
