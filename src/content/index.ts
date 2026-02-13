import { scanImages } from './scan';
import type { MsgToContent, ScanResult } from '../shared/types';

chrome.runtime.onMessage.addListener(
  (msg: MsgToContent, _sender, sendResponse) => {
    if (msg.type === 'SCAN') {
      const result = scanImages();
      sendResponse(result);
    }
    return false;
  }
);
