// Renders the Tempo app icon to build/icon.png and a multi-size build/icon.ico (no dependencies).
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function encodePng(size, rgba) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, k) => a.map((v, j) => v + (b[j] - v) * k);
const TOP = hex('#2a2a2e'), BOTTOM = hex('#0c0c0e'), BLUE = hex('#d4b483'), WHITE = [255, 255, 255];
function sdRoundBox(px, py, half, r) {
  const qx = Math.abs(px) - half + r, qy = Math.abs(py) - half + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  return Math.hypot(pax - bax * h, pay - bay * h);
}

// Returns premultiplied [r,g,b,a] for a point in unit space
function shade(x, y, size) {
  const box = sdRoundBox(x - 0.5, y - 0.5, 0.47, 0.215);
  if (box > 0) return [0, 0, 0, 0];
  let c = mix(TOP, BOTTOM, y);
  if (box > -0.008) c = mix(c, WHITE, 0.12 * (1 - y)); // hairline rim, brighter at the top

  const thick = size <= 32 ? 0.1 : 0.072;
  const dx = x - 0.5, dy = y - 0.5, r = Math.hypot(dx, dy);
  const R = 0.27, sweep = Math.PI * 1.55;
  const a = (Math.atan2(dy, dx) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
  // faint full track, then the blue progress arc with round caps
  if (Math.abs(r - R) <= thick / 2) c = mix(c, WHITE, 0.1);
  let arc = a <= sweep && Math.abs(r - R) <= thick / 2;
  const cap = (ang) => [0.5 + R * Math.cos(ang - Math.PI / 2), 0.5 + R * Math.sin(ang - Math.PI / 2)];
  for (const [cx, cy] of [cap(0), cap(sweep)]) if (Math.hypot(x - cx, y - cy) <= thick / 2) arc = true;
  if (arc) c = BLUE;
  const ct = thick * 0.95;
  if (sdSegment(x, y, 0.395, 0.51, 0.47, 0.585) <= ct / 2 || sdSegment(x, y, 0.47, 0.585, 0.62, 0.43) <= ct / 2) c = WHITE;
  return [c[0], c[1], c[2], 255];
}

function render(size) {
  const SS = 4, buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const s = shade((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size, size);
          const al = s[3] / 255;
          r += s[0] * al; g += s[1] * al; b += s[2] * al; a += al;
        }
      }
      const i = (py * size + px) * 4, n = SS * SS;
      buf[i] = a ? Math.round(r / a) : 0;
      buf[i + 1] = a ? Math.round(g / a) : 0;
      buf[i + 2] = a ? Math.round(b / a) : 0;
      buf[i + 3] = Math.round((a / n) * 255);
    }
  }
  return encodePng(size, buf);
}

const out = path.join(__dirname, '..', 'build');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon.png'), render(512));
fs.writeFileSync(path.join(__dirname, '..', 'renderer', 'icon.png'), render(160));

const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];
const pngs = sizes.map(render);
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
const dir = Buffer.alloc(16 * sizes.length);
let offset = 6 + dir.length;
sizes.forEach((s, i) => {
  const e = i * 16;
  dir[e] = s >= 256 ? 0 : s; dir[e + 1] = s >= 256 ? 0 : s;
  dir.writeUInt16LE(1, e + 4); dir.writeUInt16LE(32, e + 6);
  dir.writeUInt32LE(pngs[i].length, e + 8); dir.writeUInt32LE(offset, e + 12);
  offset += pngs[i].length;
});
fs.writeFileSync(path.join(out, 'icon.ico'), Buffer.concat([header, dir, ...pngs]));
console.log('Wrote build/icon.png and build/icon.ico');
