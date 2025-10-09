import { capitalCase } from 'change-case'
import type { H3Event } from 'h3'

export const notFoundError = () => createError({
  statusCode: 404,
  statusMessage: 'Not found'
})

export const notImplementedError = (what?: string) => createError({
  statusCode: 501,
  statusMessage: `${what ? capitalCase(what) + ' is n' : 'N'}ot implemented yet.`
})

export const missingRouteParamError = (param = 'id') => createError({
  statusCode: 400,
  statusMessage: `Missing required route parameter ":${param}".`
})

export function routeParam(event: H3Event, param = 'id') {
  const val = getRouterParam(event, param)
  if (!val) {
    throw missingRouteParamError(param)
  }
  return val
}
