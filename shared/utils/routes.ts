export function unlocalize(path: string) {
  const localeSlugs = ['de', 'hu'] as const
  const localeRe = new RegExp('^/(' + localeSlugs.join('|') + ')/')
  const m = path.match(localeRe)
  const base = path.replace(localeRe, '/')
  return {
    base,
    localeSlug: m?.[1] as typeof localeSlugs[number] | undefined,
  }
}

export function resolveToolThumbnailUrl(toolId: string, thumb: string) {
  let s = thumb
  if (s.includes('://')) {
    return s
  } else if (s.startsWith('/')) {
    s = s.substring(1)
  } else if (s.startsWith('.')) {
    s = toolId + s
  }
  return '/img/tools/' + s
}
