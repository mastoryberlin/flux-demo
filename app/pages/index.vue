<template>
  <div>
    <section>
      <h1>CF Workflow + WebSocket Test</h1>
    </section>

    <section>
      <button @click="openCloseWS">
        {{ wsOpen ? 'Disconnect' : 'Connect' }}
      </button>

      <button @click="startWorkflow">
        Start {{ data.length ? 'New ' : '' }}Workflow!
      </button>

      <template v-if="workflowId">
        <button @click="abortWorkflow">
          Abort
        </button>

        <!-- <button @click="resumeWorkflow">
          Resume
        </button> -->
      </template>
    </section>

    <section>
      <label>
        Workflow ID:
        <input
          v-model="workflowId"
          type="text"
        >
      </label>
    </section>

    <section class="two-cols">
      <div class="left">
        <h2>Streamed Data:</h2>
        <ul>
          <li
            v-for="(item, index) in data"
            :key="index"
            :style="item.includes('error') ? { color: '#ff3c00' } : null"
          >
            {{ item }}
          </li>
        </ul>
      </div>

      <div class="right">
        <h2>Content:</h2>
        <label>
          <input
            v-model="showJson"
            type="checkbox"
          >
          &nbsp;Show Full JSON Data
        </label>
        <ClientOnly v-if="showJson">
          <JsonEditor v-model:json="content" />
        </ClientOnly>
        <div v-else>
          <p>{{ content.markdown ?? '(no markdown content)' }}</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { JsonEditor } from '#components'
import type { ToolId } from '#tools'
import type { ProgressMessage } from '~~/shared/types/ws'

const route = useRoute()

const data = ref<string[]>([])
const wsOpen = ref(false)
const workflowId = ref(route.query.id as string ?? '')
const content = ref<any>({
  words: 30,
})
const showJson = ref(false)

const { open, close, send } = useWebSocket('wss://generation-progress.felix-162.workers.dev/ws/test-request', {
  immediate: false,
  async onMessage(ws, event) {
    console.log('Received WS msg - data:', event.data)
    const e = JSON.parse(event.data) as ProgressMessage
    data.value.push(e.event)
    if (e.result) {
      content.value = e.result
    }
  },
  onConnected() { wsOpen.value = true },
  onDisconnected() { wsOpen.value = false },
})

let watchId = true
watch(workflowId, async (id, o) => {
  if (watchId && id && id !== o) {
    try {
      content.value = await $fetch(`/api/result/${id}`)
    } catch (_) {}
  }
}, { immediate: true })

// function subscribeToWorkflow(id: string) {
//   const msg: ProgressMessage = {
//     type: 'sub',
//     workflowId: id,
//   }
//   send(JSON.stringify(msg))
// }

function openCloseWS() {
  if (wsOpen.value) {
    close()
    wsOpen.value = false
  } else {
    open()
    const id = workflowId.value
    // if (id) {
    //   subscribeToWorkflow(id)
    // }
  }
}

async function startWorkflow() {
  const resp = await $fetch<{ id: string }>('/api/workflow', {
    method: 'POST',
    body: {
      requestId: 'test-request',
      toolId: '_mock' satisfies ToolId,
      userInput: content.value,
    },
  })
  const { id } = resp
  watchId = false
  workflowId.value = id
  if (import.meta.client) {
    history.pushState({}, '', route.fullPath.replace(/\?.*$/, '') + '?id=' + id)
  }
  // if (wsOpen.value) {
  //   subscribeToWorkflow(id)
  // }
  nextTick(() => {
    watchId = true
  })
}

async function abortWorkflow() {
  const id = workflowId.value
  try {
    await $fetch<{ id: string }>(`/api/workflow/${id}`, {
      method: 'DELETE',
    })
  } catch (error) {
    alert('Cannot abort since the workflow has already terminated')
  }
}
async function resumeWorkflow() {
  const id = workflowId.value
  try {
    await $fetch<{ id: string }>(`/api/workflow/${id}`, {
      method: 'PATCH',
    })
  } catch (error) {
    alert(`Cannot resume workflow: ${JSON.stringify(error)}`)
  }
}

// onMounted(() => {
//   openCloseWS()
// })
</script>

<style scoped>
section {
  margin: 40px;
}
button {
  margin-right: 8px;
  padding: 3px 8px;
  background: #7bbfc1;
  border-radius: 8px;
  cursor: pointer;
}
button:hover {
  background: #9afcff;
}
.two-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.left {
  grid-column: 1;
}
.right {
  grid-column: 2;
}
</style>
