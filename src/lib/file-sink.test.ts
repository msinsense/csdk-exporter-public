import { afterEach, describe, expect, it, vi } from 'vitest';
import { FILE_TYPES } from './export-format';
import { createFileSink, isFileSystemAccessSupported } from './file-sink';

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as { showSaveFilePicker?: unknown }).showSaveFilePicker;
});

describe('isFileSystemAccessSupported', () => {
  it('is false when showSaveFilePicker is not on window', () => {
    expect(isFileSystemAccessSupported()).toBe(false);
  });

  it('is true when showSaveFilePicker is present', () => {
    (window as unknown as { showSaveFilePicker: () => void }).showSaveFilePicker = () => {};
    expect(isFileSystemAccessSupported()).toBe(true);
  });
});

describe('createFileSink — File System Access path', () => {
  it('streams each chunk to the writable stream and closes it', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const createWritable = vi.fn().mockResolvedValue({ write, close });
    const showSaveFilePicker = vi.fn().mockResolvedValue({ name: 'export.csv', createWritable });
    (window as unknown as { showSaveFilePicker: typeof showSaveFilePicker }).showSaveFilePicker =
      showSaveFilePicker;

    const sink = createFileSink();
    await sink.open('export.csv');
    await sink.writeChunk('a,b\r\n');
    await sink.writeChunk('1,2\r\n');
    await sink.close();

    expect(showSaveFilePicker).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: 'export.csv' }),
    );
    expect(write).toHaveBeenNthCalledWith(1, 'a,b\r\n');
    expect(write).toHaveBeenNthCalledWith(2, '1,2\r\n');
    expect(close).toHaveBeenCalledOnce();
  });

  it('offers the given file type in the save dialog', async () => {
    const createWritable = vi.fn().mockResolvedValue({ write: vi.fn(), close: vi.fn() });
    const showSaveFilePicker = vi.fn().mockResolvedValue({ name: 'export.xlsx', createWritable });
    (window as unknown as { showSaveFilePicker: typeof showSaveFilePicker }).showSaveFilePicker =
      showSaveFilePicker;

    await createFileSink().open('export.xlsx', FILE_TYPES.xlsx);

    expect(showSaveFilePicker).toHaveBeenCalledWith({
      suggestedName: 'export.xlsx',
      types: [
        {
          description: 'Excel workbook',
          accept: { [FILE_TYPES.xlsx.mimeType]: ['.xlsx'] },
        },
      ],
    });
  });

  it('exposes the file name from the save dialog, even if the user renamed it', async () => {
    const createWritable = vi.fn().mockResolvedValue({
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    });
    // The user typed a different name into the save dialog than we suggested.
    const showSaveFilePicker = vi.fn().mockResolvedValue({ name: 'my-export.csv', createWritable });
    (window as unknown as { showSaveFilePicker: typeof showSaveFilePicker }).showSaveFilePicker =
      showSaveFilePicker;

    const sink = createFileSink();
    expect(sink.getFileName()).toBeUndefined();

    await sink.open('export.csv');

    expect(sink.getFileName()).toBe('my-export.csv');
  });

  it('throws if writeChunk or close is called before open', async () => {
    (window as unknown as { showSaveFilePicker: () => void }).showSaveFilePicker = () => {};
    const sink = createFileSink();
    await expect(sink.writeChunk('x')).rejects.toThrow(/before open/);
    await expect(sink.close()).rejects.toThrow(/before open/);
  });
});

describe('createFileSink — Blob fallback path', () => {
  it('accumulates chunks and triggers a download only on close', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') el.click = clickSpy;
      return el;
    });

    const sink = createFileSink();
    await sink.open('export.csv');
    await sink.writeChunk('a,b\r\n');
    expect(createObjectURL).not.toHaveBeenCalled();

    await sink.writeChunk('1,2\r\n');
    await sink.close();

    expect(createObjectURL).toHaveBeenCalledOnce();
    const blobArg = createObjectURL.mock.calls[0][0] as Blob;
    expect(await blobArg.text()).toBe('a,b\r\n1,2\r\n');
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    vi.restoreAllMocks();
  });

  it('throws if writeChunk or close is called before open', async () => {
    const sink = createFileSink();
    await expect(sink.writeChunk('x')).rejects.toThrow(/before open/);
    await expect(sink.close()).rejects.toThrow(/before open/);
  });

  it('accepts byte chunks and uses the file type for the Blob', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });

    const sink = createFileSink();
    await sink.open('export.xlsx', FILE_TYPES.xlsx);
    await sink.writeChunk(new Uint8Array([80, 75]));
    await sink.close();

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe(FILE_TYPES.xlsx.mimeType);
    expect(await blob.text()).toBe('PK');
  });

  it('exposes the suggested name (no rename possible — there is no dialog)', async () => {
    const sink = createFileSink();
    expect(sink.getFileName()).toBeUndefined();

    await sink.open('export.csv');

    expect(sink.getFileName()).toBe('export.csv');
  });
});
