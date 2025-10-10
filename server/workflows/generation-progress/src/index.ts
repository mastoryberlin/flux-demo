import { DurableObject } from 'cloudflare:workers'
import { ofetch } from "ofetch"

export interface Env {
	GENERATION_PROGRESS_SERVER: DurableObjectNamespace<GenerationProgressServer>
}

export interface ProgressMessage {
	request: string
	event: string
}

// const urlRe = /\/ws\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/
const urlRe = /\/ws\/(.*)$/

// Durable Object
export class GenerationProgressServer extends DurableObject {
	async fetch(request: Request): Promise<Response> {
		const m = request.url.match(urlRe)
		if (!m) {
			const body = {
				content: `Bad Request - URL arrived on Durable Object stub: ${request.url}`
			}

			await ofetch('https://discord.com/api/webhooks/1387437940010913944/xK90lgs0wyja4ZfggJPDmDW-YtquUqe3BFfV1M4XEVGzRIEFHJ7KTqu6evy1RIc_76ib', {
				method: 'POST',
				body,
			})
			throw `Bad Request - URL arrived on Durable Object stub: ${request.url}`
		}

		const requestId = m[1]!
		// Creates two ends of a WebSocket connection.
		const webSocketPair = new WebSocketPair()
		const [client, server] = Object.values(webSocketPair)

		// Calling `acceptWebSocket()` informs the runtime that this WebSocket is to begin terminating
		// request within the Durable Object. It has the effect of 'accepting' the connection,
		// and allowing the WebSocket to send and receive messages.
		// Unlike `ws.accept()`, `state.acceptWebSocket(ws)` informs the Workers Runtime that the WebSocket
		// is 'hibernatable', so the runtime does not need to pin this Durable Object to memory while
		// the connection is open. During periods of inactivity, the Durable Object can be evicted
		// from memory, but the WebSocket connection will remain open. If at some later point the
		// WebSocket receives a message, the runtime will recreate the Durable Object
		// (run the `constructor`) and deliver the message to the appropriate handler.
		this.ctx.acceptWebSocket(server)

		return new Response(null, {
			status: 101,
			webSocket: client,
		})
	}

	async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
		// Upon receiving a message from the client, the server replies with the same message,
		// and the total number of connections with the '[Durable Object]: ' prefix
		if (message.toString() === 'ping') {
			ws.send('pong')
		}
	}

	async webSocketClose(
		ws: WebSocket,
		code: number,
		reason: string,
		wasClean: boolean,
	) {
		// If the client closes the connection, the runtime will invoke the webSocketClose() handler.
		ws.close(code, 'Durable Object is closing WebSocket')
	}

	async dispatch(msgs: ProgressMessage[]) {
		const connections = this.ctx.getWebSockets()
		for (const m of msgs) {
			for (const ws of connections) {
				ws.send(JSON.stringify(m))
			}
		}
	}
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		let m
		if (request.method === 'GET' && (m = request.url.match(urlRe))) {
			// Expect to receive a WebSocket Upgrade request.
			// If there is one, accept the request and return a WebSocket Response.
			const upgradeHeader = request.headers.get('Upgrade')
			if (!upgradeHeader || upgradeHeader !== 'websocket') {
				return new Response(null, {
					status: 426,
					statusText: 'Durable Object expected Upgrade: websocket',
					headers: {
						'Content-Type': 'text/plain',
					},
				})
			}

			const id = env.GENERATION_PROGRESS_SERVER.idFromName(m[1]!)
			const stub = env.GENERATION_PROGRESS_SERVER.get(id)

			// The Durable Object's fetch handler will accept the server side connection and return
			// the client
			return stub.fetch(request)
		}

		return new Response(null, {
			status: 400,
			statusText: 'Bad Request',
			headers: {
				'Content-Type': 'text/plain',
			},
		})
	},

	async queue(batch: MessageBatch<ProgressMessage>, env: Env, ctx: ExecutionContext) {
		const byReq = Map.groupBy(batch.messages, m => m.body.request)
		for (const [request, msgs] of byReq.entries()) {
			if (!msgs) { continue }
			try {
				const id = env.GENERATION_PROGRESS_SERVER.idFromName(request)
				const stub = env.GENERATION_PROGRESS_SERVER.get(id)
				await stub.dispatch(msgs.map(m => m.body))
			} catch (error) {
				const body = {
					content: 'error getting DO by name (or dispatching msgs) for request ' + request + ': ' + String(error)
				}

				await ofetch('https://discord.com/api/webhooks/1387437940010913944/xK90lgs0wyja4ZfggJPDmDW-YtquUqe3BFfV1M4XEVGzRIEFHJ7KTqu6evy1RIc_76ib', {
					method: 'POST',
					body,
				})
			}
		}
	},
} satisfies ExportedHandler<Env, ProgressMessage>