export default defineEventHandler<{
  body: {
    event: string
  }
}>(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required route parameter ":id".',
    })
  }

  const body = await readBody(event)
  const db = useDrizzle()
  return await db.insert(tables.progress).values(body).returning({ id: tables.progress.id })
})
