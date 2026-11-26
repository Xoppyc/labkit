import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Import pdf-parse/lib/pdf-parse.js directly to avoid pdf-parse's infamous self-test on index.js
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

export async function readPdfCommand(file, opts) {
  const buf = await fs.readFile(file);
  const data = await pdfParse(buf);
  let text = data.text.trim();

  if (opts.maxChars && text.length > opts.maxChars) {
    text = text.slice(0, opts.maxChars) + `\n... [truncated at ${opts.maxChars} chars]`;
  }

  const header = `<!-- PDF: ${path.basename(file)} | Pages: ${data.numpages} -->\n\n`;
  const output = header + text + '\n';

  if (opts.out) {
    await fs.mkdir(path.dirname(path.resolve(opts.out)), { recursive: true });
    await fs.writeFile(opts.out, output, 'utf8');
    console.log(`Extracted ${data.numpages} pages -> ${opts.out}`);
  } else {
    process.stdout.write(output);
  }
}
