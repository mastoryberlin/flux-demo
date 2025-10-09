export default defineEventHandler(async () => {
  const db = useDrizzle()
  return await db.query.workflow.findMany()
})
