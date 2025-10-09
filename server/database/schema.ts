import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { uuid } from '../../shared/utils/uuid'

const idNumeric = {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true })
}

const idUuid = {
  id: text('id', { mode: 'text' }).primaryKey().$defaultFn(uuid)
}

const createdAt = {
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$default(() => new Date())
}

// const updatedAt = {
//   updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$default(() => new Date())
// }

// const timestamps = {
//   ...createdAt,
//   ...updatedAt
// }

// ------------------------------------------------------------------------------------------------------------------------

export const progress = sqliteTable('progress', {
  ...idNumeric,
  ...createdAt,
  event: text('event').notNull()
})

export const workflow = sqliteTable('workflow', {
  ...idUuid,
  ...createdAt
})
