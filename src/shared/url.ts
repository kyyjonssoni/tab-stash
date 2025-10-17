// URL normalization + hashing helpers

export function normalizeUrl(
  input: string,
  opts: { stripAllParams?: boolean; stripTracking?: boolean } = { stripAllParams: false, stripTracking: true }
): string {
  try {
    const u = new URL(input)
    // Ignore non-http(s)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return input

    u.hash = ''
    // Lowercase host, strip default ports
    u.hostname = u.hostname.toLowerCase()
    if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) {
      u.port = ''
    }

    // Query params handling for dedupe
    if (opts.stripAllParams) {
      u.search = ''
    } else {
      const params = new URLSearchParams(u.search)
      if (opts.stripTracking) {
        const exact = new Set<string>([
          'fbclid', 'gclid', 'dclid', 'msclkid', 'ga_source', 'ga_medium', 'ga_campaign',
          'yclid', 'vero_conv', 'igshid', 'spm', 'sc_channel', 'sc_campaign', 'sc_content', 'sc_medium', 'sc_source',
          'mc_cid', 'mc_eid', 'ref', 'ref_src', 'ref_url', 'referrer'
        ])
        const prefixes = ['utm_', 'hsa_', 'pk_', 'icn', 'mkt_', 'aff_', 'sr_', 'xtor', 'oly_']
        const keys: string[] = []
        params.forEach((_v, k) => keys.push(k))
        keys.forEach((k) => {
          if (exact.has(k) || prefixes.some((p) => k === p || k.startsWith(p))) params.delete(k)
        })
      }
      const sorted = new URLSearchParams()
      const entries: [string, string][] = []
      params.forEach((v, k) => { entries.push([k, v]) })
      entries.sort(([a], [b]) => a.localeCompare(b)).forEach(([k, v]) => sorted.append(k, v))
      u.search = sorted.toString() ? `?${sorted.toString()}` : ''
    }

    // Remove trailing slash (except root)
    if (u.pathname.endsWith('/') && u.pathname !== '/') {
      u.pathname = u.pathname.replace(/\/+$/, '')
    }

    return u.toString()
  } catch {
    return input
  }
}

export async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder()
  const data = enc.encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
