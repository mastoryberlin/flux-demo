// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-07-30',
  // https://nuxt.com/docs/getting-started/upgrade#testing-nuxt-4
  future: { compatibilityVersion: 4 },

  // https://nuxt.com/modules
  modules: ['@nuxthub/core', '@nuxt/eslint', '@vueuse/nuxt', 'nuxt-jsoneditor'],
  jsoneditor: {
    componentName: 'JsonEditor',
    options: {
      darkTheme: true,
      indentation: 2,
      mainMenuBar: true,
      navigationBar: true,
    },
  },

  // https://hub.nuxt.com/docs/getting-started/installation#options
  hub: {
    ai: true,
    database: true,
    blob: true,
    bindings: {
      workflow: {
        GENERATION_WORKFLOW: {
          name: 'GENERATION_WORKFLOW',
          workflow_name: 'workflows-hello-world',
          script_name: 'workflows-starter',
          class_name: 'GenerationWorkflow',
        },
      },
    },
  },

  nitro: {
    experimental: {
      openAPI: true,
      websocket: true,
    },
  },

  // Development config
  eslint: {
    config: {
      stylistic: {
        quotes: 'single',
        commaDangle: 'always-multiline',
        semi: false,
        indent: 2,
      },
      nuxt: {
        sortConfigKeys: false,
      },
    },
  },

  // https://devtools.nuxt.com
  devtools: { enabled: true }
})