/* eslint-disable @typescript-eslint/unified-signatures */
declare namespace Cloudflare {
  interface Env {
    GENERATION_WORKFLOW: Workflow<{
      requestId: string
      toolId: string
      userInput: Record<string, string>
    }>
    DB: D1Database
    BUCKET: R2Bucket
    PROGRESS_QUEUE: Queue<{ request: string, event: string, result?: any }>
  }
}
type DecisionAfterErrorPayload = 'abort' | 'retry'
type DecisionAfterErrorEvent = {
  type: 'decision-after-error'
  payload: DecisionAfterErrorPayload
}
interface R2Error extends Error {
  readonly name: string
  readonly code: number
  readonly message: string
  readonly action: string
  readonly stack: any
}
interface R2ListOptions {
  limit?: number
  prefix?: string
  cursor?: string
  delimiter?: string
  startAfter?: string
  include?: ('httpMetadata' | 'customMetadata')[]
}
declare abstract class R2Bucket {
  head(key: string): Promise<R2Object | null>
  get(key: string, options: R2GetOptions & {
    onlyIf: R2Conditional | Headers
  }): Promise<R2ObjectBody | R2Object | null>
  get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null>
  put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob, options?: R2PutOptions & {
    onlyIf: R2Conditional | Headers
  }): Promise<R2Object | null>
  put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob, options?: R2PutOptions): Promise<R2Object>
  createMultipartUpload(key: string, options?: R2MultipartOptions): Promise<R2MultipartUpload>
  resumeMultipartUpload(key: string, uploadId: string): R2MultipartUpload
  delete(keys: string | string[]): Promise<void>
  list(options?: R2ListOptions): Promise<R2Objects>
}
interface R2MultipartUpload {
  readonly key: string
  readonly uploadId: string
  uploadPart(partNumber: number, value: ReadableStream | (ArrayBuffer | ArrayBufferView) | string | Blob, options?: R2UploadPartOptions): Promise<R2UploadedPart>
  abort(): Promise<void>
  complete(uploadedParts: R2UploadedPart[]): Promise<R2Object>
}
interface R2UploadedPart {
  partNumber: number
  etag: string
}
declare abstract class R2Object {
  readonly key: string
  readonly version: string
  readonly size: number
  readonly etag: string
  readonly httpEtag: string
  readonly checksums: R2Checksums
  readonly uploaded: Date
  readonly httpMetadata?: R2HTTPMetadata
  readonly customMetadata?: Record<string, string>
  readonly range?: R2Range
  readonly storageClass: string
  readonly ssecKeyMd5?: string
  writeHttpMetadata(headers: Headers): void
}
interface R2ObjectBody extends R2Object {
  get body(): ReadableStream
  get bodyUsed(): boolean
  arrayBuffer(): Promise<ArrayBuffer>
  bytes(): Promise<Uint8Array>
  text(): Promise<string>
  json<T>(): Promise<T>
  blob(): Promise<Blob>
}
type R2Range = {
  offset: number
  length?: number
} | {
  offset?: number
  length: number
} | {
  suffix: number
}
interface R2Conditional {
  etagMatches?: string
  etagDoesNotMatch?: string
  uploadedBefore?: Date
  uploadedAfter?: Date
  secondsGranularity?: boolean
}
interface R2GetOptions {
  onlyIf?: (R2Conditional | Headers)
  range?: (R2Range | Headers)
  ssecKey?: (ArrayBuffer | string)
}
interface R2PutOptions {
  onlyIf?: (R2Conditional | Headers)
  httpMetadata?: (R2HTTPMetadata | Headers)
  customMetadata?: Record<string, string>
  md5?: ((ArrayBuffer | ArrayBufferView) | string)
  sha1?: ((ArrayBuffer | ArrayBufferView) | string)
  sha256?: ((ArrayBuffer | ArrayBufferView) | string)
  sha384?: ((ArrayBuffer | ArrayBufferView) | string)
  sha512?: ((ArrayBuffer | ArrayBufferView) | string)
  storageClass?: string
  ssecKey?: (ArrayBuffer | string)
}
interface R2MultipartOptions {
  httpMetadata?: (R2HTTPMetadata | Headers)
  customMetadata?: Record<string, string>
  storageClass?: string
  ssecKey?: (ArrayBuffer | string)
}
interface R2Checksums {
  readonly md5?: ArrayBuffer
  readonly sha1?: ArrayBuffer
  readonly sha256?: ArrayBuffer
  readonly sha384?: ArrayBuffer
  readonly sha512?: ArrayBuffer
  toJSON(): R2StringChecksums
}
interface R2StringChecksums {
  md5?: string
  sha1?: string
  sha256?: string
  sha384?: string
  sha512?: string
}
interface R2HTTPMetadata {
  contentType?: string
  contentLanguage?: string
  contentDisposition?: string
  contentEncoding?: string
  cacheControl?: string
  cacheExpiry?: Date
}
type R2Objects = {
  objects: R2Object[]
  delimitedPrefixes: string[]
} & ({
  truncated: true
  cursor: string
} | {
  truncated: false
})
interface R2UploadPartOptions {
  ssecKey?: (ArrayBuffer | string)
}
interface D1Meta {
  duration: number
  size_after: number
  rows_read: number
  rows_written: number
  last_row_id: number
  changed_db: boolean
  changes: number
  /**
   * The region of the database instance that executed the query.
   */
  served_by_region?: string
  /**
   * True if-and-only-if the database instance that executed the query was the primary.
   */
  served_by_primary?: boolean
  timings?: {
    /**
     * The duration of the SQL query execution by the database instance. It doesn't include any network time.
     */
    sql_duration_ms: number
  }
}
interface D1Response {
  success: true
  meta: D1Meta & Record<string, unknown>
  error?: never
}
type D1Result<T = unknown> = D1Response & {
  results: T[]
}
interface D1ExecResult {
  count: number
  duration: number
}
type D1SessionConstraint =
  // Indicates that the first query should go to the primary, and the rest queries
  // using the same D1DatabaseSession will go to any replica that is consistent with
  // the bookmark maintained by the session (returned by the first query).
  'first-primary'
  // Indicates that the first query can go anywhere (primary or replica), and the rest queries
  // using the same D1DatabaseSession will go to any replica that is consistent with
  // the bookmark maintained by the session (returned by the first query).
  | 'first-unconstrained'
