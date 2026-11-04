import { FILE_TYPES, type FileType } from '@/lib/export-format';

export type FileChunk = string | Uint8Array<ArrayBuffer>;

/**
 * Minimal shape of the File System Access API this module needs. Not in
 * TypeScript's default DOM lib, so declared locally rather than pulling in an
 * extra @types package for a POC.
 */
interface FileSystemWritableStream {
  write(data: FileChunk): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemAccessWindow extends Window {
  showSaveFilePicker(options?: {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }): Promise<{
    name: string;
    createWritable(): Promise<FileSystemWritableStream>;
  }>;
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

/**
 * Writes an export (CSV or XLSX) to disk one chunk at a time. Two implementations share
 * this interface: the File System Access API streams chunks
 * straight to disk with a flat memory profile; the Blob fallback accumulates
 * chunks in memory and downloads once at close() (for browsers without File
 * System Access support - Safari/Firefox as of 2026).
 */
export interface FileSink {
  open(suggestedName: string, fileType?: FileType): Promise<void>;
  writeChunk(data: FileChunk): Promise<void>;
  close(): Promise<void>;
  /**
   * The file name actually used, once known (after `open()` resolves) —
   * `undefined` before that. For the File System Access path this is the
   * handle's own `name`, which can differ from `suggestedName` if the user
   * renamed it in the save dialog. Browsers deliberately don't expose a full
   * filesystem path to web pages (a security boundary, not an oversight) —
   * this is the most specific location info available from either path.
   */
  getFileName(): string | undefined;
}

function createFileSystemAccessSink(): FileSink {
  let writable: FileSystemWritableStream | null = null;
  let fileName: string | undefined;

  return {
    async open(suggestedName, fileType = FILE_TYPES.csv) {
      const handle = await (window as unknown as FileSystemAccessWindow).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: fileType.description,
            accept: { [fileType.mimeType]: [fileType.extension] },
          },
        ],
      });
      fileName = handle.name;
      writable = await handle.createWritable();
    },
    async writeChunk(data) {
      if (!writable) throw new Error('FileSink.writeChunk called before open()');
      await writable.write(data);
    },
    async close() {
      if (!writable) throw new Error('FileSink.close called before open()');
      await writable.close();
      writable = null;
    },
    getFileName: () => fileName,
  };
}

function createBlobFallbackSink(): FileSink {
  let chunks: FileChunk[] | null = null;
  let fileName: string | undefined;
  let mimeType = FILE_TYPES.csv.mimeType;

  return {
    async open(suggestedName, fileType = FILE_TYPES.csv) {
      fileName = suggestedName;
      mimeType = fileType.mimeType;
      chunks = [];
    },
    async writeChunk(data) {
      if (!chunks) throw new Error('FileSink.writeChunk called before open()');
      chunks.push(data);
    },
    async close() {
      if (!chunks) throw new Error('FileSink.close called before open()');
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName ?? 'export';
        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
      chunks = null;
    },
    getFileName: () => fileName,
  };
}

/** Picks the File System Access sink when supported, else the Blob fallback. */
export function createFileSink(): FileSink {
  return isFileSystemAccessSupported() ? createFileSystemAccessSink() : createBlobFallbackSink();
}
