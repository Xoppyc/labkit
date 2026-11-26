import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import matter from 'gray-matter';
import imageSize from 'image-size';
import { parseMarkdown } from '../lib/mdParser.js';
import {
  makeCodeBlock,
  makeHeading,
  makeImageBlock,
  makeInlineRuns,
  makeParagraph,
  makeRun,
  makeTable,
} from '../lib/docxXml.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_TEMPLATE = path.resolve(__dirname, '../templates/lnu-default.docx');
const EMU_PER_INCH = 914400;

function extractPlainText(pXml) {
  const matches = [...pXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)];
  return matches.map((m) => m[1]).join('');
}

function replaceTemplateMetadata(docXml, meta) {
  // Walk paragraphs in the template header/title page and update known fields cleanly
  let foundWorkSection = false;
  let cutIndex = -1;

  const paraRe = /<w:p\b[\s\S]*?<\/w:p>/g;
  const replacements = [];
  let m;

  while ((m = paraRe.exec(docXml)) !== null) {
    const pXml = m[0];
    const text = extractPlainText(pXml);

    if (text.trim() === 'Хід роботи') {
      foundWorkSection = true;
      cutIndex = m.index + pXml.length;
      break;
    }

    let newPara = null;
    if (meta.lab !== undefined && text.includes('лабораторної роботи №0')) {
      newPara = makeParagraph(
        makeRun(`про виконання лабораторної роботи №${meta.lab}`, { sizePt: 13 }),
        { align: 'center', spaceBeforePt: 0, spaceAfterPt: 4 }
      );
    } else if (meta.title && (text.includes('Приклад звіту') || text.includes('“Приклад'))) {
      newPara = makeParagraph(
        makeRun(`“${meta.title}”`, { sizePt: 13, bold: true }),
        { align: 'center', spaceBeforePt: 0, spaceAfterPt: 6 }
      );
    } else if (meta.group && text.includes('Студент')) {
      newPara = makeParagraph(
        makeRun(`Студент групи ${meta.group}`, { sizePt: 14, bold: true }),
        { align: 'right', spaceBeforePt: 0, spaceAfterPt: 2 }
      );
    } else if (meta.student && text.includes('Кириченко')) {
      newPara = makeParagraph(
        makeRun(meta.student, { sizePt: 14, bold: true }),
        { align: 'right', spaceBeforePt: 0, spaceAfterPt: 4 }
      );
    } else if (meta.teacher && text.includes('Фамілія')) {
      newPara = makeParagraph(
        makeRun(meta.teacher, { sizePt: 14, bold: true }),
        { align: 'right', spaceBeforePt: 0, spaceAfterPt: 4 }
      );
    } else if (meta.topic && text.trim().startsWith('Тема:')) {
      newPara = makeParagraph(
        makeRun('Тема: ', { sizePt: 12, bold: true }) + makeRun(meta.topic, { sizePt: 12 }),
        { align: 'both', spaceBeforePt: 4, spaceAfterPt: 4 }
      );
    } else if (meta.goal && text.trim().startsWith('Мета:')) {
      newPara = makeParagraph(
        makeRun('Мета: ', { sizePt: 12, bold: true }) + makeRun(meta.goal, { sizePt: 12 }),
        { align: 'both', spaceBeforePt: 4, spaceAfterPt: 6 }
      );
    }

    if (newPara) {
      replacements.push({ start: m.index, end: m.index + pXml.length, xml: newPara });
    }
  }

  // Keep sectPr at end of <w:body>
  const sectMatch = docXml.match(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/);
  const sectPr = sectMatch ? sectMatch[0] : '';
  const bodyCloseIdx = docXml.lastIndexOf('</w:body>');

  // Apply replacements from back to front up to cutIndex
  let prefix = foundWorkSection ? docXml.slice(0, cutIndex) : docXml.slice(0, sectMatch ? sectMatch.index : bodyCloseIdx);
  for (let i = replacements.length - 1; i >= 0; i--) {
    const r = replacements[i];
    if (r.end <= prefix.length) {
      prefix = prefix.slice(0, r.start) + r.xml + prefix.slice(r.end);
    }
  }

  const suffix = `${sectPr}${docXml.slice(bodyCloseIdx)}`;
  return { prefix, suffix };
}

