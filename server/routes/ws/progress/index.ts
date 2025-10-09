import type { ProgressMessage } from '~~/shared/types/ws'

export default defineWebSocketHandler({
  message(peer, message) {
    const m = message.json() as ProgressMessage
    switch (m.type) {
      case 'pub':
        peer.publish(m.workflowId, m.progress)
        break
      case 'sub':
        peer.subscribe(m.workflowId)
        break
    }
  },
  close(peer) {
    for (const t of peer.topics) {
      peer.unsubscribe(t)
    }
  },
})
