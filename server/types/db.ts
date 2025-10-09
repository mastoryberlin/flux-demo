import type { progress } from '../database/schema'

export type ProgressForSelect = typeof progress.$inferSelect
export type ProgressForInsert = typeof progress.$inferInsert
