import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';

const PLACEHOLDER_PATTERNS = [/\[ПІБ[^\]]*\]/g, /Фамілія/g, /Приклад звіту/g, /№0\b/g];

async function resolveDocxFiles(target) {
  const stat = await fs.stat(target);
  if (stat.isFile()) return [target];
  const entries = await fs.readdir(target);
  return entries
    .filter((f) => f.toLowerCase().endsWith('.docx') && !f.startsWith('~$'))
    .sort()
    .map((f) => path.join(target, f));
}

export async function reportVerifyCommand(target) {
  const files = await resolveDocxFiles(target);
  if (files.length === 0) throw new Error(`No .docx files found in ${target}`);

  let hasWarnings = false;

  for (const file of files) {
    const buf = await fs.readFile(file);
    const zip = await JSZip.loadAsync(buf);
    const xml = (await zip.file('word/document.xml')?.async('string')) || '';

    const images = (xml.match(/<a:blip\b/g) || []).length;
    const tables = (xml.match(/<w:tbl\b/g) || []).length;
    const plain = [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join('');

    const foundPlaceholders = [];
    for (const re of PLACEHOLDER_PATTERNS) {
      const m = plain.match(re);
      if (m) foundPlaceholders.push(...m);
    }

    const kb = (buf.length / 1024).toFixed(1);
    const status = foundPlaceholders.length ? `WARN (${foundPlaceholders.join(', ')})` : 'OK';
    if (foundPlaceholders.length) hasWarnings = true;

    console.log(
      `${status.padEnd(24)} | ${path.basename(file).padEnd(36)} | ${kb.padStart(6)} KB | imgs: ${images} | tbls: ${tables}`
    );
  }

  if (hasWarnings) process.exitCode = 2;
}
