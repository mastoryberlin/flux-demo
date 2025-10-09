import type { ToolId } from '#tools'

export default defineEventHandler<{
  body: {
    requestId: string
    toolId: ToolId
    userInput: any
  }
}>(async (event) => {
  const db = useDrizzle()
  const params = await readBody(event)

  const env = process.env as unknown as Cloudflare.Env
  const instance = await env.GENERATION_WORKFLOW.create({ params })
  const id = instance.id as string
  const [details] = await Promise.all([
    instance.status(),
    db.delete(tables.progress).where(undefined),
    db.insert(tables.workflow).values({ id }),
  ])

  return { id, details }
})
