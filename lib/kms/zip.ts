import { deflateRawSync } from 'node:zlib';

/**
 * Minimale ZIP-maker (geen extra pakket nodig) voor de export van UBL-bestanden.
 * Bestanden worden met deflate ingepakt; bestandsnamen in UTF-8.
 */

let crcTabel: Uint32Array | null = null;
function crc32(buf: Buffer): number {
  if (!crcTabel) {
    crcTabel = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTabel[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTabel[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTijd(d: Date): { tijd: number; datum: number } {
  return {
    tijd: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    datum: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export function maakZip(bestanden: { naam: string; inhoud: string | Buffer }[]): Buffer {
  const delen: Buffer[] = [];
  const centraal: Buffer[] = [];
  let offset = 0;
  const { tijd, datum } = dosTijd(new Date());

  for (const b of bestanden) {
    const naam = Buffer.from(b.naam, 'utf8');
    const data = typeof b.inhoud === 'string' ? Buffer.from(b.inhoud, 'utf8') : b.inhoud;
    const ingepakt = deflateRawSync(data);
    const crc = crc32(data);

    const lokaal = Buffer.alloc(30);
    lokaal.writeUInt32LE(0x04034b50, 0);
    lokaal.writeUInt16LE(20, 4); // versie nodig
    lokaal.writeUInt16LE(0x0800, 6); // UTF-8-namen
    lokaal.writeUInt16LE(8, 8); // deflate
    lokaal.writeUInt16LE(tijd, 10);
    lokaal.writeUInt16LE(datum, 12);
    lokaal.writeUInt32LE(crc, 14);
    lokaal.writeUInt32LE(ingepakt.length, 18);
    lokaal.writeUInt32LE(data.length, 22);
    lokaal.writeUInt16LE(naam.length, 26);
    lokaal.writeUInt16LE(0, 28);
    delen.push(lokaal, naam, ingepakt);

    const kop = Buffer.alloc(46);
    kop.writeUInt32LE(0x02014b50, 0);
    kop.writeUInt16LE(20, 4); // gemaakt met
    kop.writeUInt16LE(20, 6); // versie nodig
    kop.writeUInt16LE(0x0800, 8);
    kop.writeUInt16LE(8, 10);
    kop.writeUInt16LE(tijd, 12);
    kop.writeUInt16LE(datum, 14);
    kop.writeUInt32LE(crc, 16);
    kop.writeUInt32LE(ingepakt.length, 20);
    kop.writeUInt32LE(data.length, 24);
    kop.writeUInt16LE(naam.length, 28);
    kop.writeUInt16LE(0, 30); // extra
    kop.writeUInt16LE(0, 32); // commentaar
    kop.writeUInt16LE(0, 34); // schijf
    kop.writeUInt16LE(0, 36); // interne attributen
    kop.writeUInt32LE(0, 38); // externe attributen
    kop.writeUInt32LE(offset, 42);
    centraal.push(kop, naam);

    offset += lokaal.length + naam.length + ingepakt.length;
  }

  const centraalBuf = Buffer.concat(centraal);
  const eind = Buffer.alloc(22);
  eind.writeUInt32LE(0x06054b50, 0);
  eind.writeUInt16LE(0, 4);
  eind.writeUInt16LE(0, 6);
  eind.writeUInt16LE(bestanden.length, 8);
  eind.writeUInt16LE(bestanden.length, 10);
  eind.writeUInt32LE(centraalBuf.length, 12);
  eind.writeUInt32LE(offset, 16);
  eind.writeUInt16LE(0, 20);
  return Buffer.concat([...delen, centraalBuf, eind]);
}
