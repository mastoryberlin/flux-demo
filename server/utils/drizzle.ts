import { drizzle } from 'drizzle-orm/d1'

import { getTableColumns } from 'drizzle-orm'
import * as schema from '../database/schema'
// import * as relations from '../database/relations'

export { sql, eq, and, or } from 'drizzle-orm'

/* eslint-disable @stylistic/indent */

const tablesFKDependencies: TableName[] = [
  // 'role',
  // 'account',
  //   'email',  // -> account
  //     'person', // -> email
  // 'org',
  //   'account_role', // -> account, role
  //   'org_member',   // -> account, org
  //   'group',        // -> account, org
  //     'group_member',   // -> account, group
  // 'content',
  // 'content_provider',
  // 'app',
  //   'app_user',   // -> app
  //     'session',    // -> app_user
  //       'session_history',   // -> session
  //     'ai_chat',  // account
  //       'ai_thread',  // ai_chat, ai_request
  //         'ai_request', // ai_thread
  //           'ai_result',  // ai_request
  //             'document', // ai_result
  //           'feedback',   // app_user, ai_request
            'progress' // ai_request
] as const
export const tables = {
  ...schema,
  inCreationOrder: () => tablesFKDependencies,
  inDeletionOrder: () => tablesFKDependencies.toReversed()
}

export type TableName = Exclude<keyof typeof tables, 'inCreationOrder' | 'inDeletionOrder'>

export function useDrizzle() {
  return drizzle(hubDatabase(), { schema: { ...schema/* , ...relations */ } })
}

export const noColumnsFrom = (table: Parameters<typeof getTableColumns>[0]) => ({
  columns: Object.fromEntries(Object.keys(getTableColumns(table)).map(k => [k, false]))
})
