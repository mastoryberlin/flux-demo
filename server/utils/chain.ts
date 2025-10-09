import type { FromSchema, JSONSchema } from 'json-schema-to-ts'
import type { H3Event } from 'h3'
// import type { ModelAlias, Model } from '../prompt-chains/models'
// import type { PassedData, AIResult } from '~~/types'
// import type { MastoryColorName } from '#shared/types/colors'
// import type { SupportedLocale, Localized } from '~~/modules/mastory/types/localized'
import type { ToolId } from '#tools'
import { allLocales } from '#shared/utils/i18n'
import { pickRandomArrayItem } from '#shared/utils/convenience'

type ModelAlias = string
type Model = Record<string, any>
type SupportedLocale = 'en' | 'de' | 'hu'
type Localized = Record<string, unknown>
type MastoryColorName = string
type PassedData = Record<string, unknown>
type AIResult = {
  output: { markdown: string, [key: string]: any } | { variants: { markdown: string, [key: string]: any }[] } | null
}

type Schema = JSONSchema & { type: 'object' }

export type Context<I, U, P> = Localized & {
  currentInput: I
  userInput: U
  previousOutputs: P
}

type TransformFn<I, U, P, To extends string | PassedData> = (context: Context<I, U, P>) => To
type TransformNode<I, U, P, To extends string | PassedData> = {
  type: 'transform'
  id: string
  fn: TransformFn<I, U, P, To>
}

export type PromptNodeDef<M extends ModelAlias, O extends Schema | undefined> = {
  model?: M
  outputSchema?: O
  /**
   * The sequence of messages that will be sent over to the AI model.
   */
  messages: {
    type: 'system' | 'user' | 'assistant'
    message: string
  }[]
  callOptions?: 'defaultCallOptions' extends keyof Model[M] ? Partial<Model[M]['defaultCallOptions']> : never
  config?: 'defaultConfig' extends keyof Model[M] ? Partial<Model[M]['defaultConfig']> : never
  removeThinking?: boolean
}
export type NewPromptNode<M extends ModelAlias, O extends Schema | undefined> = {
  type: 'prompt'
  id: string
  def: PromptNodeDef<M, O> | ((context: Context<any, any, any>) => PromptNodeDef<M, O>)
}

type JumpAction<P extends Record<string, any>> =
  | 'startOver'
  | { jumpBack: keyof P & string }
  | { jumpForward: string }
  | { raiseError: string }
type Action<P> =
  | (P extends Record<string, any> ? JumpAction<P> : never)

type ControlFn<I, U, P> = (context: Context<I, U, P>) => Action<P> | undefined
type ControlNode<I, U, P> = {
  type: 'control'
  id: string
  fn: ControlFn<I, U, P>
}

type ParallelFn<I, U, P, N extends number, To> = (context: Context<I, U, P>, i: number) => To
type ParallelNode<I, U, P, N extends number, To, M extends ModelAlias, O extends Schema | undefined> = {
  type: 'parallel'
  id: string
  maxParallelExecutions: N
  mapFn: ParallelFn<I, U, P, N, To>
  prompt: PromptNodeDef<M, O> | ((context: Context<To, U, P>, index: number) => PromptNodeDef<M, O> | undefined)
}

type CustomFn<I, U, P, To extends undefined | string | PassedData | Promise<undefined | string | PassedData>> = (context: Context<I, U, P>) => To
type CustomNode<I, U, P, To extends undefined | string | PassedData | Promise<undefined | string | PassedData>> = {
  type: 'custom'
  id: string
  fn: CustomFn<I, U, P, To>
}

export type AnyNode =
  | TransformNode<any, any, any, any>
  | NewPromptNode<any, any>
  | ControlNode<any, any, any>
  | ParallelNode<any, any, any, any, any, any, any>
  | CustomNode<any, any, any, any>

export function isTransformNode(node: AnyNode): node is TransformNode<any, any, any, any> {
  return node.type === 'transform'
}
export function isPromptNode(node: AnyNode): node is NewPromptNode<any, any> {
  return node.type === 'prompt'
}
export function isControlNode(node: AnyNode): node is ControlNode<any, any, any> {
  return node.type === 'control'
}
export function isParallelNode(node: AnyNode): node is ParallelNode<any, any, any, any, any, any, any> {
  return node.type === 'parallel'
}
export function isCustomNode(node: AnyNode): node is CustomNode<any, any, any, any> {
  return node.type === 'custom'
}

type FinalResult<R> = NonNullable<AIResult['output']> & (R extends PassedData
  ? R extends { variants: (infer Rs)[] }
    ? Rs
    : R
  : R)
