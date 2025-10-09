import { ofetch } from 'ofetch'
import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers'
import { WorkflowEntrypoint } from 'cloudflare:workers'
import { NonRetryableError } from 'cloudflare:workflows'
import { getTool } from '../../../utils/generation'
import type { Chain, Context } from '../../../utils/chain'
import type { ProgressMessage } from '../../../../shared/types/ws'
import type { ToolId } from '#tools'

/**
 * Welcome to Cloudflare Workers! This is your first Workflows application.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your Workflow in action
 * - Run `npm run deploy` to publish your application
 *
 * Learn more at https://developers.cloudflare.com/workflows
 */

type PassedData = Record<string, unknown>

type Params = {
  requestId: string
  toolId: ToolId
  userInput: PassedData
  resumeFromNode: string
}

export class GenerationWorkflow extends WorkflowEntrypoint<Cloudflare.Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    // Can access bindings on `this.env`
    // Can access params on `event.payload`

    const { instanceId, payload: { requestId, toolId, userInput, resumeFromNode } } = event

    let tool: Chain

    const start = performance.now()

    const db = this.env.DB
    const bucket = this.env.BUCKET
    const queue = this.env.PROGRESS_QUEUE

    const deleteProgress = db.prepare('DELETE FROM progress')
    const insertProgress = db
      .prepare([
        'INSERT INTO progress (created_at, event)',
        'VALUES ((CURRENT_TIMESTAMP), ?)',
        'RETURNING id',
      ].join(' '))

    const addGenerationProgress = async (arg: ProgressMessage) => {
      const e = arg.event
      const { results } = await insertProgress.bind(e).all()

      queue.send({
        ...arg,
        request: requestId,
      })
    }

    await step.do('get tool', async () => {
      try {
        tool = await getTool(toolId)
      } catch (error) {
        throw new NonRetryableError(`unknown tool "${toolId}"`)
      }
    })

    // @ts-expect-error
    const { nodes } = tool
    const idToIndexMap = new Map<string, number>(nodes.map((node, i) => [node.id!, i]))

    let currentInput: PassedData = {}
    const previousOutputs: Record<string, PassedData> = {}
    const context: Context<any, any, any> = { userInput, currentInput, previousOutputs }
    let jumpAfterControlNode = -1
    for (let i = 0; i < nodes.length; jumpAfterControlNode >= 0 ? i = jumpAfterControlNode : i++) {
      jumpAfterControlNode = -1

      const node = nodes[i]
      const { id, type } = node

      await step.do(`begin node ${i}: ${id} (${type})`, async () => {
        await addGenerationProgress({ event: `nodeBegin "${id}"` })
      })

      switch (type) {
        case 'custom':
          await step.do(`process custom node "${id}"`, async () => {
            try {
              currentInput = await node.fn(context)
              Object.assign(context, { currentInput })
            } catch (error) {
              await addGenerationProgress({ event: `error in node "${id}"` })
              throw error
            }
          })

          await step.do(`store result after custom node "${id}"`, async () => {
            await bucket.put(`gen/${instanceId}.json`, JSON.stringify(currentInput))
          })
          break
        case 'control':
          await step.do(`process control node "${id}"`, async () => {
            const action = node.fn(context)
            console.log(`Control node "${id}" evaluated to`, action)
            let targetId = ''
            switch (typeof action) {
              case 'string':
                switch (action) {
                  case 'startOver':
                    console.log('starting over chain execution as defined in control node')
                    jumpAfterControlNode = 0
                    break
                }
                break
              case 'object':
                if ('jumpBack' in action || 'jumpForward' in action) {
                  targetId = 'jumpBack' in action
                    ? action.jumpBack
                    : action.jumpForward
                  const target = idToIndexMap.get(targetId)
                  if (typeof target === 'number') {
                    console.log(`jumping to node ${target} "${targetId}" as defined in control node`)
                    jumpAfterControlNode = target
                  } else {
                    console.warn(`jump directive points at unknown node "${targetId}" - silently ignoring this logic`)
                  }
                  break
                }
                else if ('raiseError' in action) {
                  const { raiseError } = action
                  console.log('raising error as defined in control node')
                  throw raiseError
                }
            }
            return { action, nextNode: jumpAfterControlNode, targetId }
          })
          break
        default: throw new NonRetryableError(`unsupported node type ${type}`)
      }

      await step.do(`complete node ${i}: ${id} (${type})`, async () => {
        const s = Math.floor((performance.now() - start) * 1e-3)
        const m = Math.floor(s / 60)
        const r = s % 60
        const f = `${m}:${r.toString().padStart(2, '0')}`
        await addGenerationProgress({
          event: `nodeCompleted "${id}" (${f} since start)`,
          result: currentInput,
        })
      })

      // } catch (error) {
      //   const dec = await step.waitForEvent<DecisionAfterErrorPayload>('decision after error', {
      //     type: 'decision-after-error' satisfies DecisionAfterErrorEvent['type'],
      //     timeout: '2 hours',
      //   })
      //   switch (dec.payload) {
      //     case 'retry':
      //       await addGenerationProgress({ event: `retrying step ${i}...` })
      //       i--
      //       continue
      //     default:
      //       await addGenerationProgress({ event: 'failed due to error' })
      //     // eslint-disable-next-line no-fallthrough
      //     case 'abort':
      //       throw error
      //   }
      // }
    }

    await step.do('complete generation', async () => {
      await addGenerationProgress({
        event: `processCompleted`,
        result: currentInput,
      })
    })
  }
}
export default {
  async fetch(req: Request, env: Cloudflare.Env): Promise<Response> {
    return Response.error()
  },
}
