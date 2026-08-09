// ASCII 预览：把 PNG 降采样为字符画（终端里快速目检布局）
// G=绿 Y=黄 #=亮 +=中 .=暗 空格=背景
const fs = require('fs');
const zlib = require('zlib');
const buf = fs.readFileSync(process.argv[2]);
const COLS = parseInt(process.argv[3] || '100', 10);

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
const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};
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
const ROWS = Math.round((COLS * height) / width / 2); // 字符宽高比≈2:1
// 可选裁剪区域 [x0 y0 x1 y1]（原始像素坐标），用于放大细看某区域
let region = null;
if (process.argv[4]) {
  const [x0, y0, x1, y1] = process.argv.slice(4).map(Number);
  region = {x0, y0, x1: x1 || width, y1: y1 || height};
}
const regionW = region ? region.x1 - region.x0 : width;
const regionH = region ? region.y1 - region.y0 : height;
const cellW = regionW / COLS, cellH = regionH / ROWS;
for (let r = 0; r < ROWS; r++) {
  let line = '';
  for (let c = 0; c < COLS; c++) {
    const x0 = region ? region.x0 + Math.floor(c * cellW) : Math.floor(c * cellW);
    const y0 = region ? region.y0 + Math.floor(r * cellH) : Math.floor(r * cellH);
    const x1 = region ? Math.min(region.x1, region.x0 + Math.max(1, Math.floor((c + 1) * cellW))) : Math.max(x0 + 1, Math.floor((c + 1) * cellW));
    const y1 = region ? Math.min(region.y1, region.y0 + Math.max(1, Math.floor((r + 1) * cellH))) : Math.max(y0 + 1, Math.floor((r + 1) * cellH));
    let R = 0, G = 0, B = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const o = (y * width + x) * channels;
      R += out[o]; G += out[o + 1]; B += out[o + 2]; n++;
    }
    R /= n; G /= n; B /= n;
    const lum = (R + G + B) / 3;
    if (G > 120 && R < 160 && B < 180 && G > R * 1.3) line += 'G';
    else if (R > 170 && G > 140 && B < 110) line += 'Y';
    else if (lum > 200) line += '#';
    else if (lum > 110) line += '+';
    else if (lum > 55) line += '.';
    else line += ' ';
  }
  console.log(line);
}
