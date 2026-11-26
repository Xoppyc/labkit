import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import JSZip from 'jszip';

function decodeEntities(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function extractTextFromXml(xml) {
  const tokens = [];
  const regex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:br\s*\/?>|<w:tab\s*\/?>/g;
  let m;
  while ((m = regex.exec(xml)) !== null) {
    if (m[1] !== undefined) tokens.push(decodeEntities(m[1]));
    else if (m[0].startsWith('<w:br')) tokens.push('\n');
    else tokens.push('\t');
  }
  return tokens.join('').trim();
}

function parseRels(relsXml) {
  const map = new Map();
  const re = /Id="([^"]+)"[^>]*Target="([^"]+)"/g;
  let m;
  while ((m = re.exec(relsXml)) !== null) {
    map.set(m[1], m[2]);
  }
  return map;
}

function tryConvertWmf(wmfPath, pngPath) {
  try {
    execFileSync('convert', ['-density', '300', wmfPath, pngPath], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export async function readDocxCommand(file, opts) {
  const buf = await fs.readFile(file);
  const zip = await JSZip.loadAsync(buf);
  const docXml = await zip.file('word/document.xml')?.async('string');
  if (!docXml) throw new Error('Invalid .docx: missing word/document.xml');

  const relsXml = (await zip.file('word/_rels/document.xml.rels')?.async('string')) || '';
  const rels = parseRels(relsXml);

  // Extract images if requested
  const extractedMedia = new Map();
  if (opts.images) {
    await fs.mkdir(opts.images, { recursive: true });
    for (const [entryName, entry] of Object.entries(zip.files)) {
      if (!entry.dir && entryName.startsWith('word/media/')) {
        const baseName = path.basename(entryName);
        const dest = path.join(opts.images, baseName);
        const data = await entry.async('nodebuffer');
        await fs.writeFile(dest, data);
        if (baseName.toLowerCase().endsWith('.wmf')) {
          const pngDest = dest.replace(/\.wmf$/i, '.png');
          if (tryConvertWmf(dest, pngDest)) {
            extractedMedia.set(`media/${baseName}`, pngDest);
            continue;
          }
        }
        extractedMedia.set(`media/${baseName}`, dest);
      }
    }
  }

  const outLines = [];

  if (opts.variant) {
    // Extract only the requested variant row from tables
    const tables = [...docXml.matchAll(/<w:tbl\b[\s\S]*?<\/w:tbl>/g)];
    tables.forEach((tblMatch, tIdx) => {
      const rows = [...tblMatch[0].matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)];
      outLines.push(`## Table ${tIdx + 1} (Variant ${opts.variant})`);
      let activeFirstCol = '';
      for (const rowMatch of rows) {
        const rawCells = [...rowMatch[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)];
        const cells = rawCells.map((c) => {
          const text = extractTextFromXml(c[0]).replace(/\s+/g, ' ');
          const rids = [...c[0].matchAll(/(?:r:embed|r:id)="([^"]+)"/g)].map((r) => {
            const target = rels.get(r[1]) || r[1];
            return extractedMedia.get(target) || target;
          });
          return rids.length ? `${text} [img: ${rids.join(', ')}]`.trim() : text;
        });
        // Carry forward vertically merged first-column variant numbers
        const hasContinueMerge = rawCells[0] && /<w:vMerge\s*\/>|<w:vMerge[^>]*w:val="continue"/.test(rawCells[0][0]);
        if (cells[0] && !hasContinueMerge) {
          activeFirstCol = cells[0];
        } else if (hasContinueMerge) {
          cells[0] = activeFirstCol;
        }
        if (activeFirstCol && new RegExp(`^${opts.variant}(?:\\D|$)`).test(activeFirstCol)) {
          outLines.push(`| ${cells.join(' | ')} |`);
        }
      }
    });
  } else {
    // Extract paragraphs outside tables + tables as GFM
    const bodyMatch = docXml.match(/<w:body>([\s\S]*)<\/w:body>/);
    const body = bodyMatch ? bodyMatch[1] : docXml;

    // Walk top-level <w:p> and <w:tbl>
    const tokenRe = /<w:tbl\b[\s\S]*?<\/w:tbl>|<w:p\b[\s\S]*?<\/w:p>/g;
    let m;
    while ((m = tokenRe.exec(body)) !== null) {
      const chunk = m[0];
      if (chunk.startsWith('<w:tbl')) {
        const rows = [...chunk.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map((r) =>
          [...r[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map((c) =>
            extractTextFromXml(c[0]).replace(/\s+/g, ' ')
          )
        );
        if (rows.length > 0) {
          outLines.push('');
          outLines.push(`| ${rows[0].join(' | ')} |`);
          outLines.push(`| ${rows[0].map(() => '---').join(' | ')} |`);
          for (const r of rows.slice(1)) {
            outLines.push(`| ${r.join(' | ')} |`);
          }
          outLines.push('');
        }
      } else {
        const txt = extractTextFromXml(chunk);
        if (txt) outLines.push(txt);
      }
    }
  }

  const output = outLines.join('\n') + '\n';
  if (opts.out) {
    await fs.mkdir(path.dirname(path.resolve(opts.out)), { recursive: true });
    await fs.writeFile(opts.out, output, 'utf8');
    console.log(`Extracted ${outLines.length} lines -> ${opts.out}`);
  } else {
    process.stdout.write(output);
  }
}
