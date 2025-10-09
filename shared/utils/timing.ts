export const SEC = 1000
export const MIN = 60 * SEC
export const HOURS = 60 * MIN

export const sleep = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds))

export async function waitUntil<F extends (...args: unknown[]) => ReturnType<F>>(cb: F, sleepTime = 500): Promise<NonNullable<ReturnType<F>>> {
  let ret: ReturnType<F>
  while (!(ret = cb())) {
    await sleep(sleepTime)
  }
  return ret
}

export const readTime = (text: string) => {
  const READ_TIME_PER_WORD = 0.0077 * 60
  const CLASS_READ_SPEED_FACTOR = 1.5
  const wordsCount = text.split(/\s+/).length
  return wordsCount * READ_TIME_PER_WORD * CLASS_READ_SPEED_FACTOR
}

export const typeTime = (text: string) => readTime(text) * 100
