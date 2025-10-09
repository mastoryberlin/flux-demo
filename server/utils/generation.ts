import type { ProgressForInsert } from '../types/db'
import { toolIds, tools } from '../../.nuxt/runtime/tools'
import type { ToolId } from '#tools'

// ========================================================================================================================
// Tools
// ========================================================================================================================

export async function getTool<const Id extends ToolId>(id: Id) {
  if (toolIds.includes(id as ToolId)) {
    const module = tools[id as ToolId]
    const chain = module.use() as Chain
    return chain
  }

  throw createError({
    statusCode: 404,
    statusMessage: `Prompt chain "${id}" not found.`,
  })
}

// ========================================================================================================================
// Generation Progress
// ========================================================================================================================

export async function addGenerationProgress(progress: ProgressForInsert) {
  const db = useDrizzle()
  await db.insert(tables.progress).values(progress)
}
