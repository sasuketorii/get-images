export function resolveUrl(raw: string, base: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    return new URL(trimmed, base).href;
  } catch {
    return trimmed;
  }
}

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.href;
  } catch {
    return url;
  }
}

export function isDownloadableUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('data:')) return false;
  if (url.startsWith('blob:')) return false;
  if (url.startsWith('javascript:')) return false;
  if (url.startsWith('mailto:')) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const TRACKING_PARAM_PREFIXES = ['utm_', 'ref_'];
const TRACKING_PARAM_KEYS = new Set([
  'fbclid',
  'gclid',
  'yclid',
  'dclid',
  'gbraid',
  'wbraid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'spm',
  'ttclid',
  'twclid',
  'ixid',
  'ixlib',
  'cache',
  'cachebust',
  'cb',
  '_',
]);

const TRANSFORM_PARAM_KEYS = new Set([
  'w',
  'width',
  'h',
  'height',
  'dpr',
  'q',
  'quality',
  'fm',
  'format',
  'auto',
  'fit',
  'crop',
  'ar',
  'rect',
  'pad',
  'bg',
]);

const PROXY_PARAM_KEYS = ['url', 'image', 'src'];

const SIZE_SEGMENT_RE = /^(?:w|h|dpr|q|quality|width|height|fit|crop|format|fm|auto|ar|rect|pad|bg)[-_]?\d+(?:x\d+)?$/i;
const DIMS_SEGMENT_RE = /^\d{2,5}x\d{2,5}$/i;
const RESIZE_PREFIXES = new Set(['resize', 'resizer', 'thumb', 'thumbnail', 'fit-in']);

function shouldDropParamKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (TRACKING_PARAM_KEYS.has(lower)) return true;
  if (TRANSFORM_PARAM_KEYS.has(lower)) return true;
  return TRACKING_PARAM_PREFIXES.some(prefix => lower.startsWith(prefix));
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function unwrapProxyUrl(parsed: URL): URL | null {
  const pathname = parsed.pathname.toLowerCase();
  const hasHint =
    pathname.includes('/_next/image') ||
    pathname.includes('/cdn-cgi/image') ||
    pathname.includes('/image') ||
    pathname.includes('/img') ||
    pathname.includes('/proxy') ||
    pathname.includes('/resize');

  for (const key of PROXY_PARAM_KEYS) {
    const value = parsed.searchParams.get(key);
    if (!value) continue;
    const raw = value.trim();
    if (!raw) continue;
    const decoded = safeDecode(raw);
    if (!hasHint && !decoded.startsWith('http') && !decoded.startsWith('/')) continue;
    try {
      return new URL(decoded, parsed.origin);
    } catch {
      return null;
    }
  }
  return null;
}

function stripCloudflareImageResizing(pathname: string): string {
  const match = pathname.match(/\/cdn-cgi\/image\/[^/]+\/(.+)/i);
  if (!match) return pathname;
  return `/${match[1]}`;
}

function isCloudinaryTransformSegment(segment: string): boolean {
  if (!segment) return false;
  if (!segment.includes('_') && !segment.includes(',')) return false;
  return /(^|,)(?:w|h|c|q|f|g|ar|dpr|e|t|l|b|bo|co|o|r|u|x|y|z)_/i.test(
    segment
  );
}

function stripCloudinaryTransformations(pathname: string): string {
  const parts = pathname.split('/');
  const uploadIndex = parts.indexOf('upload');
  if (uploadIndex === -1) return pathname;

  const cleaned = parts.slice(0, uploadIndex + 1);
  let i = uploadIndex + 1;
  while (i < parts.length && isCloudinaryTransformSegment(parts[i])) {
    i += 1;
  }
  cleaned.push(...parts.slice(i));
  return cleaned.join('/');
}

function stripSizePathSegments(pathname: string): string {
  const parts = pathname.split('/');
  const cleaned: string[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const segment = parts[i];
    if (!segment) {
      cleaned.push(segment);
      continue;
    }

    const lower = segment.toLowerCase();
    const next = parts[i + 1];
    if (RESIZE_PREFIXES.has(lower) && next && DIMS_SEGMENT_RE.test(next)) {
      i += 1;
      continue;
    }

    if (SIZE_SEGMENT_RE.test(lower) || DIMS_SEGMENT_RE.test(lower)) {
      continue;
    }

    if (segment.includes(',') && isCloudinaryTransformSegment(segment)) {
      continue;
    }

    cleaned.push(segment);
  }
  return cleaned.join('/');
}

function normalizeFilenameSizeSuffix(pathname: string): string {
  return pathname
    .replace(/-\d{2,5}x\d{2,5}(@2x)?(?=\.[a-z0-9]+$)/i, '')
    .replace(/_\d{2,5}x\d{0,5}(?=\.[a-z0-9]+$)/i, '')
    .replace(/@\d+x(?=\.[a-z0-9]+$)/i, '');
}

function normalizePathForDedupe(pathname: string): string {
  let normalized = pathname;
  normalized = stripCloudflareImageResizing(normalized);
  normalized = stripCloudinaryTransformations(normalized);
  normalized = stripSizePathSegments(normalized);
  normalized = normalizeFilenameSizeSuffix(normalized);
  return normalized;
}

export function buildDedupeKey(url: string): string {
  try {
    let parsed = new URL(url);
    const unwrapped = unwrapProxyUrl(parsed);
    if (unwrapped) parsed = unwrapped;
    parsed.hash = '';
    parsed.pathname = normalizePathForDedupe(parsed.pathname);

    const filtered = Array.from(parsed.searchParams.entries()).filter(
      ([key]) => !shouldDropParamKey(key)
    );
    filtered.sort((a, b) =>
      a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])
    );

    const params = new URLSearchParams(filtered);
    const query = params.toString();
    parsed.search = query ? `?${query}` : '';

    return `${parsed.origin}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}
