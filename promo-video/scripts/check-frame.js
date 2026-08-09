// 校验脚本：解码 PNG，输出平均色 + 品牌/反馈色像素计数
const fs = require('fs');
const zlib = require('zlib');

const buf = fs.readFileSync(process.argv[2]);
let pos = 8;
let width = 0, height = 0, colorType = 0, idat = [];
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
const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};
for (let y = 0; y < height; y++) {
  const filter = raw[y * (stride + 1)];
  const line = y * stride;
  for (let i = 0; i < stride; i++) {
    const x = raw[y * (stride + 1) + 1 + i];
    const left = i >= channels ? out[line + i - channels] : 0;
    const up = y > 0 ? out[line - stride + i] : 0;
    const ul = y > 0 && i >= channels ? out[line - stride + i - channels] : 0;
    let v = x;
    if (filter === 1) v += left;
    else if (filter === 2) v += up;
    else if (filter === 3) v += (left + up) >> 1;
    else if (filter === 4) v += paeth(left, up, ul);
    out[line + i] = v & 0xff;
  }
}
let r = 0, g = 0, b = 0, a = 0, n = 0;
const counts = {green: 0, yellow: 0, white: 0};
const near = (v, t, tol) => Math.abs(v - t) <= tol;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const o = (y * width + x) * channels;
    const [pr, pg, pb] = [out[o], out[o + 1], out[o + 2]];
    r += pr; g += pg; b += pb;
    if (channels === 4) a += out[o + 3];
    n++;
    if (near(pr, 74, 30) && near(pg, 222, 30) && near(pb, 128, 30)) counts.green++;
    else if (near(pr, 250, 25) && near(pg, 204, 30) && near(pb, 21, 40)) counts.yellow++;
    else if (near(pr, 245, 25) && near(pg, 245, 25) && near(pb, 245, 25)) counts.white++;
  }
}
console.log(`size=${width}x${height} ch=${channels} avgRGB=(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})${channels === 4 ? ` alpha=${Math.round(a / n)}` : ''} colors={g:${counts.green},y:${counts.yellow},w:${counts.white}}`);
