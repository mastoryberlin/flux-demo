export default defineEventHandler(async (event) => {
  const db = useDrizzle()
  const env = process.env as unknown as Cloudflare.Env

  const id = routeParam(event)

  if (await db.$count(tables.workflow, eq(tables.workflow.id, id)) < 1) {
    throw notFoundError()
  }
  const instance = await env.GENERATION_WORKFLOW.get(id)
  return await instance.status()
})
