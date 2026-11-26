import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { Resvg } from '@resvg/resvg-js';
import { escapeXml } from '../lib/docxXml.js';

function classifyColor(line, idx) {
  if (idx === 0) return '#8ae234'; // Ubuntu terminal green prompt
  const lower = line.toLowerCase();
  if (lower.includes('error') || lower.includes('fail') || lower.includes('segmentation fault')) {
    return '#ef2929';
  }
  if (/\[pass\]|successfully|ok\b|build successful|passed/i.test(line)) {
    return '#729fcf';
  }
  return '#d3d7cf';
}

function buildTerminalSvg(lines, title) {
  const fontSize = 13;
  const lineHeight = 20;
  const charWidth = 7.9;
  const padX = 18;
  const headerH = 32;
  const padBottom = 18;

  const maxChars = Math.max(55, ...lines.map((l) => l.length));
  const width = Math.max(720, Math.ceil(maxChars * charWidth) + padX * 2);
  const height = headerH + 14 + lines.length * lineHeight + padBottom;

  const textEls = lines
    .map((line, i) => {
      const y = headerH + 22 + i * lineHeight;
      const color = classifyColor(line, i);
      return `<text x="${padX}" y="${y}" fill="${color}" font-family="DejaVu Sans Mono, Liberation Mono, monospace" font-size="${fontSize}" xml:space="preserve">${escapeXml(line)}</text>`;
    })
    .join('\n  ');

  // Crisp vector Linux/GNOME window buttons on the right
  const cy = headerH / 2;
  const minX = width - 64;
  const maxX = width - 42;
  const closeX = width - 20;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height}" rx="8" ry="8" fill="#1b1b1b"/>
  <path d="M0 8 Q0 0 8 0 L${width - 8} 0 Q${width} 0 ${width} 8 L${width} ${headerH} L0 ${headerH} Z" fill="#2c2c2c"/>
  <line x1="0" y1="${headerH}" x2="${width}" y2="${headerH}" stroke="#3c3c3c" stroke-width="1"/>
  <text x="16" y="${cy + 4}" fill="#dcdcdc" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="12" font-weight="600">${escapeXml(title)}</text>
  <!-- Minimize -->
  <line x1="${minX - 5}" y1="${cy}" x2="${minX + 5}" y2="${cy}" stroke="#aaaaaa" stroke-width="1.5" stroke-linecap="round"/>
  <!-- Maximize -->
  <rect x="${maxX - 4.5}" y="${cy - 4.5}" width="9" height="9" fill="none" stroke="#aaaaaa" stroke-width="1.5"/>
  <!-- Close (centered symmetric X) -->
  <line x1="${closeX - 4.5}" y1="${cy - 4.5}" x2="${closeX + 4.5}" y2="${cy + 4.5}" stroke="#aaaaaa" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="${closeX + 4.5}" y1="${cy - 4.5}" x2="${closeX - 4.5}" y2="${cy + 4.5}" stroke="#aaaaaa" stroke-width="1.5" stroke-linecap="round"/>
  ${textEls}
</svg>`;
}

export async function snapCommand(opts) {
  let bodyText = '';
  let cmdLine = '';

  if (opts.cmd) {
    cmdLine = `${opts.prompt}${opts.cmd}`;
    try {
      bodyText = execSync(opts.cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      bodyText = `${err.stdout || ''}${err.stderr || ''}` || err.message;
    }
  } else if (opts.text !== undefined) {
    bodyText = opts.text;
  } else {
    // Read from stdin
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    bodyText = Buffer.concat(chunks).toString('utf8');
  }

  const outputLines = bodyText.replace(/\r\n/g, '\n').trimEnd().split('\n');
  const lines = cmdLine ? [cmdLine, '', ...outputLines] : outputLines;

  const svg = buildTerminalSvg(lines, opts.title);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'original' },
    font: { loadSystemFonts: true },
  });
  const pngBuffer = resvg.render().asPng();

  await fs.mkdir(path.dirname(path.resolve(opts.out)), { recursive: true });
  await fs.writeFile(opts.out, pngBuffer);
  console.log(`Rendered terminal screenshot -> ${opts.out} (${(pngBuffer.length / 1024).toFixed(1)} KB)`);
}
