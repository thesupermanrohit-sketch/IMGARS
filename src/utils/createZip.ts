interface ZipEntry {
  name: string;
  blob: Blob;
}

const ZIP_LOCAL_HEADER_SIG = 0x04034b50;
const ZIP_CENTRAL_DIR_SIG = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIR_SIG = 0x06054b50;

const textEncoder = new TextEncoder();
const crcTable = new Uint32Array(256);

for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  crcTable[index] = value >>> 0;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

function createHeader(size: number) {
  const buffer = new ArrayBuffer(size);
  return {
    buffer,
    view: new DataView(buffer),
  };
}

export async function createZip(entries: ZipEntry[]) {
  const localParts: BlobPart[] = [];
  const centralParts: BlobPart[] = [];
  let offset = 0;
  let centralSize = 0;

  for (const entry of entries) {
    const fileName = textEncoder.encode(entry.name);
    const bytes = new Uint8Array(await entry.blob.arrayBuffer());
    const checksum = crc32(bytes);

    const local = createHeader(30);
    writeUint32(local.view, 0, ZIP_LOCAL_HEADER_SIG);
    writeUint16(local.view, 4, 20);
    writeUint16(local.view, 6, 0);
    writeUint16(local.view, 8, 0);
    writeUint16(local.view, 10, 0);
    writeUint16(local.view, 12, 0);
    writeUint32(local.view, 14, checksum);
    writeUint32(local.view, 18, bytes.byteLength);
    writeUint32(local.view, 22, bytes.byteLength);
    writeUint16(local.view, 26, fileName.byteLength);
    writeUint16(local.view, 28, 0);
    localParts.push(local.buffer, fileName, bytes);

    const centralHeaderLength = 46;
    const central = createHeader(centralHeaderLength);
    writeUint32(central.view, 0, ZIP_CENTRAL_DIR_SIG);
    writeUint16(central.view, 4, 20);
    writeUint16(central.view, 6, 20);
    writeUint16(central.view, 8, 0);
    writeUint16(central.view, 10, 0);
    writeUint16(central.view, 12, 0);
    writeUint16(central.view, 14, 0);
    writeUint32(central.view, 16, checksum);
    writeUint32(central.view, 20, bytes.byteLength);
    writeUint32(central.view, 24, bytes.byteLength);
    writeUint16(central.view, 28, fileName.byteLength);
    writeUint16(central.view, 30, 0);
    writeUint16(central.view, 32, 0);
    writeUint16(central.view, 34, 0);
    writeUint16(central.view, 36, 0);
    writeUint32(central.view, 38, 0);
    writeUint32(central.view, 42, offset);
    centralParts.push(central.buffer, fileName);

    centralSize += centralHeaderLength + fileName.byteLength;
    offset += local.buffer.byteLength + fileName.byteLength + bytes.byteLength;
  }

  const end = createHeader(22);
  writeUint32(end.view, 0, ZIP_END_OF_CENTRAL_DIR_SIG);
  writeUint16(end.view, 4, 0);
  writeUint16(end.view, 6, 0);
  writeUint16(end.view, 8, entries.length);
  writeUint16(end.view, 10, entries.length);
  writeUint32(end.view, 12, centralSize);
  writeUint32(end.view, 16, offset);
  writeUint16(end.view, 20, 0);

  return new Blob([...localParts, ...centralParts, end.buffer], {
    type: 'application/zip',
  });
}