type WithAllResultsMissingHint = 'This property is only available if you add the "withAllResults" flag to the "offerFollowUp" call'
export type FollowUpContext<U = PassedData, CU = PassedData, R = PassedData, AllResults extends FinalResult<R>[] | WithAllResultsMissingHint = WithAllResultsMissingHint> = {
  /**
   * The exact data which the user has input in the previous request.
   */
  lastUserInput: U
  /**
   * All data the user has entered in the course of this message thread,
   * combined using a defu merge operation.
   */
  userInput: CU
  /**
   * The response part corresponding to the previous request,
   * accessed as an array of the actual output data of each result.
   *
   * NOTE: This property is only available if the `withAllResults` flag
   * was set on the previous tool's `offerFollowUp` invocation.
   *
   * Only use this property if you need to access all or several of
   * the latest results. If you are only interested in the particular result
   * selected by the user, use `result` instead.
   *
   * @see indexOfSelectedResult
   * @see result
   */
  allResults: AllResults
  /**
   * The single result corresponding to the previous request;
   * or, if there were multiple results to pick from, the one
   * selected by the user at the time this function is called.
   *
   * If you need to access all or several of the latest results
   * simultaneously, use `allResults` instead.
   *
   * @see allResults
   * @see indexOfSelectedResult
   */
  result: FinalResult<R> // = allResults[indexOfSelectedResult]
  /**
   * If the previous request led to multiple results,
   * this property carries the index of the result selected
   * by the user at the time of invocation.
   *
   * @default 0
   * @see allResults
   * @see result
   */
  indexOfSelectedResult: number
}
export type StoredFollowUpContext = Omit<FollowUpContext<PassedData, PassedData, PassedData>, 'result' | 'indexOfSelectedResult' | 'allResults'>
export type FollowUpDef<U, CU, R> = {
  id: ToolId
  options: {
    /**
     * Defines a piece of logic to transform this chain's output(s) so it
     * seamlessly connects to the follow-up chain as its input.
     *
     * If this option is left out, this chain's last produced output will
     * be passed as an input to the follow-up chain as-is.
     *
     * @returns A suitable value (string or object) used as the next (follow-up) chain's input.
     */
    withInput: (context: FollowUpContext<U, CU, R, WithAllResultsMissingHint>) => any

    /**
     * If set to `true`, adds the `allResults` property to the follow-up context
     * with all results loaded regardless of which one the user has selected.
     */
    withAllResults?: false
  } | {
    /**
     * Defines a piece of logic to transform this chain's output(s) so it
     * seamlessly connects to the follow-up chain as its input.
     *
     * If this option is left out, this chain's last produced output will
     * be passed as an input to the follow-up chain as-is.
     *
     * @returns A suitable value (string or object) used as the next (follow-up) chain's input.
     */
    withInput: (context: FollowUpContext<U, CU, R, FinalResult<R>[]>) => any

    /**
     * If set to `true`, adds the `allResults` property to the follow-up context
     * with all results loaded regardless of which one the user has selected.
     */
    withAllResults: true
  }
}