type D1SessionBookmark = string
declare abstract class D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
  exec(query: string): Promise<D1ExecResult>
  /**
   * Creates a new D1 Session anchored at the given constraint or the bookmark.
   * All queries executed using the created session will have sequential consistency,
   * meaning that all writes done through the session will be visible in subsequent reads.
   *
   * @param constraintOrBookmark Either the session constraint or the explicit bookmark to anchor the created session.
   */
  withSession(constraintOrBookmark?: D1SessionBookmark | D1SessionConstraint): D1DatabaseSession
  /**
   * @deprecated dump() will be removed soon, only applies to deprecated alpha v1 databases.
   */
  dump(): Promise<ArrayBuffer>
}
declare abstract class D1DatabaseSession {
  prepare(query: string): D1PreparedStatement
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
  /**
   * @returns The latest session bookmark across all executed queries on the session.
   *          If no query has been executed yet, `null` is returned.
   */
  getBookmark(): D1SessionBookmark | null
}
declare abstract class D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = unknown>(colName: string): Promise<T | null>
  first<T = Record<string, unknown>>(): Promise<T | null>
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
  raw<T = unknown[]>(options: {
    columnNames: true
  }): Promise<[
    string[],
    ...T[],
  ]>
  raw<T = unknown[]>(options?: {
    columnNames?: false
  }): Promise<T[]>
}
interface Container {
  get running(): boolean
  start(options?: ContainerStartupOptions): void
  monitor(): Promise<void>
  destroy(error?: any): Promise<void>
  signal(signo: number): void
  getTcpPort(port: number): Fetcher
}
interface ContainerStartupOptions {
  entrypoint?: string[]
  enableInternet: boolean
  env?: Record<string, string>
}
interface TlsOptions {
  expectedServerHostname?: string
}
interface SocketInfo {
  remoteAddress?: string
  localAddress?: string
}
interface Socket {
  get readable(): ReadableStream
  get writable(): WritableStream
  get closed(): Promise<void>
  get opened(): Promise<SocketInfo>
  get upgraded(): boolean
  get secureTransport(): 'on' | 'off' | 'starttls'
  close(): Promise<void>
  startTls(options?: TlsOptions): Socket
}
interface SocketOptions {
  secureTransport?: string
  allowHalfOpen: boolean
  highWaterMark?: (number | bigint)
}
interface SocketAddress {
  hostname: string
  port: number
}
type Fetcher<T extends Rpc.EntrypointBranded | undefined = undefined, Reserved extends string = never> = (T extends Rpc.EntrypointBranded ? Rpc.Provider<T, Reserved | 'fetch' | 'connect'> : unknown) & {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
  connect(address: SocketAddress | string, options?: SocketOptions): Socket
}
interface AlarmInvocationInfo {
  readonly isRetry: boolean
  readonly retryCount: number
}
interface SqlStorage {
  exec<T extends Record<string, SqlStorageValue>>(query: string, ...bindings: any[]): SqlStorageCursor<T>
  get databaseSize(): number
  Cursor: typeof SqlStorageCursor
  Statement: typeof SqlStorageStatement
}
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
declare abstract class SqlStorageStatement {
}
type SqlStorageValue = ArrayBuffer | string | number | null
declare abstract class SqlStorageCursor<T extends Record<string, SqlStorageValue>> {
  next(): {
    done?: false
    value: T
  } | {
    done: true
    value?: never
  }
  toArray(): T[]
  one(): T
  raw<U extends SqlStorageValue[]>(): IterableIterator<U>
  columnNames: string[]
  get rowsRead(): number
  get rowsWritten(): number;
  [Symbol.iterator](): IterableIterator<T>
}
interface DurableObject {
  fetch(request: Request): Response | Promise<Response>
  alarm?(alarmInfo?: AlarmInvocationInfo): void | Promise<void>
  webSocketMessage?(ws: WebSocket, message: string | ArrayBuffer): void | Promise<void>
  webSocketClose?(ws: WebSocket, code: number, reason: string, wasClean: boolean): void | Promise<void>
  webSocketError?(ws: WebSocket, error: unknown): void | Promise<void>
}
type DurableObjectStub<T extends Rpc.DurableObjectBranded | undefined = undefined> = Fetcher<T, 'alarm' | 'webSocketMessage' | 'webSocketClose' | 'webSocketError'> & {
  readonly id: DurableObjectId
  readonly name?: string
}
interface DurableObjectId {
  toString(): string
  equals(other: DurableObjectId): boolean
  readonly name?: string
}
interface DurableObjectNamespace<T extends Rpc.DurableObjectBranded | undefined = undefined> {
  newUniqueId(options?: DurableObjectNamespaceNewUniqueIdOptions): DurableObjectId
  idFromName(name: string): DurableObjectId
  idFromString(id: string): DurableObjectId
  get(id: DurableObjectId, options?: DurableObjectNamespaceGetDurableObjectOptions): DurableObjectStub<T>
  jurisdiction(jurisdiction: DurableObjectJurisdiction): DurableObjectNamespace<T>
}
type DurableObjectJurisdiction = 'eu' | 'fedramp'
interface DurableObjectNamespaceNewUniqueIdOptions {
  jurisdiction?: DurableObjectJurisdiction
}
type DurableObjectLocationHint = 'wnam' | 'enam' | 'sam' | 'weur' | 'eeur' | 'apac' | 'oc' | 'afr' | 'me'
interface DurableObjectNamespaceGetDurableObjectOptions {
  locationHint?: DurableObjectLocationHint
}
interface DurableObjectState {
  waitUntil(promise: Promise<any>): void
  readonly id: DurableObjectId
  readonly storage: DurableObjectStorage
  container?: Container
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>
  acceptWebSocket(ws: WebSocket, tags?: string[]): void
  getWebSockets(tag?: string): WebSocket[]
  setWebSocketAutoResponse(maybeReqResp?: WebSocketRequestResponsePair): void
  getWebSocketAutoResponse(): WebSocketRequestResponsePair | null
  getWebSocketAutoResponseTimestamp(ws: WebSocket): Date | null
  setHibernatableWebSocketEventTimeout(timeoutMs?: number): void
  getHibernatableWebSocketEventTimeout(): number | null
  getTags(ws: WebSocket): string[]
  abort(reason?: string): void
}
interface DurableObjectTransaction {
  get<T = unknown>(key: string, options?: DurableObjectGetOptions): Promise<T | undefined>
  get<T = unknown>(keys: string[], options?: DurableObjectGetOptions): Promise<Map<string, T>>
  list<T = unknown>(options?: DurableObjectListOptions): Promise<Map<string, T>>
  put<T>(key: string, value: T, options?: DurableObjectPutOptions): Promise<void>
  put<T>(entries: Record<string, T>, options?: DurableObjectPutOptions): Promise<void>
  delete(key: string, options?: DurableObjectPutOptions): Promise<boolean>
  delete(keys: string[], options?: DurableObjectPutOptions): Promise<number>
  rollback(): void
  getAlarm(options?: DurableObjectGetAlarmOptions): Promise<number | null>
  setAlarm(scheduledTime: number | Date, options?: DurableObjectSetAlarmOptions): Promise<void>
  deleteAlarm(options?: DurableObjectSetAlarmOptions): Promise<void>
}
interface DurableObjectStorage {
  get<T = unknown>(key: string, options?: DurableObjectGetOptions): Promise<T | undefined>
  get<T = unknown>(keys: string[], options?: DurableObjectGetOptions): Promise<Map<string, T>>
  list<T = unknown>(options?: DurableObjectListOptions): Promise<Map<string, T>>
  put<T>(key: string, value: T, options?: DurableObjectPutOptions): Promise<void>
  put<T>(entries: Record<string, T>, options?: DurableObjectPutOptions): Promise<void>
  delete(key: string, options?: DurableObjectPutOptions): Promise<boolean>
  delete(keys: string[], options?: DurableObjectPutOptions): Promise<number>
  deleteAll(options?: DurableObjectPutOptions): Promise<void>
  transaction<T>(closure: (txn: DurableObjectTransaction) => Promise<T>): Promise<T>
  getAlarm(options?: DurableObjectGetAlarmOptions): Promise<number | null>
  setAlarm(scheduledTime: number | Date, options?: DurableObjectSetAlarmOptions): Promise<void>
  deleteAlarm(options?: DurableObjectSetAlarmOptions): Promise<void>
  sync(): Promise<void>
  sql: SqlStorage
  transactionSync<T>(closure: () => T): T
  getCurrentBookmark(): Promise<string>
  getBookmarkForTime(timestamp: number | Date): Promise<string>
  onNextSessionRestoreBookmark(bookmark: string): Promise<string>
}
interface DurableObjectListOptions {
  start?: string
  startAfter?: string
  end?: string
  prefix?: string
  reverse?: boolean
  limit?: number
  allowConcurrency?: boolean
  noCache?: boolean
}
interface DurableObjectGetOptions {
  allowConcurrency?: boolean
  noCache?: boolean
}
interface DurableObjectGetAlarmOptions {
  allowConcurrency?: boolean
}
interface DurableObjectPutOptions {
  allowConcurrency?: boolean
  allowUnconfirmed?: boolean
  noCache?: boolean
}
interface DurableObjectSetAlarmOptions {
  allowConcurrency?: boolean
  allowUnconfirmed?: boolean
}
declare class WebSocketRequestResponsePair {
  constructor(request: string, response: string)
  get request(): string
  get response(): string
}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface TestController {
}
type QueueContentType = 'text' | 'bytes' | 'json' | 'v8'
interface Queue<Body = unknown> {
  send(message: Body, options?: QueueSendOptions): Promise<void>
  sendBatch(messages: Iterable<MessageSendRequest<Body>>, options?: QueueSendBatchOptions): Promise<void>
}
interface QueueSendOptions {
  contentType?: QueueContentType
  delaySeconds?: number
}
interface QueueSendBatchOptions {
  delaySeconds?: number
}
interface MessageSendRequest<Body = unknown> {
  body: Body
  contentType?: QueueContentType
  delaySeconds?: number
}
interface QueueRetryOptions {
  delaySeconds?: number
}
interface Message<Body = unknown> {
  readonly id: string
  readonly timestamp: Date
  readonly body: Body
  readonly attempts: number
  retry(options?: QueueRetryOptions): void
  ack(): void
}
interface MessageBatch<Body = unknown> {
  readonly messages: readonly Message<Body>[]
  readonly queue: string
  retryAll(options?: QueueRetryOptions): void
  ackAll(): void
}
interface ScheduledController {
  readonly scheduledTime: number
  readonly cron: string
  noRetry(): void
}
interface ScriptVersion {
  id?: string
  tag?: string
  message?: string
}
declare abstract class TailEvent extends ExtendableEvent {
  readonly events: TraceItem[]
  readonly traces: TraceItem[]
}
interface TraceItem {
  readonly event: (TraceItemFetchEventInfo | TraceItemJsRpcEventInfo | TraceItemScheduledEventInfo | TraceItemAlarmEventInfo | TraceItemQueueEventInfo | TraceItemEmailEventInfo | TraceItemTailEventInfo | TraceItemCustomEventInfo | TraceItemHibernatableWebSocketEventInfo) | null
  readonly eventTimestamp: number | null
  readonly logs: TraceLog[]
  readonly exceptions: TraceException[]
  readonly diagnosticsChannelEvents: TraceDiagnosticChannelEvent[]
  readonly scriptName: string | null
  readonly entrypoint?: string
  readonly scriptVersion?: ScriptVersion
  readonly dispatchNamespace?: string
  readonly scriptTags?: string[]
  readonly outcome: string
  readonly executionModel: string
  readonly truncated: boolean
  readonly cpuTime: number
  readonly wallTime: number
}
interface TraceItemAlarmEventInfo {
  readonly scheduledTime: Date
}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface TraceItemCustomEventInfo {
}
interface TraceItemScheduledEventInfo {
  readonly scheduledTime: number
  readonly cron: string
}
interface TraceItemQueueEventInfo {
  readonly queue: string
  readonly batchSize: number
}
interface TraceItemEmailEventInfo {
  readonly mailFrom: string
  readonly rcptTo: string
  readonly rawSize: number
}
interface TraceItemTailEventInfo {
  readonly consumedEvents: TraceItemTailEventInfoTailItem[]
}
interface TraceItemTailEventInfoTailItem {
  readonly scriptName: string | null
}
interface TraceItemFetchEventInfo {
  readonly response?: TraceItemFetchEventInfoResponse
  readonly request: TraceItemFetchEventInfoRequest
}
interface TraceItemFetchEventInfoRequest {
  readonly cf?: any
  readonly headers: Record<string, string>
  readonly method: string
  readonly url: string
  getUnredacted(): TraceItemFetchEventInfoRequest
}
interface TraceItemFetchEventInfoResponse {
  readonly status: number
}
interface TraceItemJsRpcEventInfo {
  readonly rpcMethod: string
}
interface TraceItemHibernatableWebSocketEventInfo {
  readonly getWebSocketEvent: TraceItemHibernatableWebSocketEventInfoMessage | TraceItemHibernatableWebSocketEventInfoClose | TraceItemHibernatableWebSocketEventInfoError
}
interface TraceItemHibernatableWebSocketEventInfoMessage {
  readonly webSocketEventType: string
}
interface TraceItemHibernatableWebSocketEventInfoClose {
  readonly webSocketEventType: string
  readonly code: number
  readonly wasClean: boolean
}
interface TraceItemHibernatableWebSocketEventInfoError {
  readonly webSocketEventType: string
}
interface TraceLog {
  readonly timestamp: number
  readonly level: string
  readonly message: any
}
interface TraceException {
  readonly timestamp: number
  readonly message: string
  readonly name: string
  readonly stack?: string
}
interface TraceDiagnosticChannelEvent {
  readonly timestamp: number
  readonly channel: string
  readonly message: any
}
interface TraceMetrics {
  readonly cpuTime: number
  readonly wallTime: number
}
interface UnsafeTraceMetrics {
  fromTrace(item: TraceItem): TraceMetrics
}
type TypedArray = Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array | BigInt64Array | BigUint64Array

