import { assert, describe, expect, it } from 'vitest'

// import { dedupeChildrenDefu } from './dedupe-children'
import { defuWithoutAdditionalEntries } from './without-additional-entries'
import { defuToCollectMissing } from './collect-missing'

// ========================================================================================================================
// Tests for Defus
// ========================================================================================================================

function examples() {
  return {
    def: {
      a: [1],
      b: 2,
      d: {
        e: false,
      },
      g: [
        '1st',
        '2nd',
      ],
    },

    val: {
      a: [{
        nested: true,
      }, 'additional'],
      b: 'string',
      c: 'this should never be merged',
      d: {
        e: false,
        f: true,
      },
      g: [
        '2nd',
        '1st',
      ],
    },
  }
}

describe('defus', () => {
  // ------------------------------------------------------------------------------------------------------------------------
  // dedupeChildrenDefu
  // ------------------------------------------------------------------------------------------------------------------------

  // describe('dedupeChildrenDefu', () => {
  //   it('merges fragments normally, except when there is a child entry with the same `id` present in the default it merges them together rather than adding a new child', () => {
  //     const fragA: any = {
  //       self: {
  //         a: 1,
  //       },
  //       children: [
  //         {
  //           self: {
  //             id: 'exists',
  //             x: 'y',
  //           },
  //         },
  //         {
  //           self: {
  //             id: 'new',
  //             foo: 'bar',
  //           },
  //         },
  //         {
  //           self: {
  //             second: 'without ID',
  //           },
  //         },
  //       ],
  //     }

  //     const fragB: any = {
  //       self: {
  //         b: true,
  //       },
  //       children: [
  //         {
  //           self: {
  //             id: 'exists',
  //             combined: true,
  //           },
  //         },
  //         {
  //           self: {
  //             id: 'old',
  //             p: 'q',
  //           },
  //         },
  //         {
  //           self: {
  //             first: 'without ID',
  //           },
  //         },
  //       ],
  //     }

  //     const combo = dedupeChildrenDefu('push')(fragA, fragB)
  //     assert.deepEqual(combo, {
  //       self: {
  //         a: 1,
  //         b: true,
  //       },
  //       children: [
  //         {
  //           self: {
  //             id: 'exists',
  //             x: 'y',
  //             combined: true,
  //           },
  //         },
  //         {
  //           self: {
  //             id: 'old',
  //             p: 'q',
  //           },
  //         },
  //         {
  //           self: {
  //             first: 'without ID',
  //           },
  //         },
  //         {
  //           self: {
  //             id: 'new',
  //             foo: 'bar',
  //           },
  //         },
  //         {
  //           self: {
  //             second: 'without ID',
  //           },
  //         },
  //       ],
  //     })
  //   })
  // })

  // ------------------------------------------------------------------------------------------------------------------------
  // idempotentPersistedDefu
  // ------------------------------------------------------------------------------------------------------------------------

  // describe('idempotentPersistedDefu', () => {
  //   it('merges JSON normally, except for revivable arrays, which it leaves untouched', () => {

  //   })
  // })

  describe('defuWithoutAdditionalEntries', () => {
    it('supports merge behavior for arrays like standard defu', () => {
      const { def, val } = examples()
      console.log('val:', val, 'def:', def)
      const res = defuWithoutAdditionalEntries('merge')(val, def)
      expect(res).toHaveProperty('a')
      expect(res).toHaveProperty('b')
      expect(res).not.toHaveProperty('c')

      assert.deepEqual(res.a, [...val.a, ...def.a])
      assert.deepEqual(res.b, val.b)
    })

    it('can be configured to overwrite array items with the new value', () => {
      const { def, val } = examples()
      const res = defuWithoutAdditionalEntries('overwriteArray')(val, def)
      expect(res).toHaveProperty('a')
      expect(res).toHaveProperty('b')
      expect(res).not.toHaveProperty('c')

      assert.deepEqual(res.a, val.a)
      assert.deepEqual(res.b, val.b)
    })

    it('can be configured to replace existing array items with the new values', () => {
      const { def, val } = examples()
      const res = defuWithoutAdditionalEntries('replaceExistingItems')(val, def)

      assert.deepEqual(res.a, [val.a[0]!])
      assert.deepEqual(res.b, val.b)
    })
  })

  describe('defuToCollectMissing', () => {
    it('can be used to collect only missing or changed entries in a minimal object', () => {
      const { def, val } = examples()
      const res = defuToCollectMissing(val, def)

      assert.deepEqual(res, {
        a: [...val.a, ...def.a],
        b: val.b,
        c: val.c,
        d: {
          f: true,
        },
      })
    })
  })
})
