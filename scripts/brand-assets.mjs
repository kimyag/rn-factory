import { Buffer } from 'node:buffer';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';

import { neutrals } from '../packages/core/src/color.ts';
import { validateSettings } from '../packages/core/src/settings.ts';
import { mark } from '../packages/ui/src/tokens.ts';

const imageSize = 1024;
const iconMarkDiameter = imageSize * 0.6;
// Android's guaranteed safe region is the central 66 dp of a 108 dp canvas.
const adaptiveMarkDiameter = imageSize * (60 / 108);
const appsRoot = fileURLToPath(new URL('../apps/', import.meta.url));
const requestedApp = process.argv[2];
if (process.argv.length > 3 || (requestedApp && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(requestedApp))) {
  throw new Error('Usage: pnpm assets:brand [app-folder-name]');
}
const apps = requestedApp
  ? [requestedApp]
  : (await readdir(appsRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);

function colorBytes(hex) {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  name.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return chunk;
}

function renderMark(ink, diameter, background) {
  const foreground = colorBytes(ink);
  const backdrop = background ? colorBytes(background) : undefined;
  const outerRadius = diameter / 2;
  const innerRadius = outerRadius - (mark.ring / mark.size) * diameter;
  const dotRadius = (mark.dot / mark.size) * diameter / 2;
  const pixels = Buffer.alloc((imageSize * 4 + 1) * imageSize);
  let offset = 0;
  for (let y = 0; y < imageSize; y += 1) {
    pixels[offset++] = 0;
    for (let x = 0; x < imageSize; x += 1) {
      const distance = Math.hypot(x + 0.5 - imageSize / 2, y + 0.5 - imageSize / 2);
      const ringCoverage = Math.max(0, Math.min(1, Math.min(outerRadius - distance, distance - innerRadius) + 0.5));
      const dotCoverage = Math.max(0, Math.min(1, dotRadius - distance + 0.5));
      const alpha = Math.round(Math.max(ringCoverage, dotCoverage) * 255);
      for (let channel = 0; channel < 3; channel += 1) {
        pixels[offset++] = backdrop
          ? Math.round((foreground[channel] * alpha + backdrop[channel] * (255 - alpha)) / 255)
          : foreground[channel];
      }
      pixels[offset++] = backdrop ? 255 : alpha;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(imageSize, 0);
  header.writeUInt32BE(imageSize, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(pixels)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const app of apps) {
  const appRoot = resolve(appsRoot, app);
  const { default: input } = await import(pathToFileURL(resolve(appRoot, 'app.settings.ts')).href);
  const { branding: { assets } } = validateSettings(input);
  const assetsRoot = resolve(appRoot, 'assets');
  const outputs = [
    [assets.icon, renderMark(neutrals.light.ink, iconMarkDiameter, neutrals.light.paper)],
    [assets.androidAdaptiveIcon.foreground, renderMark(neutrals.light.ink, adaptiveMarkDiameter)],
    [assets.androidAdaptiveIcon.monochrome, renderMark(neutrals.light.ink, adaptiveMarkDiameter)],
    [assets.splash.image, renderMark(neutrals.light.ink, imageSize)],
    [assets.splash.darkImage, renderMark(neutrals.dark.ink, imageSize)],
  ].map(([relativePath, contents]) => {
    const output = resolve(appRoot, relativePath);
    if (!output.startsWith(`${assetsRoot}${sep}`)) {
      throw new Error(`Generated image path escapes app assets: ${relativePath}`);
    }
    return { output, contents };
  });
  if (new Set(outputs.map(({ output }) => output)).size !== outputs.length) {
    throw new Error(`Brand asset paths must be distinct in ${app}/app.settings.ts`);
  }
  for (const { output, contents } of outputs) {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, contents);
  }
  process.stdout.write(`Generated house-style assets for ${app}\n`);
}