interface ExecutionContext {
  waitUntil(promise: Promise<any>): void
  passThroughOnException(): void
  props: any
}

// Namespace for RPC utility types. Unfortunately, we can't use a `module` here as these types need
// to referenced by `Fetcher`. This is included in the "importable" version of the types which
// strips all `module` blocks.
declare namespace Rpc {
  // Branded types for identifying `WorkerEntrypoint`/`DurableObject`/`Target`s.
  // TypeScript uses *structural* typing meaning anything with the same shape as type `T` is a `T`.
  // For the classes exported by `cloudflare:workers` we want *nominal* typing (i.e. we only want to
  // accept `WorkerEntrypoint` from `cloudflare:workers`, not any other class with the same shape)
  export const __RPC_STUB_BRAND: '__RPC_STUB_BRAND'
  export const __RPC_TARGET_BRAND: '__RPC_TARGET_BRAND'
  export const __WORKER_ENTRYPOINT_BRAND: '__WORKER_ENTRYPOINT_BRAND'
  export const __DURABLE_OBJECT_BRAND: '__DURABLE_OBJECT_BRAND'
  export const __WORKFLOW_ENTRYPOINT_BRAND: '__WORKFLOW_ENTRYPOINT_BRAND'
  export interface RpcTargetBranded {
    [__RPC_TARGET_BRAND]: never
  }
  export interface WorkerEntrypointBranded {
    [__WORKER_ENTRYPOINT_BRAND]: never
  }
  export interface DurableObjectBranded {
    [__DURABLE_OBJECT_BRAND]: never
  }
  export interface WorkflowEntrypointBranded {
    [__WORKFLOW_ENTRYPOINT_BRAND]: never
  }
  export type EntrypointBranded = WorkerEntrypointBranded | DurableObjectBranded | WorkflowEntrypointBranded
  // Types that can be used through `Stub`s
  export type Stubable = RpcTargetBranded | ((...args: any[]) => any)
  // Types that can be passed over RPC
  // The reason for using a generic type here is to build a serializable subset of structured
  //   cloneable composite types. This allows types defined with the "interface" keyword to pass the
  //   serializable check as well. Otherwise, only types defined with the "type" keyword would pass.
  type Serializable<T> =
    // Structured cloneables
    BaseType
    // Structured cloneable composites
    | Map<T extends Map<infer U, unknown> ? Serializable<U> : never, T extends Map<unknown, infer U> ? Serializable<U> : never> | Set<T extends Set<infer U> ? Serializable<U> : never> | ReadonlyArray<T extends ReadonlyArray<infer U> ? Serializable<U> : never> | {
      [K in keyof T]: K extends number | string ? Serializable<T[K]> : never;
    }
    // Special types
    | Stub<Stubable>
    // Serialized as stubs, see `Stubify`
    | Stubable
  // Base type for all RPC stubs, including common memory management methods.
  // `T` is used as a marker type for unwrapping `Stub`s later.
  interface StubBase<T extends Stubable> extends Disposable {
    [__RPC_STUB_BRAND]: T
    dup(): this
  }
  export type Stub<T extends Stubable> = Provider<T> & StubBase<T>
  // This represents all the types that can be sent as-is over an RPC boundary
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  type BaseType = void | undefined | null | boolean | number | bigint | string | TypedArray | ArrayBuffer | DataView | Date | Error | RegExp | ReadableStream<Uint8Array> | WritableStream<Uint8Array> | Request | Response | Headers
  // Recursively rewrite all `Stubable` types with `Stub`s
  // prettier-ignore
  type Stubify<T> = T extends Stubable ? Stub<T> : T extends Map<infer K, infer V> ? Map<Stubify<K>, Stubify<V>> : T extends Set<infer V> ? Set<Stubify<V>> : T extends Array<infer V> ? Array<Stubify<V>> : T extends ReadonlyArray<infer V> ? ReadonlyArray<Stubify<V>> : T extends BaseType ? T : T extends {
    [key: string | number]: any
  } ? {
        [K in keyof T]: Stubify<T[K]>;
      } : T
  // Recursively rewrite all `Stub<T>`s with the corresponding `T`s.
  // Note we use `StubBase` instead of `Stub` here to avoid circular dependencies:
  // `Stub` depends on `Provider`, which depends on `Unstubify`, which would depend on `Stub`.
  // prettier-ignore
  type Unstubify<T> = T extends StubBase<infer V> ? V : T extends Map<infer K, infer V> ? Map<Unstubify<K>, Unstubify<V>> : T extends Set<infer V> ? Set<Unstubify<V>> : T extends Array<infer V> ? Array<Unstubify<V>> : T extends ReadonlyArray<infer V> ? ReadonlyArray<Unstubify<V>> : T extends BaseType ? T : T extends {
    [key: string | number]: unknown
  } ? {
        [K in keyof T]: Unstubify<T[K]>;
      } : T
  type UnstubifyAll<A extends any[]> = {
    [I in keyof A]: Unstubify<A[I]>;
  }
  // Utility type for adding `Provider`/`Disposable`s to `object` types only.
  // Note `unknown & T` is equivalent to `T`.
  type MaybeProvider<T> = T extends object ? Provider<T> : unknown
  type MaybeDisposable<T> = T extends object ? Disposable : unknown
  // Type for method return or property on an RPC interface.
  // - Stubable types are replaced by stubs.
  // - Serializable types are passed by value, with stubable types replaced by stubs
  //   and a top-level `Disposer`.
  // Everything else can't be passed over PRC.
  // Technically, we use custom thenables here, but they quack like `Promise`s.
  // Intersecting with `(Maybe)Provider` allows pipelining.
  // prettier-ignore
  type Result<R> = R extends Stubable ? Promise<Stub<R>> & Provider<R> : R extends Serializable<R> ? Promise<Stubify<R> & MaybeDisposable<R>> & MaybeProvider<R> : never
  // Type for method or property on an RPC interface.
  // For methods, unwrap `Stub`s in parameters, and rewrite returns to be `Result`s.
  // Unwrapping `Stub`s allows calling with `Stubable` arguments.
  // For properties, rewrite types to be `Result`s.
  // In each case, unwrap `Promise`s.
  type MethodOrProperty<V> = V extends (...args: infer P) => infer R ? (...args: UnstubifyAll<P>) => Result<Awaited<R>> : Result<Awaited<V>>
  // Type for the callable part of an `Provider` if `T` is callable.
  // This is intersected with methods/properties.
  type MaybeCallableProvider<T> = T extends (...args: any[]) => any ? MethodOrProperty<T> : unknown
  // Base type for all other types providing RPC-like interfaces.
  // Rewrites all methods/properties to be `MethodOrProperty`s, while preserving callable types.
  // `Reserved` names (e.g. stub method names like `dup()`) and symbols can't be accessed over RPC.
  export type Provider<T extends object, Reserved extends string = never> = MaybeCallableProvider<T> & {
    [K in Exclude<keyof T, Reserved | symbol | keyof StubBase<never>>]: MethodOrProperty<T[K]>;
  }
}
declare module 'cloudflare:workers' {
  export type RpcStub<T extends Rpc.Stubable> = Rpc.Stub<T>
  export const RpcStub: {
    new<T extends Rpc.Stubable>(value: T): Rpc.Stub<T>
  }
  export abstract class RpcTarget implements Rpc.RpcTargetBranded {
    [Rpc.__RPC_TARGET_BRAND]: never
  }
  // `protected` fields don't appear in `keyof`s, so can't be accessed over RPC
  export abstract class WorkerEntrypoint<Env = unknown> implements Rpc.WorkerEntrypointBranded {
    [Rpc.__WORKER_ENTRYPOINT_BRAND]: never
    protected ctx: ExecutionContext
    protected env: Env
    constructor(ctx: ExecutionContext, env: Env)
    fetch?(request: Request): Response | Promise<Response>
    tail?(events: TraceItem[]): void | Promise<void>
    trace?(traces: TraceItem[]): void | Promise<void>
    scheduled?(controller: ScheduledController): void | Promise<void>
    queue?(batch: MessageBatch<unknown>): void | Promise<void>
    test?(controller: TestController): void | Promise<void>
  }
  export abstract class DurableObject<Env = unknown> implements Rpc.DurableObjectBranded {
    [Rpc.__DURABLE_OBJECT_BRAND]: never
    protected ctx: DurableObjectState
    protected env: Env
    constructor(ctx: DurableObjectState, env: Env)
    fetch?(request: Request): Response | Promise<Response>
    alarm?(alarmInfo?: AlarmInvocationInfo): void | Promise<void>
    webSocketMessage?(ws: WebSocket, message: string | ArrayBuffer): void | Promise<void>
    webSocketClose?(ws: WebSocket, code: number, reason: string, wasClean: boolean): void | Promise<void>
    webSocketError?(ws: WebSocket, error: unknown): void | Promise<void>
  }
  export type WorkflowDurationLabel = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'
  export type WorkflowSleepDuration = `${number} ${WorkflowDurationLabel}${'s' | ''}` | number
  export type WorkflowDelayDuration = WorkflowSleepDuration
  export type WorkflowTimeoutDuration = WorkflowSleepDuration
  export type WorkflowRetentionDuration = WorkflowSleepDuration
  export type WorkflowBackoff = 'constant' | 'linear' | 'exponential'
  export type WorkflowStepConfig = {
    retries?: {
      limit: number
      delay: WorkflowDelayDuration | number
      backoff?: WorkflowBackoff
    }
    timeout?: WorkflowTimeoutDuration | number
  }
  export type WorkflowEvent<T> = {
    payload: Readonly<T>
    timestamp: Date
    instanceId: string
  }
  export type WorkflowStepEvent<T> = {
    payload: Readonly<T>
    timestamp: Date
    type: string
  }
  export abstract class WorkflowStep {
    do<T extends Rpc.Serializable<T>>(name: string, callback: () => Promise<T>): Promise<T>
    do<T extends Rpc.Serializable<T>>(name: string, config: WorkflowStepConfig, callback: () => Promise<T>): Promise<T>
    sleep: (name: string, duration: WorkflowSleepDuration) => Promise<void>
    sleepUntil: (name: string, timestamp: Date | number) => Promise<void>
    waitForEvent<T extends Rpc.Serializable<T>>(name: string, options: {
      type: string
      timeout?: WorkflowTimeoutDuration | number
    }): Promise<WorkflowStepEvent<T>>
  }
  export abstract class WorkflowEntrypoint<Env = unknown, T extends Rpc.Serializable<T> | unknown = unknown> implements Rpc.WorkflowEntrypointBranded {
    [Rpc.__WORKFLOW_ENTRYPOINT_BRAND]: never
    protected ctx: ExecutionContext
    protected env: Env
    constructor(ctx: ExecutionContext, env: Env)
    run(event: Readonly<WorkflowEvent<T>>, step: WorkflowStep): Promise<unknown>
  }
  export const env: Cloudflare.Env
}

