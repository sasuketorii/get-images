import type { ImageItem, ScanResult, SourceKind } from '../shared/types';
import {
  resolveUrl,
  normalizeUrl,
  isDownloadableUrl,
  buildDedupeKey,
} from '../shared/url';

export function scanImages(): ScanResult {
  const candidates = new Map<string, { item: ImageItem; score: number }>();
  const order: string[] = [];
  const base = location.href;
  let idCounter = 0;
  const seenElements = new WeakSet<Element>();
  const lazyAttrs = ['data-src', 'data-lazy', 'data-original', 'data-srcset'] as const;
  const lazySelector = lazyAttrs.map(a => `[${a}]`).join(',');

  function add(
    rawUrl: string,
    source: SourceKind,
    el?: HTMLElement | Element,
    candidate?: SrcsetCandidate
  ): boolean {
    const url = normalizeUrl(resolveUrl(rawUrl, base));
    if (!url || !isDownloadableUrl(url)) return false;

    const img = el instanceof HTMLImageElement ? el : null;
    const score = scoreCandidate(source, img, candidate);
    const key = buildDedupeKey(url);

    const existing = candidates.get(key);
    if (existing && existing.score >= score) return true;

    const naturalW = img?.naturalWidth || 0;
    const naturalH = img?.naturalHeight || 0;
    const candW = candidate?.width || 0;
    const bestW = Math.max(candW, naturalW);
    const bestH =
      bestW > 0 && naturalW > 0 && naturalH > 0
        ? Math.round(bestW * (naturalH / naturalW))
        : naturalH;

    const item: ImageItem = {
      id: `${source}:${++idCounter}`,
      url,
      source,
      width: bestW || undefined,
      height: bestH || undefined,
    };

    if (!existing) order.push(key);
    candidates.set(key, { item, score });
    return true;
  }

  // <picture> 要素
  for (const picture of document.querySelectorAll('picture')) {
    const childImg = picture.querySelector<HTMLImageElement>('img');
    if (childImg && isTinyElement(childImg)) continue;

    for (const source of picture.querySelectorAll('source')) {
      const srcset = source.getAttribute('srcset');
      if (!srcset) continue;
      const best = pickBestSrcsetCandidate(srcset);
      if (best) {
        add(best.url, 'picture', childImg ?? picture, best);
      }
    }
  }

  // <img src>
  for (const img of document.querySelectorAll<HTMLImageElement>('img')) {
    if (shouldSkipElement(img, seenElements)) continue;
    const src = img.currentSrc || img.src;
    if (!src) continue;
    if (isNaturalTiny(img) && hasLazyAttrs(img, lazyAttrs)) {
      continue;
    }
    if (add(src, 'img', img)) {
      seenElements.add(img);
    }
    const srcsetAttr = img.getAttribute('srcset');
    if (srcsetAttr) {
      const best = pickBestSrcsetCandidate(srcsetAttr);
      if (best) {
        add(best.url, 'srcset', img, best);
      }
    }
  }

  // lazy-load attributes
  for (const el of document.querySelectorAll<HTMLElement>(lazySelector)) {
    if (shouldSkipElement(el, seenElements)) continue;
    if (el instanceof HTMLImageElement) {
      const src = el.currentSrc || el.src;
      if (src) {
        const resolved = normalizeUrl(resolveUrl(src, base));
        if (isDownloadableUrl(resolved) && !isNaturalTiny(el)) {
          seenElements.add(el);
          continue;
        }
      }
    }

    for (const attr of lazyAttrs) {
      const val = el.getAttribute(attr);
      if (!val) continue;
      if (attr === 'data-srcset') {
        const best = pickBestSrcsetCandidate(val);
        if (best && add(best.url, 'lazy', el, best)) {
          seenElements.add(el);
          break;
        }
      } else {
        if (add(val, 'lazy', el)) {
          seenElements.add(el);
          break;
        }
      }
    }
  }

  // CSS background-image (inline style only - avoid full getComputedStyle scan)
  for (const el of document.querySelectorAll<HTMLElement>('[style*="background"]')) {
    if (shouldSkipElement(el, seenElements)) continue;
    const style = el.getAttribute('style') ?? '';
    for (const url of parseCssUrls(style, base)) {
      if (add(url, 'bg', el)) {
        seenElements.add(el);
        break;
      }
    }
  }

  const images = order.map(key => candidates.get(key)!.item);
  return { images, pageUrl: base };
}

interface SrcsetCandidate {
  url: string;
  width?: number;
  density?: number;
}