export async function reportBuildCommand(markdownPath, opts) {
  if (!opts.out) throw new Error('Missing required option: -o, --out <docx>');

  const mdRaw = await fs.readFile(markdownPath, 'utf8');
  const { data: meta, content } = matter(mdRaw);
  const mdDir = path.dirname(path.resolve(markdownPath));

  const templateFile = opts.template || DEFAULT_TEMPLATE;
  const tplBuf = await fs.readFile(templateFile);
  const zip = await JSZip.loadAsync(tplBuf);

  let docXml = await zip.file('word/document.xml').async('string');
  let relsXml = await zip.file('word/_rels/document.xml.rels').async('string');
  let contentTypesXml = await zip.file('[Content_Types].xml').async('string');

  // Ensure drawing namespaces exist on <w:document>
  if (!docXml.includes('xmlns:wp=')) {
    docXml = docXml.replace(
      '<w:document ',
      '<w:document xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
    );
  }

  // Find next available rId
  const existingRids = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((m) => parseInt(m[1], 10));
  let nextRid = (existingRids.length ? Math.max(...existingRids) : 10) + 1;
  let nextDocPrId = 100;
  let imgCounter = 1;

  const ensureContentType = (ext, mime) => {
    if (!contentTypesXml.includes(`Extension="${ext}"`)) {
      contentTypesXml = contentTypesXml.replace(
        '</Types>',
        `<Default Extension="${ext}" ContentType="${mime}"/></Types>`
      );
    }
  };

  const blocks = parseMarkdown(content);
  const injectedXml = [];

  if (meta.repo) {
    injectedXml.push(
      makeParagraph(
        makeRun('Репозиторій: ', { sizePt: 11, bold: true }) +
          makeRun(meta.repo, { font: 'Courier New', sizePt: 10, italic: true, color: '0046A0' }),
        { align: 'left', spaceBeforePt: 4, spaceAfterPt: 8 }
      )
    );
  }

  for (const block of blocks) {
    if (block.type === 'heading') {
      injectedXml.push(makeHeading(block.text, block.level));
    } else if (block.type === 'paragraph') {
      injectedXml.push(makeParagraph(makeInlineRuns(block.text, { sizePt: 12 })));
    } else if (block.type === 'list') {
      for (const item of block.items) {
        injectedXml.push(
          makeParagraph(makeInlineRuns(`• ${item}`, { sizePt: 12 }), {
            align: 'both',
            spaceBeforePt: 1,
            spaceAfterPt: 3,
          })
        );
      }
    } else if (block.type === 'code') {
      injectedXml.push(makeCodeBlock(block.content, block.title));
    } else if (block.type === 'table') {
      injectedXml.push(makeTable(block.headers, block.rows));
    } else if (block.type === 'image') {
      const imgPath = path.isAbsolute(block.path) ? block.path : path.resolve(mdDir, block.path);
      const imgBuf = await fs.readFile(imgPath);
      const ext = path.extname(imgPath).slice(1).toLowerCase() || 'png';
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
      ensureContentType(ext, mime);

      const dims = imageSize(imgBuf);
      const maxWidthEmu = Math.round(opts.imgWidth * EMU_PER_INCH);
      const aspect = dims.height && dims.width ? dims.height / dims.width : 0.6;
      const heightEmu = Math.round(maxWidthEmu * aspect);

      const mediaName = `labkit_img_${imgCounter++}.${ext}`;
      zip.file(`word/media/${mediaName}`, imgBuf);

      const relId = `rId${nextRid++}`;
      relsXml = relsXml.replace(
        '</Relationships>',
        `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/></Relationships>`
      );

      injectedXml.push(makeImageBlock(relId, nextDocPrId++, maxWidthEmu, heightEmu, block.caption));
    }
  }

  const { prefix, suffix } = replaceTemplateMetadata(docXml, meta);
  const finalDocXml = `${prefix}${injectedXml.join('')}${suffix}`;

  zip.file('word/document.xml', finalDocXml);
  zip.file('word/_rels/document.xml.rels', relsXml);
  zip.file('[Content_Types].xml', contentTypesXml);

  const outBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  await fs.mkdir(path.dirname(path.resolve(opts.out)), { recursive: true });
  await fs.writeFile(opts.out, outBuf);
  console.log(`Built ${opts.out} (${(outBuf.length / 1024).toFixed(1)} KB, ${imgCounter - 1} images)`);
}
