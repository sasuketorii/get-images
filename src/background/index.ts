import type {
  MsgToBackground,
  MsgFromBackground,
  ImageItem,
  ScanResult,
  MsgToContent,
} from '../shared/types';

interface TabState {
  images: ImageItem[];
  pageUrl: string;
}

const tabStates = new Map<number, TabState>();

// Open side panel on action click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);

// Handle messages from sidepanel
chrome.runtime.onMessage.addListener(
  (msg: MsgToBackground, sender, sendResponse) => {
    if (msg.type === 'DOWNLOAD_REQUEST') {
      handleDownload(msg.ids, msg.folder, sendResponse);
      return true;
    }

    if (msg.type === 'GET_STATE') {
      handleGetState(sendResponse);
      return true;
    }

    return false;
  }
);

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== 'complete') return;
  autoScan(tabId);
});

async function isActiveTab(tabId: number): Promise<boolean> {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  return activeTab?.id === tabId;
}

async function autoScan(tabId: number) {
  let tab: chrome.tabs.Tab | undefined;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return;
  }

  const url = tab?.url ?? '';

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    tabStates.set(tabId, {
      images: [],
      pageUrl: url,
    });
    if (await isActiveTab(tabId)) {
      broadcast({
        type: 'AUTO_SCAN_COMPLETE',
        images: [],
        pageUrl: url,
      });
    }
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/index.js'],
    });
  } catch {
    tabStates.set(tabId, {
      images: [],
      pageUrl: url,
    });
    if (await isActiveTab(tabId)) {
      broadcast({
        type: 'AUTO_SCAN_COMPLETE',
        images: [],
        pageUrl: url,
      });
    }
    return;
  }

  if (await isActiveTab(tabId)) {
    broadcast({ type: 'AUTO_SCAN_STARTED' });
  }

  try {
    const result: ScanResult = await chrome.tabs.sendMessage(tabId, {
      type: 'SCAN',
    } satisfies MsgToContent);

    tabStates.set(tabId, {
      images: result.images,
      pageUrl: result.pageUrl,
    });

    if (await isActiveTab(tabId)) {
      broadcast({
        type: 'AUTO_SCAN_COMPLETE',
        images: result.images,
        pageUrl: result.pageUrl,
      });
    }
  } catch {
    tabStates.set(tabId, {
      images: [],
      pageUrl: url,
    });
    if (await isActiveTab(tabId)) {
      broadcast({
        type: 'AUTO_SCAN_COMPLETE',
        images: [],
        pageUrl: url,
      });
    }
  }
}

async function handleDownload(
  ids: string[],
  folder: string,
  sendResponse: (msg: MsgFromBackground) => void
) {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const state = tab?.id ? tabStates.get(tab.id) : undefined;
    if (!state) {
      sendResponse({
        type: 'DOWNLOAD_COMPLETE',
        folder,
        total: 0,
        failed: 0,
      });
      return;
    }

    const selected = state.images.filter(img => ids.includes(img.id));
    const total = selected.length;
    let completed = 0;
    let failed = 0;

    const concurrency = 4;
    const queue = selected.map((item, index) => ({ item, index }));

    async function worker() {
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) return;
        const { item, index } = next;
        const filename = buildFilename(item, folder, index);
        try {
          await chrome.downloads.download({
            url: item.url,
            filename,
            conflictAction: 'uniquify',
            saveAs: false,
          });
        } catch {
          failed++;
        }
        completed++;
        broadcast({
          type: 'DOWNLOAD_PROGRESS',
          completed,
          total,
          failed,
        });
      }
    }

    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);

    sendResponse({ type: 'DOWNLOAD_COMPLETE', folder, total, failed });
  } catch (err) {
    sendResponse({ type: 'DOWNLOAD_COMPLETE', folder, total: 0, failed: 0 });
  }
}

async function handleGetState(
  sendResponse: (msg: MsgFromBackground) => void
) {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  const state = tab?.id ? tabStates.get(tab.id) : undefined;
  sendResponse({
    type: 'STATE',
    images: state?.images ?? [],
    pageUrl: state?.pageUrl ?? '',
  });
}

function broadcast(msg: MsgFromBackground) {
  chrome.runtime.sendMessage(msg).catch(() => {});
}

function buildFilename(
  item: ImageItem,
  folder: string,
  index: number
): string {
  const urlObj = new URL(item.url);
  const pathParts = urlObj.pathname.split('/');
  let name = pathParts[pathParts.length - 1] || `image_${index}`;

  // Ensure extension
  if (!/\.\w{2,5}$/.test(name)) {
    name += '.jpg';
  }

  // Sanitize
  name = name.replace(/[<>:"/\\|?*]/g, '_');

  const safeFolder = sanitizePathSegment(folder);
  return safeFolder ? `${safeFolder}/${name}` : name;
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[<>:"/\\|?*]/g, '_').replace(/^\/+|\/+$/g, '');
}
