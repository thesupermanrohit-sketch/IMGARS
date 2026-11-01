/** Read EXIF orientation without decoding or modifying the JPEG. */
export function getJpegOrientation(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);
  if (view.byteLength < 2 || view.getUint16(0) !== 0xffd8) return 1;

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset++) !== 0xff) break;
    while (offset < view.byteLength && view.getUint8(offset) === 0xff) offset++;
    if (offset >= view.byteLength) break;
    const marker = view.getUint8(offset++);
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > view.byteLength) break;

    const length = view.getUint16(offset);
    const end = offset + length;
    if (length < 2 || end > view.byteLength) break;
    const payload = offset + 2;
    // APP1 payload: "Exif\0\0", then a TIFF header and its first directory.
    if (marker === 0xe1 && payload + 14 <= end &&
        view.getUint32(payload) === 0x45786966 && view.getUint16(payload + 4) === 0) {
      const tiff = payload + 6;
      const byteOrder = view.getUint16(tiff);
      const littleEndian = byteOrder === 0x4949;
      if ((littleEndian || byteOrder === 0x4d4d) && view.getUint16(tiff + 2, littleEndian) === 42) {
        const directoryOffset = view.getUint32(tiff + 4, littleEndian);
        const directory = tiff + directoryOffset;
        if (directoryOffset >= 8 && directory + 2 <= end) {
          const entryCount = view.getUint16(directory, littleEndian);
          for (let index = 0; index < entryCount; index++) {
            const entry = directory + 2 + index * 12;
            if (entry + 12 > end) break;
            if (view.getUint16(entry, littleEndian) === 0x0112 &&
                view.getUint16(entry + 2, littleEndian) === 3 &&
                view.getUint32(entry + 4, littleEndian) === 1) {
              const orientation = view.getUint16(entry + 8, littleEndian);
              if (orientation >= 1 && orientation <= 8) return orientation;
            }
          }
        }
      }
    }
    offset = end;
  }
  return 1;
}
