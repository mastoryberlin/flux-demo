export default defineEventHandler((event) => {
  const id = routeParam(event)
  const blob = hubBlob()
  return blob.serve(event, `gen/${id}.json`)
})