type Registry<U extends Schema = Schema> = {
  chainId: string
  meta: ChainMeta
  userInputSchema: U
  nodes: AnyNode[]
  followUps: FollowUpDef<PassedData, PassedData, PassedData>[]
}
function tail<I, U, const P>(registry: Registry) {
  return {
    // extending the pipe with chain calls
    transform<R extends string | PassedData, const Id extends string>(id: Id, fn: TransformFn<I, U, P, R>) {
      registry.nodes.push(<TransformNode<I, U, P, R>>{ type: 'transform', id, fn })
      type To = R extends string ? { markdown: string } : R
      return tail<To, U, P & { [id in Id]: To }>(registry)
    },
    prompt<const Id extends string, const M extends ModelAlias, const O extends Schema | undefined = undefined>(id: Id, def: PromptNodeDef<M, O> | ((context: Context<I, U, P>) => PromptNodeDef<M, O>)) {
      type To = O extends object ? FromSchema<O> & PassedData : { markdown: string }
      registry.nodes.push(<NewPromptNode<M, O>>{
        type: 'prompt', id, def,
      })
      return tail<To, U, P & { [id in Id]: To }>(registry)
    },
    control<const Id extends string>(id: Id, fn: ControlFn<I, U, P>) {
      type To = I
      registry.nodes.push(<ControlNode<I, U, P>>{ type: 'control', id, fn })
      return tail<To, U, P & { [id in Id]: To }>(registry)
    },
    custom<const Id extends string, R extends undefined | string | PassedData | Promise<undefined | string | PassedData>>(id: Id, fn: CustomFn<I, U, P, R>) {
      type To = R extends Promise<infer T>
        ? (T extends string ? { markdown: string } : T)
        : R extends string ? { markdown: string } : R
      registry.nodes.push(<CustomNode<I, U, P, R>>{ type: 'custom', id, fn })
      return tail<To, U, P & { [id in Id]: To }>(registry)
    },
    promptParallel<const Id extends string, const N extends number, MappedInput, const O extends Schema | undefined>(
      id: Id,
      maxParallelExecutions: N,
      mapFn: (context: Context<I, U, P>, index: number) => MappedInput,
      prompt: PromptNodeDef<ModelAlias, O> | ((context: Context<MappedInput, U, P>, index: number) => PromptNodeDef<ModelAlias, O> | undefined),
    ) {
      type To = O extends object ? FromSchema<O> & PassedData : I
      registry.nodes.push(/* <ParallelNode<I, U, P, N, To, M, O>> */{
        type: 'parallel', id, mapFn, prompt, maxParallelExecutions,
      })
      return tail<
        /* MappedTypeToTuple<
          Decrement<N> extends number ? Decrement<N> : 0,
          Record<number, To | null>
        > */
        (To | null)[], U, P & { [id in Id]: To | null }
      >(registry)
    },
    /**
     * Includes another (or the same) prompt chain in the list of
     * follow-up tools offered to the user after this chain's response.
     *
     * @param id The ID of the chain to be included in follow-up offerings.
     */
    offerFollowUp<const FId extends ToolId>(id: FId, options: FollowUpDef<U, U & PassedData, I>['options']) {
      registry.followUps.push({ id, options } as FollowUpDef<PassedData, PassedData, PassedData>)
      return tail<I, U, P>(registry)
    },

    // ways to use the chain once it is completed
    use() {
      return {
        id: registry.chainId as ToolId,
        ...registry,
        __inputSchemaType(arg: U) {},
        __finalOutputType(arg: I) { },
        test(userInput: U): I {
          let currentInput = userInput as any
          console.log('Starting with userInput', userInput)
          const previousOutputs: Record<string, any> = {}
          const l = pickRandomArrayItem(allLocales)
          for (const node of registry.nodes) {
            console.log(`Processing node ${node.id} in locale ${l} ...`)
            if (isTransformNode(node)) {
              currentInput = node.fn({ currentInput, userInput, previousOutputs, locale: l })
            }
            console.log('currentInput is now', currentInput)
            previousOutputs[node.id] = currentInput
          }
          return currentInput as I
        },
      }
    },
  }
}

export function removeThinking<I, U, const P>({ currentInput }: Context<I, U, P>) {
  function remove<T>(o: T) {
    const i = o as { markdown: string }
    i.markdown = i.markdown.replace(/<think>.*?<\/think>/gi, '').trim()
    return i as T
  }

  if (typeof currentInput === 'string') {
    return remove({ markdown: currentInput })
  } else if (Array.isArray(currentInput)) {
    return currentInput.map(remove) as I
  } else {
    return remove(currentInput)
  }
}

export type Chain = ReturnType<ReturnType<typeof tail>['use']>
export type PublicChainInfo = Pick<Chain, 'id' | 'meta' | 'followUps' | 'userInputSchema'>
export type FinalChainOutput<T extends Chain> = Parameters<T['__finalOutputType']>[0]
type ChainInput<T extends Chain> = Parameters<T['__inputSchemaType']>[0]

export type RenderComponent =
  | 'WordProblem' | { name: 'WordProblem' }

export type ChainMeta = {
  /**
   * The title shown on the card for this prompt chain
   * in the tools / crafts collection.
   */
  title: string
  /**
   * When sharing the results of this tool using magic links,
   * don't require visitors to create an account in order to see them.
   */
  dontEnforceAccountToViewSharedResults?: boolean
  /**
   * Don't translate previous results and user input before processing.
   * When setting this property to `true`, it is recommended to use the function syntax
   * for all prompt node definitions in order to use locale-specific prompts.
   */
  dontTranslate?: boolean
  /**
   * The background color for the tool pill.
   */
  color: MastoryColorName
  /**
   * The text shown on the card for this prompt chain
   * in the tools / crafts collection.
   */
  text: string
  /**
   * The expected, typical or average time in seconds
   * that it will take this tool to complete.
   * This value is used to estimate the remaining time
   * while the user is waiting for a generation result.
   */
  expectedDuration: number
  /**
   * URL of an image to show on the card for this prompt chain
   * in the tools / crafts collection.
   */
  thumbnailUrl?: string
  /**
   * A tutorial video showing how to use this tool.
   */
  tutorialVideoUrl?: string
  /**
   * A URL leading to the resource page associated with this tool.
   */
  resourceUrl?: string
  /**
   * If set to `true`, no card will be shown for this prompt chain
   * in the tools / crafts collection. The chain may still be selected as a
   * follow-up tool, as long as it is included in some other chain's
   * `followUpChains` property.
   */
  hideOnPromptSelectionPage?: boolean
  /**
   * If set to `true`, hide this prompt chain in production and preview.
   */
  draft?: boolean
  /**
   * If set to `true`, only show this prompt chain in local development.
   */
  devOnly?: boolean
  /**
   * If set to `true`, disregards the existence of this tool when determining
   * the list of supported follow-up tools, i.e. they will be those determined
   * by the *previous* tool call (if applicable).
   */
  offerPreviousFollowUps?: boolean
}

