export type SourceKind = 'img' | 'srcset' | 'picture' | 'lazy' | 'bg';

export interface ImageItem {
  id: string;
  url: string;
  source: SourceKind;
  width?: number;
  height?: number;
}

export type MsgToBackground =
  | { type: 'SCAN_REQUEST' }
  | { type: 'DOWNLOAD_REQUEST'; ids: string[]; folder: string }
  | { type: 'GET_STATE' };

export type MsgToContent =
  | { type: 'SCAN' };

export interface ScanResult {
  images: ImageItem[];
  pageUrl: string;
}

export type MsgFromBackground =
  | { type: 'SCAN_COMPLETE'; images: ImageItem[]; pageUrl: string }
  | { type: 'SCAN_ERROR'; error: string }
  | { type: 'DOWNLOAD_PROGRESS'; completed: number; total: number; failed: number }
  | { type: 'DOWNLOAD_COMPLETE'; folder: string; total: number; failed: number }
  | { type: 'STATE'; images: ImageItem[]; pageUrl: string };