const SOURCE_WEIGHTS: Record<SourceKind, number> = {
  img: 5,
  picture: 4,
  srcset: 3,
  lazy: 2,
  bg: 1,
};

const MIN_DIMENSION = 50;

function parseSrcset(srcset: string): SrcsetCandidate[] {
  return srcset
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(entry => {
      const parts = entry.split(/\s+/);
      const url = parts.shift() ?? '';
      let width: number | undefined;
      let density: number | undefined;

      for (const part of parts) {
        if (part.endsWith('w')) {
          const value = parseInt(part, 10);
          if (Number.isFinite(value)) width = value;
        } else if (part.endsWith('x')) {
          const value = parseFloat(part);
          if (Number.isFinite(value)) density = value;
        }
      }

      return { url, width, density };
    })
    .filter(entry => entry.url);
}

function pickBestSrcsetCandidate(srcset: string): SrcsetCandidate | null {
  if (!srcset) return null;
  const entries = parseSrcset(srcset);
  if (!entries.length) return null;
  let best = entries[0];
  let bestScore = candidateSizeScore(best);
  for (const entry of entries.slice(1)) {
    const score = candidateSizeScore(entry);
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return best;
}

function candidateSizeScore(candidate: SrcsetCandidate): number {
  if (candidate.width) return candidate.width;
  if (candidate.density) return candidate.density * 1000;
  return 0;
}

function parseCssUrls(css: string, base: string): string[] {
  const urls: string[] = [];
  const re = /url\(\s*["']?\s*(.*?)\s*["']?\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const raw = m[1]?.trim();
    if (raw && raw !== 'none') {
      urls.push(resolveUrl(raw, base));
    }
  }
  return urls;
}

function scoreCandidate(
  source: SourceKind,
  img: HTMLImageElement | null,
  candidate?: SrcsetCandidate
): number {
  const elementArea = estimateImageArea(img);
  let candidateArea = 0;
  if (candidate?.width) {
    candidateArea = candidate.width * candidate.width;
  } else if (candidate?.density) {
    candidateArea = candidate.density * 1000;
  }

  const sourceWeight = SOURCE_WEIGHTS[source] ?? 0;
  const sizeScore = Math.max(elementArea, candidateArea);
  return sizeScore > 0 ? sizeScore + sourceWeight : sourceWeight;
}

function estimateImageArea(img: HTMLImageElement | null): number {
  if (!img) return 0;
  const naturalWidth = img.naturalWidth || 0;
  const naturalHeight = img.naturalHeight || 0;
  const layoutWidth = img.width || toInt(img.getAttribute('width'));
  const layoutHeight = img.height || toInt(img.getAttribute('height'));
  const width = Math.max(naturalWidth, layoutWidth);
  const height = Math.max(naturalHeight, layoutHeight);
  if (!width || !height) return 0;
  return width * height;
}

function shouldSkipElement(el: Element | null, seen: WeakSet<Element>): boolean {
  if (!el) return false;
  if (seen.has(el)) return true;
  if (isTinyElement(el)) {
    seen.add(el);
    return true;
  }
  return false;
}

function isTinyElement(el: Element): boolean {
  let width = 0;
  let height = 0;

  if (el instanceof HTMLImageElement) {
    const naturalWidth = el.naturalWidth || 0;
    const naturalHeight = el.naturalHeight || 0;
    const layoutWidth = el.width || toInt(el.getAttribute('width'));
    const layoutHeight = el.height || toInt(el.getAttribute('height'));
    width = Math.max(naturalWidth, layoutWidth);
    height = Math.max(naturalHeight, layoutHeight);
  } else if (el instanceof HTMLElement) {
    width = el.clientWidth || toInt(el.getAttribute('width'));
    height = el.clientHeight || toInt(el.getAttribute('height'));
  }

  if (!width || !height) return false;
  return width < MIN_DIMENSION || height < MIN_DIMENSION;
}

function isNaturalTiny(img: HTMLImageElement): boolean {
  const naturalWidth = img.naturalWidth || 0;
  const naturalHeight = img.naturalHeight || 0;
  if (!naturalWidth || !naturalHeight) return false;
  return naturalWidth < MIN_DIMENSION || naturalHeight < MIN_DIMENSION;
}

function hasLazyAttrs(el: Element, lazyAttrs: readonly string[]): boolean {
  return lazyAttrs.some(attr => el.hasAttribute(attr));
}

function toInt(value: string | null): number {
  if (!value) return 0;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}
