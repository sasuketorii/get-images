import type {
  ImageItem,
  MsgToBackground,
  MsgFromBackground,
} from '../shared/types';

const scanBtn = document.getElementById('scan') as HTMLButtonElement;
const grid = document.getElementById('grid') as HTMLElement;
const countBadge = document.getElementById('count') as HTMLElement;
const statusEl = document.getElementById('status') as HTMLElement;
const downloadBar = document.getElementById('download-bar') as HTMLElement;
const downloadBtn = document.getElementById('download') as HTMLButtonElement;
const progressBar = document.getElementById('progress') as HTMLElement;
const progressFill = document.getElementById('progress-fill') as HTMLElement;
const progressText = document.getElementById('progress-text') as HTMLElement;
const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement;

let allImages: ImageItem[] = [];
const selectedIds = new Set<string>();
let pageUrl = '';
let activeDownload: { total: number; failed: number } | null = null;

type Theme = 'light' | 'dark';
const THEME_STORAGE_KEY = 'image-grabber-theme';

initTheme();

themeToggle?.addEventListener('click', () => {
  const current = getTheme();
  const next: Theme = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
  localStorage.setItem(THEME_STORAGE_KEY, next);
});

// Restore state on open
sendMessage({ type: 'GET_STATE' }).then(msg => {
  if (msg?.type === 'STATE' && msg.images.length > 0) {
    allImages = msg.images;
    pageUrl = msg.pageUrl || pageUrl;
    renderGrid();
    showStatus(`${allImages.length} 件の画像を表示中`);
  }
});

// Scan button
scanBtn.addEventListener('click', async () => {
  scanBtn.disabled = true;
  scanBtn.textContent = 'スキャン中...';
  selectedIds.clear();
  showStatus('ページをスキャンしています...');
  grid.innerHTML = '';
  downloadBar.style.display = 'none';

  const response = await sendMessage({ type: 'SCAN_REQUEST' });

  scanBtn.disabled = false;
  scanBtn.textContent = '画像を検出';

  if (!response) {
    showStatus('応答がありません', true);
    return;
  }

  if (response.type === 'SCAN_ERROR') {
    showStatus(response.error, true);
    return;
  }

  if (response.type === 'SCAN_COMPLETE') {
    allImages = response.images;
    pageUrl = response.pageUrl || pageUrl;
    if (allImages.length === 0) {
      showStatus('画像が見つかりませんでした');
      return;
    }
    renderGrid();
    showStatus(`${allImages.length} 件の画像が見つかりました`);
  }
});

// Download button — chrome.downloads API
downloadBtn.addEventListener('click', async () => {
  if (selectedIds.size === 0) return;

  const ids = Array.from(selectedIds);
  const total = ids.length;
  const folder = defaultFolder();
  activeDownload = { total, failed: 0 };

  downloadBtn.disabled = true;
  progressBar.style.display = 'block';
  progressFill.style.width = '0%';
  progressText.textContent = `0 / ${total}`;

  const response = await sendMessage({
    type: 'DOWNLOAD_REQUEST',
    ids,
    folder,
  });

  if (!response || response.type !== 'DOWNLOAD_COMPLETE') {
    downloadBtn.disabled = false;
    progressBar.style.display = 'none';
    activeDownload = null;
    showStatus('ダウンロードに失敗しました', true);
    return;
  }

  const failed = response.failed ?? activeDownload?.failed ?? 0;
  const doneTotal = response.total ?? total;
  progressFill.style.width = '100%';
  progressText.textContent = `${doneTotal} / ${doneTotal}`;
  downloadBtn.disabled = false;
  progressBar.style.display = 'none';
  activeDownload = null;
  const failMsg = failed > 0 ? ` (${failed} 件失敗)` : '';
  showStatus(`${doneTotal - failed} 件のダウンロードが完了しました${failMsg}`);
});

function renderGrid() {
  grid.innerHTML = '';
  downloadBar.style.display = 'flex';

  for (const item of allImages) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = item.id;

    if (selectedIds.has(item.id)) {
      card.classList.add('selected');
    }

    const img = document.createElement('img');
    img.src = item.url;
    img.loading = 'lazy';
    img.alt = '';
    img.onerror = () => {
      img.src = '';
    };

    const info = document.createElement('div');
    info.className = 'card-info';
    const filename = extractFilename(item.url);
    const dims =
      item.width && item.height ? ` ${item.width}x${item.height}` : '';
    info.textContent = `${filename}${dims}`;
    info.title = item.url;

    card.appendChild(img);
    card.appendChild(info);

    card.addEventListener('click', () => toggleSelect(item.id, card));

    grid.appendChild(card);
  }

  updateCount();
}

function toggleSelect(id: string, card: HTMLElement) {
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
    card.classList.remove('selected');
  } else {
    selectedIds.add(id);
    card.classList.add('selected');
  }
  updateCount();
}

function updateCount() {
  countBadge.textContent = String(selectedIds.size);
  downloadBtn.disabled = selectedIds.size === 0;
}

function showStatus(text: string, isError = false) {
  statusEl.style.display = 'block';
  statusEl.textContent = text;
  statusEl.className = isError ? 'status error' : 'status';
}

function defaultFolder(): string {
  const base = pageUrl || allImages[0]?.url || '';
  try {
    const host = new URL(base).hostname;
    return sanitizePathSegment(host || 'images');
  } catch {
    return 'images';
  }
}

function extractFilename(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split('/');
    return decodeURIComponent(parts[parts.length - 1] || 'image');
  } catch {
    return 'image';
  }
}

function buildSafeName(item: ImageItem, index: number): string {
  let name = extractFilename(item.url).replace(/[<>:"/\\|?*]/g, '_');
  if (!/\.\w{2,5}$/.test(name)) {
    name += '.jpg';
  }
  return name;
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[<>:"/\\|?*]/g, '_').replace(/^\/+|\/+$/g, '');
}

chrome.runtime.onMessage.addListener((msg: MsgFromBackground) => {
  if (!activeDownload) return;
  if (msg.type !== 'DOWNLOAD_PROGRESS') return;

  const pct = msg.total > 0 ? Math.round((msg.completed / msg.total) * 100) : 0;
  progressFill.style.width = `${pct}%`;
  progressText.textContent = `${msg.completed} / ${msg.total}`;
  activeDownload.failed = msg.failed;
});

function sendMessage(
  msg: MsgToBackground
): Promise<MsgFromBackground | undefined> {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(msg, response => {
      resolve(response);
    });
  });
}

function initTheme() {
  const stored = getStoredTheme();
  if (stored) {
    applyTheme(stored);
    return;
  }
  applyTheme('light');
}

function getStoredTheme(): Theme | null {
  const value = localStorage.getItem(THEME_STORAGE_KEY);
  return value === 'light' || value === 'dark' ? value : null;
}

function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}
