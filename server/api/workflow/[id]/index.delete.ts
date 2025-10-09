export default defineEventHandler(async (event) => {
  const db = useDrizzle()
  const env = process.env as unknown as Cloudflare.Env

  const id = routeParam(event)

  if (await db.$count(tables.workflow, eq(tables.workflow.id, id)) < 1) {
    throw notFoundError()
  }
  await db.insert(tables.progress).values({ event: 'aborting' })
  const instance = await env.GENERATION_WORKFLOW.get(id)
  await instance.terminate()
  await db.insert(tables.progress).values({ event: 'aborted' })
})
