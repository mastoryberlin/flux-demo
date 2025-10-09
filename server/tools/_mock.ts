import { defineChain } from '../utils/chain'
import { sleep, SEC } from '../../shared/utils/timing'

const mockContent = `Lorem ipsum dolor sit amet, consectetur adipisici elit, sed eiusmod tempor incidunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquid ex ea commodi consequat. Quis aute iure reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint obcaecat cupiditat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. `
const words = mockContent.split(/\s+/)

export default defineChain('_mock', {
  title: 'Mock Chain',
  text: 'Mock Content Generation for Dev Purposes',
  color: 'blue1',
  expectedDuration: 0,
  dontTranslate: true,
  devOnly: true,
}, {
  type: 'object',
  properties: {
    words: {
      type: 'number',
      default: 1,
    },
  },
  additionalProperties: false,
})
  .custom('generate', async ({ userInput, currentInput }) => {
    await sleep(1 * SEC)
    if (Math.random() < 0.1) {
      throw 'Oops, a mock error occurred!'
    }
    let wordsCount = 'wordsCount' in currentInput ? currentInput.wordsCount as number : 0
    const add = userInput.words ?? 1
    wordsCount += add
    const markdown = words.slice(0, wordsCount).join(' ')
    return { markdown, wordsCount }
  })
  .control('quit or continue', ({ currentInput: { wordsCount } }) => {
    return wordsCount < words.length ? { jumpBack: 'generate' } : undefined
  })
