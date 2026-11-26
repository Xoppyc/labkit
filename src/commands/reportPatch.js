import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { escapeXml } from '../lib/docxXml.js';

async function resolveDocxFiles(target) {
  const stat = await fs.stat(target);
  if (stat.isFile()) return [target];
  const entries = await fs.readdir(target);
  return entries
    .filter((f) => f.toLowerCase().endsWith('.docx') && !f.startsWith('~$'))
    .sort()
    .map((f) => path.join(target, f));
}

export async function reportPatchCommand(target, opts) {
  const files = await resolveDocxFiles(target);
  if (files.length === 0) throw new Error(`No .docx files found in ${target}`);

  const findEsc = escapeXml(opts.find);
  const replaceEsc = escapeXml(opts.replace);
  let patchedCount = 0;

  for (const file of files) {
    const buf = await fs.readFile(file);
    const zip = await JSZip.loadAsync(buf);
    const docEntry = zip.file('word/document.xml');
    if (!docEntry) continue;

    let xml = await docEntry.async('string');
    if (!xml.includes(findEsc)) {
      console.log(`  [skip] ${path.basename(file)} (not found)`);
      continue;
    }

    const occurrences = xml.split(findEsc).length - 1;
    xml = xml.split(findEsc).join(replaceEsc);
    zip.file('word/document.xml', xml);

    const outBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    await fs.writeFile(file, outBuf);
    patchedCount++;
    console.log(`  [patched] ${path.basename(file)} (${occurrences}x)`);
  }

  console.log(`Done: patched ${patchedCount}/${files.length} files.`);
}
