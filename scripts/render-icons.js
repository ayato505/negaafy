// Renders build/icon-src/*.svg into every PNG/ICO size the desktop and Android apps need.
// Run with: npx electron scripts/render-icons.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'build/icon-src/icon.svg'), 'utf8');
// Android adaptive icon: glyph only, scaled into the 66/108 safe zone, on a separate background layer.
const glyph = svg.match(/<g id="glyph"[\s\S]*?<\/g>/)[0];
const defs = svg.match(/<defs>[\s\S]*?<\/defs>/)[0];
// glyph centre is (256, 245); keep it inside the adaptive-icon safe zone
const fgSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}<g transform="translate(256 256) scale(0.82) translate(-256 -245)">${glyph}</g></svg>`;
const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}<rect width="512" height="512" fill="url(#bg)"/></svg>`;
const roundSvg = svg; // the logo is already a circle

async function render(win, markup, size) {
  const html = `<html><body style="margin:0;background:transparent">${markup.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`;
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  await new Promise((r) => setTimeout(r, 150));
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: size, height: size });
  return img.resize({ width: size, height: size, quality: 'best' }).toPNG();
}

function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let off = head.length;
  pngs.forEach(({ size, buf }, i) => {
    const o = 6 + 16 * i;
    head.writeUInt8(size >= 256 ? 0 : size, o); head.writeUInt8(size >= 256 ? 0 : size, o + 1);
    head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(buf.length, o + 8); head.writeUInt32LE(off, o + 12);
    off += buf.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.buf)]);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1100, height: 1100, transparent: true, frame: false, webPreferences: { offscreen: true } });
  const write = (rel, buf) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, buf); };

  write('build/icon.png', await render(win, svg, 512));
  write('build/icon-1024.png', await render(win, svg, 1024));
  const sizes = [256, 128, 64, 48, 32, 24, 16];
  const pngs = [];
  for (const size of sizes) pngs.push({ size, buf: await render(win, svg, size) });
  write('build/icon.ico', ico(pngs));

  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  const res = 'android/app/src/main/res';
  for (const [d, k] of Object.entries(dens)) {
    write(`${res}/mipmap-${d}/ic_launcher.png`, await render(win, svg, Math.round(48 * k)));
    write(`${res}/mipmap-${d}/ic_launcher_round.png`, await render(win, roundSvg, Math.round(48 * k)));
    write(`${res}/mipmap-${d}/ic_launcher_foreground.png`, await render(win, fgSvg, Math.round(108 * k)));
    write(`${res}/mipmap-${d}/ic_launcher_background.png`, await render(win, bgSvg, Math.round(108 * k)));
  }
  write('android/play-store-icon.png', await render(win, svg, 512));
  app.quit();
});