declare module 'cloudflare:workflows' {
  /**
   * NonRetryableError allows for a user to throw a fatal error
   * that makes a Workflow instance fail immediately without triggering a retry
   */
  export class NonRetryableError extends Error {
    public constructor(message: string, name?: string)
  }
}
declare abstract class Workflow<PARAMS = unknown> {
  /**
   * Get a handle to an existing instance of the Workflow.
   * @param id Id for the instance of this Workflow
   * @returns A promise that resolves with a handle for the Instance
   */
  public get(id: string): Promise<WorkflowInstance>
  /**
   * Create a new instance and return a handle to it. If a provided id exists, an error will be thrown.
   * @param options Options when creating an instance including id and params
   * @returns A promise that resolves with a handle for the Instance
   */
  public create(options?: WorkflowInstanceCreateOptions<PARAMS>): Promise<WorkflowInstance>
  /**
   * Create a batch of instances and return handle for all of them. If a provided id exists, an error will be thrown.
   * `createBatch` is limited at 100 instances at a time or when the RPC limit for the batch (1MiB) is reached.
   * @param batch List of Options when creating an instance including name and params
   * @returns A promise that resolves with a list of handles for the created instances.
   */
  public createBatch(batch: WorkflowInstanceCreateOptions<PARAMS>[]): Promise<WorkflowInstance[]>
}
type WorkflowDurationLabel = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'
type WorkflowSleepDuration = `${number} ${WorkflowDurationLabel}${'s' | ''}` | number
type WorkflowRetentionDuration = WorkflowSleepDuration
interface WorkflowInstanceCreateOptions<PARAMS = unknown> {
  /**
   * An id for your Workflow instance. Must be unique within the Workflow.
   */
  id?: string
  /**
   * The event payload the Workflow instance is triggered with
   */
  params?: PARAMS
  /**
   * The retention policy for Workflow instance.
   * Defaults to the maximum retention period available for the owner's account.
   */
  retention?: {
    successRetention?: WorkflowRetentionDuration
    errorRetention?: WorkflowRetentionDuration
  }
}
type InstanceStatus = {
  status: 'queued' // means that instance is waiting to be started (see concurrency limits)
    | 'running' | 'paused' | 'errored' | 'terminated' // user terminated the instance while it was running
    | 'complete' | 'waiting' // instance is hibernating and waiting for sleep or event to finish
    | 'waitingForPause' // instance is finishing the current work to pause
    | 'unknown'
  error?: string
  output?: object
}
interface WorkflowError {
  code?: number
  message: string
}
declare abstract class WorkflowInstance {
  public id: string
  /**
   * Pause the instance.
   */
  public pause(): Promise<void>
  /**
   * Resume the instance. If it is already running, an error will be thrown.
   */
  public resume(): Promise<void>
  /**
   * Terminate the instance. If it is errored, terminated or complete, an error will be thrown.
   */
  public terminate(): Promise<void>
  /**
   * Restart the instance.
   */
  public restart(): Promise<void>
  /**
   * Returns the current status of the instance.
   */
  public status(): Promise<InstanceStatus>
  /**
   * Send an event to this instance.
   */
  public sendEvent({ type, payload }: {
    type: string
    payload: unknown
  }): Promise<void>
}
