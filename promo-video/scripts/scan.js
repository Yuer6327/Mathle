// 垂直亮度分布：统计每个水平条带内 "亮像素"（文字/瓦片）数量
const fs = require('fs');
const zlib = require('zlib');
const buf = fs.readFileSync(process.argv[2]);
const BAND = parseInt(process.argv[3] || '40', 10);
let pos = 8, width = 0, height = 0, colorType = 0, idat = [];
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos);
  const type = buf.toString('ascii', pos + 4, pos + 8);
  const data = buf.subarray(pos + 8, pos + 8 + len);
  if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); colorType = data[9]; }
  else if (type === 'IDAT') idat.push(data);
  else if (type === 'IEND') break;
  pos += 8 + len + 4;
}
const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
const stride = width * channels;
const raw = zlib.inflateSync(Buffer.concat(idat));
const out = Buffer.alloc(height * stride);
const paeth = (a, b, c) => { const p = a + b - c; const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
for (let y = 0; y < height; y++) {
  const f = raw[y * (stride + 1)];
  const l = y * stride;
  for (let i = 0; i < stride; i++) {
    const x = raw[y * (stride + 1) + 1 + i];
    const left = i >= channels ? out[l + i - channels] : 0;
    const up = y > 0 ? out[l - stride + i] : 0;
    const ul = y > 0 && i >= channels ? out[l - stride + i - channels] : 0;
    let v = x;
    if (f === 1) v += left;
    else if (f === 2) v += up;
    else if (f === 3) v += (left + up) >> 1;
    else if (f === 4) v += paeth(left, up, ul);
    out[l + i] = v & 0xff;
  }
}
let band = null;
for (let y = 0; y < height; y += BAND) {
  let bright = 0, total = 0;
  for (let yy = y; yy < Math.min(height, y + BAND); yy++) {
    for (let x = 0; x < width; x++) {
      const o = (yy * width + x) * channels;
      const lum = (out[o] + out[o + 1] + out[o + 2]) / 3;
      if (lum > 40) bright++;
      total++;
    }
  }
  // 判断是否为"面板"背景（偏 #171717 的中等暗度）
  const pct = (bright / total) * 100;
  const bar = '#'.repeat(Math.min(40, Math.round(pct * 4)));
  console.log(`y=${String(y).padStart(4)}-${String(y + BAND - 1).padStart(4)}  bright=${String(bright).padStart(8)} (${pct.toFixed(2)}%) ${bar}`);
}