export function defineChain<const U extends Schema>(
  /**
   * The ID used to refer to this prompt chain.
   * This *MUST* be the same as the name of the subfolder below /server/prompt-chains
   * in which this chain is defined.
   */
  chainId: string,
  /**
   * Metadata on how this chain should be used and displayed.
   */
  meta: ChainMeta,
  userInputSchema: U,
) {
  const registry: Registry<U> = {
    chainId,
    meta,
    userInputSchema,
    nodes: [],
    followUps: [
      // {
      //   id: 'modify',
      //   options: {
      //     withInput: ({ result }) => ({
      //       content: result,
      //     }),
      //   },
      // },
      // {
      //   id: 'translate',
      //   options: {
      //     withInput: ({ result }) => ({
      //       content: result
      //     }),
      //   }
      // },
    ],
  }

  if (import.meta.server && import.meta.dev) {
    (async function () {
      const { $fetch } = await import('ofetch')
      try {
        $fetch('http://localhost:3000/_tools/meta', {
          method: 'POST',
          body: {
            id: chainId,
            meta,
            inputSchema: userInputSchema,
          },
          ignoreResponseError: true,
        })
      } catch (_) { }
    })()
  }
  return tail<FromSchema<U>, FromSchema<U>, object>(registry)
}

export const localizedPrompts = <const L extends string>(def: Record<SupportedLocale, Record<L, string>>) => def

// ========================================================================================================================
// An example to play with
// ========================================================================================================================

// const chain = defineChain('myChain', {
//   title: 'Example',
//   color: 'orange3',
//   text: 'A simple example chain',
//   expectedDuration: 1,
// }, {
//   type: 'object',
//   properties: {
//     myName: { type: 'string' },
//   },
//   required: ['myName'],
//   additionalProperties: false,
// })
//   .transform('t1', ({
//     currentInput: {
//       myName,
//     }
//   }) => ({
//     p1: true,
//     p2: myName,
//   }))
//   .transform('t2', ({
//     currentInput: { p1 },
//     userInput: { myName },
//   }) => ({
//     name: myName,
//     bool: p1,
//   }))
//   .transform('t3', ({
//     previousOutputs
//   }) => ({
//     x: previousOutputs.t1.p1 ? 23 : 'wow'
//   }))
//   .prompt('p1', {
//     outputSchema: {
//       type: 'object',
//       properties: {
//         fantasyStories: {
//           type: 'array',
//           items: { type: 'string' },
//           minItems: 3,
//           maxItems: 3,
//         },
//       },
//       required: ['fantasyStories'],
//       additionalProperties: false,
//     },
//     model: 'haiku',
//     messages: []
//   })
//   .promptParallel('b1', 3,
//     ({currentInput}, index) => ({
//       blu: currentInput.fantasyStories[index]
//     }),
//     ({previousOutputs}, index) => ({
//       model: 'r1',
//       messages: [],
//       outputSchema: {
//         type: 'object',
//         properties: {
//           blablabla: {
//             type: 'number',
//             minimum: index,
//             maximum: 2 * index,
//           }
//         },
//         additionalProperties: false,
//         required: ['blablabla']
//       }
//     })
//   )
//   .transform('t4', ({currentInput}) => ({
//     variants: [1, 2, 3].map(i => ({colored: `currentInput[2]!.blablabla${i}`})),
//   }))
//   .control('c1', ({}) => {
//     return {jumpForward: 'anotherNode'}
//   })
//   .offerFollowUp('translate', {
//     withInput: (c) => {
//       c.userInput.hello
//     }
//   })
//
// type T = FinalChainOutput<ReturnType<typeof chain['use']>>
