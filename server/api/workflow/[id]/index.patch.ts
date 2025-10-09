export default defineEventHandler(async (event) => {
  const db = useDrizzle()
  const env = process.env as unknown as Cloudflare.Env

  const id = routeParam(event)

  if (await db.$count(tables.workflow, eq(tables.workflow.id, id)) < 1) {
    throw notFoundError()
  }
  const instance = await env.GENERATION_WORKFLOW.get(id)
  const ev: DecisionAfterErrorEvent = {
    type: 'decision-after-error',
    payload: 'retry',
  }
  await instance.sendEvent(ev)
  // return await instance.resume()
})
