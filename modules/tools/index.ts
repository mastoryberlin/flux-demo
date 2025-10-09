import { readdirSync, existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs'
import { defineNuxtModule, createResolver, addTemplate, updateTemplates, addDevServerHandler, addTypeTemplate } from '@nuxt/kit'
import { join, relative } from 'pathe'
import type { FSWatcher } from 'chokidar'
import { watch } from 'chokidar'
import { parse as parseYaml } from 'yaml'
import type { JSONSchema } from 'json-schema-to-ts'
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import type { DefaultTheme } from 'vitepress'
import { defuToCollectMissing, idempotentPersistedDefu } from '../../shared/utils/defus'
import { sortRecursively } from '../../shared/utils/json'
import type { ChainMeta } from '../../server/utils/chain'
import { resolveToolThumbnailUrl } from '../../shared/utils/routes'

export default defineNuxtModule({
  meta: {
    name: 'nuxt-tools',
  },
  defaults: {
    folder: 'tools',
    supportedLocales: ['en', 'de', 'hu'],
  },
  setup(options, nuxt) {
    const { resolve } = createResolver(import.meta.url)
    let projectRoot = resolve('../..')

    const folder = {
      get server() { return resolve(projectRoot, 'server') },
      get i18n() { return resolve(projectRoot, 'i18n') },
      get tools() { return resolve(projectRoot, 'server', options.folder) },
      get shared() { return resolve(projectRoot, 'server', options.folder, '.shared') },
      get docs() { return resolve(projectRoot, 'docs') },
      get runtime() { return resolve(projectRoot, '.nuxt/runtime') },
    }

    function loadSortOrder(): string[] {
      const sortFilePath = join(folder.tools, '.sort.yaml')
      if (existsSync(sortFilePath)) {
        try {
          const sortContent = readFileSync(sortFilePath, 'utf-8')
          const sortOrder = parseYaml(sortContent)
          return Array.isArray(sortOrder) ? sortOrder : []
        } catch (error) {
          console.warn(`Failed to parse ${sortFilePath}:`, error)
          return []
        }
      }
      return []
    }

    let toolIds: string[] = [], toolExports: Array<{ id: string, importPath: string }> = []

    function scanTools() {
      const foundToolIds: string[] = []
      const foundToolExports: Array<{ id: string, importPath: string }> = []

      const toolsFolder = folder.tools
      if (!existsSync(toolsFolder)) {
        console.warn(`${toolsFolder} directory not found`)
        return
      }

      const toolsFolderRelativeToRuntime = relative(folder.runtime, toolsFolder)

      // Scan server/{folder} directory
      const entries = readdirSync(toolsFolder, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.name.startsWith('.')) { continue }
        if (entry.isFile() && entry.name.endsWith('.ts')) {
          // Top-level file (e.g., example.ts -> example)
          const toolId = entry.name.replace(/\.ts$/, '')
          foundToolIds.push(toolId)
          foundToolExports.push({
            id: toolId,
            importPath: `${toolsFolderRelativeToRuntime}/${toolId}`,
          })
        } else if (entry.isDirectory()) {
          // Check for index.ts in subdirectory
          const indexPath = join(toolsFolder, entry.name, 'index.ts')
          if (existsSync(indexPath)) {
            const toolId = entry.name
            foundToolIds.push(toolId)
            foundToolExports.push({
              id: entry.name,
              importPath: `${toolsFolderRelativeToRuntime}/${toolId}`,
            })
          }
        }
      }

      // Sort tools according to .sort.yaml or alphabetically
      const sortOrder = loadSortOrder()
      // console.log('loaded tools sort order:', sortOrder)
      const sortedToolIds = [...foundToolIds].sort((a, b) => {
        const aIndex = sortOrder.indexOf(a)
        const bIndex = sortOrder.indexOf(b)

        // Both in sort order - use sort order
        if (aIndex !== -1 && bIndex !== -1)
          return aIndex - bIndex

        // Only a in sort order - a comes first
        if (aIndex !== -1)
          return -1

        // Only b in sort order - b comes first
        if (bIndex !== -1)
          return 1

        // Neither in sort order - alphabetical
        return a.localeCompare(b)
      })

      // Reorder toolExports to match sorted toolIds
      const sortedToolExports = sortedToolIds.map(id =>
        foundToolExports.find(tool => tool.id === id)!,
      )

      toolIds = sortedToolIds
      toolExports = sortedToolExports

      console.info(`\`tools\`: found ${toolIds.length} tools`)
    }

    const metadataMsgs = {
      tools: {} as any,
      sharedProperties: {} as any,
    }

    const metadata: Record<string, ChainMeta> = {}
    const inputSchemas: Record<string, JSONSchema & { type: 'object' }> = {}

    function regenerateToolDocs() {
      const docToolIds = toolIds.filter(id => !id.startsWith('.') && !id.startsWith('_'))
      for (const locale of options.supportedLocales) {
        const localePath = join(folder.i18n, `locales/tools-${locale}.json`)
        if (!existsSync(localePath)) { continue }
        const raw = readFileSync(localePath, { encoding: 'utf-8' })
        const json = JSON.parse(raw)
        // console.log('read and parsed', localePath)

        const sharedProperties: Record<string, any> = json.sharedProperties ?? {}
        const sharedPropertiesPath = join(folder.docs, locale, 'shared-properties')
        for (const [prop, def] of Object.entries(sharedProperties)) {
          const sharedPropertyPath = join(sharedPropertiesPath, prop)
          let existsPath = existsSync(sharedPropertyPath) ? true : false
          for (const p of ['title', 'description']) {
            let v
            if (p in def && (v = def[p] as string)) {
              if (!existsPath) {
                mkdirSync(sharedPropertyPath, { recursive: true })
                existsPath = true
              }
              const filePath = join(sharedPropertyPath, p.replace('description', 'explanation') + '.md')
              if (!existsSync(filePath)) {
                writeFileSync(filePath, v)
              }
            }
          }
        }

        const toc: DefaultTheme.Config['sidebar'] = []
        let allToolsMd = `<Tools>`
        let allToolsScript = `<script setup>\nconst alt = {\n`
        for (const id of docToolIds) {
          const toolSubfolderPath = join(folder.docs, locale, 'tools', id)
          mkdirSync(toolSubfolderPath, { recursive: true })

          // console.log('checking if tool', id, 'is contained in locales')
          const toolLocale = json.tools?.[id] as Partial<{ title: string, text: string, inputSchema: JSONSchema & object }>
          const title = toolLocale?.title
          const text = toolLocale?.text

          const tool = metadata[id]
          const schema = inputSchemas[id]

          // console.log('checking general metadata of tool', id, '- value:', tool)
          const imgSrc = tool?.thumbnailUrl

          // create stub / template MD
          const autogen = '<!-- THIS FILE IS AUTO-GENERATED - DO NOT EDIT IT MANUALLY! -->\n'
          let md = ''
          const headMd = autogen + `# <!--@include: ./title.md-->
[<!--@include: ../../shared/try-in-app.md-->](/../${locale === 'en' ? '' : locale}?t=${id}){target: "_blank"}

<!--@include: ./image.md-->
<!--@include: ./text.md-->
`
          md += `<!--@include: ../.gen/${id}/head.md-->\n\n`

          if (title) {
            if (text) {
              allToolsScript += `  '${id}': ${JSON.stringify(text)},\n`
              allToolsMd += `
  <Tool id="${id}" locale="${locale}" img-src="${imgSrc ?? '.png'}" :img-alt="alt['${id}']">
    <template #title><!--@include: ./${id}/title.md--></template>
    <template #description><!--@include: ./${id}/text.md--></template>
  </Tool>`
            }

            // add toc entry
            toc.push({
              text: title,
              link: `/${locale}/tools/${id}/`,
            })
          }

          md += `<!--@include: ../shared/headers/what-it-does.md-->
<!--@include: ./framer.md#what-it-does-->

<!--@include: ../shared/headers/input-fields.md-->`

          if (schema && 'properties' in schema && schema.properties) {
            md += `
<InputFields>
  <template #header:title><!--@include: ../shared/input-fields-table/title.md--></template>
  <template #header:explanation><!--@include: ../shared/input-fields-table/explanation.md--></template>
    
`
            for (const [prop, def] of Object.entries(schema.properties)) {
              const shared = prop in sharedProperties
              const propPath = (p: string) => `${shared ? '../../shared-properties' : './properties'}/${prop}/${p}.md`

              if (!shared) {
                for (const p of ['title', 'description'] as const) {
                  const toolPropertyPath = join(toolSubfolderPath, 'properties', prop)
                  if (!existsSync(toolPropertyPath)) {
                    mkdirSync(toolPropertyPath, { recursive: true })
                  }
                  const filePath = join(toolPropertyPath, p.replace('description', 'explanation') + '.md')
                  const locDef = toolLocale?.inputSchema?.properties?.[prop]
                  const v = (locDef as typeof locDef & object)?.[p]
                    ?? (def as (typeof def & object))[p]
                    ?? 'TODO'
                  // if (!existsSync(filePath)) {
                  writeFileSync(filePath, v)
                  // }
                }
              }

              md += `
  <InputField>
    <template #title><!--@include: ${propPath('title')}--></template>
    <template #explanation><!--@include: ${propPath('explanation')}--></template>
  </InputField>`
            }

            md += `
</InputFields>\n\n`
          }
          md += `<!--@include: ../shared/headers/what-you-get.md-->\n\n`
          md += `<!--@include: ./framer.md#what-you-get-->\n\n`

          const toolGenPath = join(folder.docs, locale, 'tools/.gen', id)
          mkdirSync(toolGenPath, { recursive: true })
          const headPath = join(toolGenPath, 'head.md')
          writeFileSync(headPath, headMd)

          const examplePath = join(toolSubfolderPath, 'index-example.md')
          writeFileSync(examplePath, autogen + md)
          const indexPath = join(toolSubfolderPath, 'index.md')
          // if (!existsSync(indexPath)) {
          writeFileSync(indexPath, md)
          // }
        }

        // write overview page
        allToolsScript += '}\n</script>\n\n'
        allToolsMd += `\n</Tools>`
        const allToolsMdPath = join(folder.docs, locale, 'tools/.gen/tools.md')
        writeFileSync(allToolsMdPath, allToolsScript + allToolsMd)

        // write toc
        const tocPath = join(folder.docs, locale, 'tools/.gen/toc.ts')
        writeFileSync(tocPath, `import type { DefaultTheme } from 'vitepress'

export default ${JSON.stringify(toc, null, 2)} satisfies DefaultTheme.Config['sidebar']`)
      }
    }

    // Function to regenerate templates
    function scanToolsAndRegenerate() {
      scanTools()
      updateTemplates()
      if (import.meta.dev) {
        regenerateToolDocs()
      }
    }

    // Read and update shared properties
    async function updateSharedProperties(file: string) {
      if (existsSync(file)) {
        const m = metadataMsgs.sharedProperties ??= {}
        const imp = (await import(file)).default
        Object.assign(m, imp)
        Object.assign(metadataMsgs.sharedProperties, sortRecursively(m))
      }
    }

    // Regenerate missing locale messages
    async function regenerateMissingLocaleMsgs() {
      const localesFolder = join(folder.i18n, 'locales')
      const missingFolder = join(localesFolder, 'missing')

      const issues: string[] = []

      const enFilenames = [
        'tools-en.json',
      ]
      const enMsgs: any = {}

      for (const base of [localesFolder, missingFolder]) {
        for (const filename of enFilenames) {
          const localePath = join(base, filename)
          if (existsSync(localePath)) {
            try {
              const newMsgs = idempotentPersistedDefu(JSON.parse(readFileSync(localePath, { encoding: 'utf-8' })), enMsgs ?? {})
              if (newMsgs.tools) {
                enMsgs.tools ??= {}
                Object.assign(enMsgs.tools, newMsgs.tools)
              }
            } catch (error) {
              issues.push(`Unable to read or parse ${localePath}: ${error}`)
            }
          }
        }
      }

      const sharedMsgs = {
        tools: {} as any,
      }
      for (const id of Object.keys(enMsgs.tools ?? {})) {
        sharedMsgs.tools[id] = { inputSchema: { properties: metadataMsgs.sharedProperties } }
      }
      const missingMsgs = defuToCollectMissing(metadataMsgs, enMsgs, sharedMsgs)
      if (existsSync(missingFolder)) {
        writeFileSync(join(missingFolder, 'tools-en.json'), JSON.stringify(missingMsgs, null, 2))
      }

      if (issues.length) {
        console.warn(`\`tools\`: Errors regenerating missing locales: ${issues.join('\n')}`)
      }
    }

    addDevServerHandler({
      route: '/_tools/meta',
      handler: defineEventHandler(async (event) => {
        switch (event.method) {
          case 'POST':
            {
              const body = await readBody(event) as { id: string, meta: ChainMeta, inputSchema: JSONSchema & { type: 'object' } }
              const { id, meta, inputSchema } = body
              metadata[id] = meta
              inputSchemas[id] = inputSchema
              metadataMsgs.tools[id] = {
                title: meta.title,
                text: meta.text,
                inputSchema,
              }
              // console.log('updated tools meta:', meta)
              regenerateToolDocs()
              await regenerateMissingLocaleMsgs()
              for (const locale of options.supportedLocales ?? []) {
                const toolDocsGenPath = join(folder.docs, locale, `tools/.gen/${id}`)
                try {
                  let toolDocsGenPathExists = existsSync(toolDocsGenPath)
                  function ensureToolDocsGenPathExists() {
                    if (!toolDocsGenPathExists) {
                      // console.log('creating folder', toolDocsGenPath)
                      mkdirSync(toolDocsGenPath, { recursive: true })
                      toolDocsGenPathExists = true
                    }
                  }
                  const tool = metadata[id]
                  // console.log('checking general metadata of tool', id, '- value:', tool)
                  const imgSrc = tool?.thumbnailUrl
                  if (imgSrc) {
                    ensureToolDocsGenPathExists()
                    const mdPath = join(toolDocsGenPath, `image.md`)
                    const v = `<script setup>
const alt = ${JSON.stringify(meta.title ?? tool.title)}
</script>

<PublicImg :alt src="${resolveToolThumbnailUrl(id, imgSrc)}" />`
                    // console.log('writing image info to MD file', mdPath)
                    writeFileSync(mdPath, v)
                  }
                  const localePath = join(folder.i18n, `locales/tools-${locale}.json`)
                  if (!existsSync(localePath)) { continue }
                  const raw = readFileSync(localePath, { encoding: 'utf-8' })
                  const json = JSON.parse(raw)
                  // console.log('read and parsed', localePath, ', checking if tool', id, 'is contained')
                  const toolLocale = json.tools?.[id] as Partial<{ title: string, text: string }>
                  if (toolLocale) {
                    // console.log('yes! reading title and text')
                    for (const p of ['title', 'text'] as const) {
                      const v = toolLocale[p]
                      // console.log('-', p, 'property has value', v)
                      if (v) {
                        ensureToolDocsGenPathExists()
                        const mdPath = join(toolDocsGenPath, `${p}.md`)
                        // console.log('writing value to MD file', mdPath)
                        writeFileSync(mdPath, v)
                      }
                    }
                  } else {
                    // console.log('no!')
                  }
                } catch (error) {
                  console.error('`tools`: error parsing ')
                }
              }
            }
            setResponseStatus(event, 200)
            return
        }
      }),
    })

    addDevServerHandler({
      route: '/_tools/rename',
      handler: defineEventHandler(async (event) => {
        switch (event.method) {
          case 'POST':
            {
              const body = await readBody(event) as { old: string, new: string }
              const { old: o, new: n } = body
              for (const locale of options.supportedLocales ?? []) {
                try {
                  const localePath = join(folder.i18n, `locales/tools-${locale}.json`)
                  if (!existsSync(localePath)) { continue }
                  const raw = readFileSync(localePath, { encoding: 'utf-8' })
                  const json = JSON.parse(raw)
                  // console.log('read and parsed', localePath, ', checking if tool', o, 'is contained')
                  if (json.tools && o in json.tools) {
                    // console.log('yes! renaming to', n)
                    json.tools[n] = JSON.parse(JSON.stringify(json.tools[o]))
                    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                    delete json.tools[o]
                    json.tools = sortRecursively(json.tools)
                    // console.log('writing back to', localePath)
                    writeFileSync(localePath, JSON.stringify(json, null, 2))
                    // console.log('done.')
                  } else {
                    // console.log('no! exiting.')
                  }
                } catch (error) {
                  console.error('`tools`: error parsing ')
                }
              }
            }
            setResponseStatus(event, 200)
            return
        }
      }),
    })

    // Generate the tools runtime module as TypeScript
    addTemplate({
      filename: 'runtime/tools.ts',
      getContents: () => {
        const imports = toolExports.map(({ id, importPath }, index) =>
          `import tool${index} from '${importPath.replace(/\.ts$/, '')}'`,
        ).join('\n')

        const toolsObject = toolExports.map(({ id }, index) =>
          `  '${id}': tool${index}`,
        ).join(',\n')

        return `${imports}

export const toolIds = ${JSON.stringify(toolIds, null, 2)}

export const tools = {
${toolsObject}
}
`
      },
      write: true,
    })

    // Add type declarations
    addTypeTemplate({
      filename: 'types/tools.d.ts',
      getContents: () => {
        const toolIdType = toolIds.length > 0
          ? toolIds.map(id => `'${id}'`).join(' | ')
          : 'never'
        return `declare module '#tools' {
  export type ToolId = ${toolIdType}
  export const tools: { [Id in ToolId]: any }
  export const toolIds: readonly ToolId[]
}
`
      },
    })

    // Create a JSON schema file to validate sort.yaml
    addTemplate({
      filename: 'tools-schema.json',
      getContents: () => {
        return `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "items": {
    "type": "string",
    "enum": ${JSON.stringify(toolIds)}
  },
  "uniqueItems": true
}`
      },
      write: true,
    })

    // Set up aliases
    nuxt.options.alias = nuxt.options.alias || {}
    nuxt.options.alias['#tools'] = join(nuxt.options.buildDir, 'runtime/tools.ts')
    nuxt.options.alias['#tools/types'] = join(nuxt.options.buildDir, 'server-tools-types.d.ts')

    // Also add it to Nitro aliases for server-side access
    nuxt.hook('nitro:config', (nitroConfig) => {
      nitroConfig.alias = nitroConfig.alias || {}
      nitroConfig.alias['#tools'] = join(nuxt.options.buildDir, 'runtime/tools.ts')
      nitroConfig.alias['#tools/types'] = join(nuxt.options.buildDir, 'server-tools-types.d.ts')

      // Ensure Nitro can resolve the server tools directory
      nitroConfig.typescript = nitroConfig.typescript || {}
      nitroConfig.typescript.tsConfig = nitroConfig.typescript.tsConfig || {}
      nitroConfig.typescript.tsConfig.compilerOptions = nitroConfig.typescript.tsConfig.compilerOptions || {}
      nitroConfig.typescript.tsConfig.compilerOptions.paths = nitroConfig.typescript.tsConfig.compilerOptions.paths || {}
      nitroConfig.typescript.tsConfig.compilerOptions.paths[`~~/server/${options.folder}/*`] = [`./server/${options.folder}/*`]
      nitroConfig.typescript.tsConfig.compilerOptions.paths['#tools'] = [join(nuxt.options.buildDir, 'types/tools.d.ts')]
      nitroConfig.typescript.tsConfig.compilerOptions.paths['#tools/types'] = [join(nuxt.options.buildDir, 'server-tools-types.d.ts')]
    })

    // Add type reference
    nuxt.hook('prepare:types', (options) => {
      options.references.push({ path: resolve(nuxt.options.buildDir, 'types/tools.d.ts') })
    })

    // Handle production builds - scan tools during module setup for production
    if (!nuxt.options.dev) {
    // For production builds, scan tools immediately during module setup
      scanTools()
      // if (nuxt.options._prepare) {
      //   return
      // }
    }

    async function parseShared(sharedFolder: string) {
      const shared = readdirSync(sharedFolder, { withFileTypes: true })
      await Promise.all(shared.map(async (entry) => {
        if (entry.isDirectory()) {
          await parseShared(resolve(sharedFolder, entry.name))
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
          await updateSharedProperties(resolve(sharedFolder, entry.name))
        }
      }))
    }

    let watcher: FSWatcher
    nuxt.hook('app:resolve', async (app: any) => {
      projectRoot = resolve(app.dir, '..')

      // Watch for changes in the tools directory (dev mode only)
      // console.log('`tools` app:resolve hook - nuxt.options.dev:', nuxt.options.dev)
      if (nuxt.options.dev) {
        watcher = watch(folder.tools, {
          ignored: ['.*', '!.shared'], // Ignore hidden paths
          ignoreInitial: true,
        })

        watcher.on('add', async (path) => {
          console.log('`tools` watcher detected change:', `added ${path}`)
          scanToolsAndRegenerate()
          if (path.startsWith(folder.shared)) {
            console.log('shared props file added:', path, '\n- regenerating sharedProperties in i18n/missing/tools-en.json locale')
            await updateSharedProperties(path)
          }
          console.log('- regenerating missing locale msgs')
          await regenerateMissingLocaleMsgs()
        })

        watcher.on('unlink', async (path) => {
          console.log('`tools` watcher detected change:', `removed ${path}`)
          scanToolsAndRegenerate()
          if (path.startsWith(folder.shared)) {
            console.log('shared props file removed:', path, '\n- regenerating sharedProperties in i18n/missing/tools-en.json locale')
            if (existsSync(folder.shared)) {
              await parseShared(folder.shared)
            }
          }
          console.log('- regenerating missing locale msgs')
          await regenerateMissingLocaleMsgs()
        })

        watcher.on('unlinkDir', async (path) => {
          console.log('`tools` watcher detected change:', `removed directory ${path}`)
          scanToolsAndRegenerate()
          if (path.startsWith(folder.shared)) {
            console.log('shared props folder removed:', path, '\n- regenerating sharedProperties in i18n/missing/tools-en.json locale')
            if (existsSync(folder.shared)) {
              await parseShared(folder.shared)
            }
          }
          console.log('- regenerating missing locale msgs')
          await regenerateMissingLocaleMsgs()
        })

        watcher.on('change', async (path) => {
          // Only regenerate if .sort.yaml changes
          if (path.endsWith('.sort.yaml')) {
            console.log('`tools` watcher detected change:', `sort order changed`)
            scanToolsAndRegenerate()
            return
          } else if (path.startsWith(folder.shared)) {
            console.log('shared props file changed:', path, '\n- regenerating sharedProperties in i18n/missing/tools-en.json locale')
            await updateSharedProperties(path)
          }
          console.log('- regenerating missing locale msgs')
          await regenerateMissingLocaleMsgs()
        })
      }
    })

    if (nuxt.options.dev) {
      // Clean up watcher on close
      nuxt.hook('close', () => {
        watcher.close()
      })
    }

    nuxt.hook('ready', async () => {
      if (nuxt.options.dev) {
        // For local dev, scan tools on the ready hook
        scanTools()

        if (existsSync(folder.shared)) {
          await parseShared(folder.shared)
        }
        await regenerateMissingLocaleMsgs()

        regenerateToolDocs()
      }
    })

    console.log('`tools` module ready')
  },
})
