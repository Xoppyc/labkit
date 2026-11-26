/**
 * Low-level OOXML builders for injecting styled paragraphs, code blocks,
 * tables, links, and embedded images into any existing .docx template.
 */

export function escapeXml(str) {
  return String(str)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // strip XML-illegal control chars
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function makeRun(text, { font = 'Times New Roman', sizePt = 12, bold = false, italic = false, color = null } = {}) {
  const halfPts = Math.round(sizePt * 2);
  const rPrParts = [
    `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>`,
    `<w:sz w:val="${halfPts}"/>`,
    `<w:szCs w:val="${halfPts}"/>`,
  ];
  if (bold) rPrParts.push('<w:b/>');
  if (italic) rPrParts.push('<w:i/>');
  if (color) rPrParts.push(`<w:color w:val="${color}"/>`);

  const lines = String(text).split('\n');
  const inner = lines
    .map((line, idx) => `${idx > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${escapeXml(line)}</w:t>`)
    .join('');

  return `<w:r><w:rPr>${rPrParts.join('')}</w:rPr>${inner}</w:r>`;
}

export function makeParagraph(runsXml, { align = 'both', spaceBeforePt = 0, spaceAfterPt = 5, lineSpacing = 276 } = {}) {
  const before = Math.round(spaceBeforePt * 20);
  const after = Math.round(spaceAfterPt * 20);
  return (
    `<w:p>` +
    `<w:pPr>` +
    `<w:jc w:val="${align}"/>` +
    `<w:spacing w:before="${before}" w:after="${after}" w:line="${lineSpacing}" w:lineRule="auto"/>` +
    `</w:pPr>` +
    `${runsXml}` +
    `</w:p>`
  );
}

/** Supports inline **bold** and `code` inside prose paragraphs. */
export function makeInlineRuns(text, baseOpts = {}) {
  const tokens = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return tokens
    .map((tok) => {
      if (tok.startsWith('**') && tok.endsWith('**')) {
        return makeRun(tok.slice(2, -2), { ...baseOpts, bold: true });
      }
      if (tok.startsWith('`') && tok.endsWith('`')) {
        return makeRun(tok.slice(1, -1), { ...baseOpts, font: 'Courier New', sizePt: (baseOpts.sizePt ?? 12) - 1 });
      }
      return makeRun(tok, baseOpts);
    })
    .join('');
}

export function makeHeading(text, level = 2) {
  const sizePt = level === 1 ? 14 : level === 2 ? 13 : 12;
  return makeParagraph(makeRun(text, { sizePt, bold: true }), {
    align: 'left',
    spaceBeforePt: 11,
    spaceAfterPt: 4,
  });
}

export function makeCodeBlock(code, title = '') {
  const parts = [];
  if (title) {
    parts.push(
      makeParagraph(makeRun(title, { sizePt: 11, bold: true }), {
        align: 'left',
        spaceBeforePt: 7,
        spaceAfterPt: 2,
      })
    );
  }
  const codePara = makeParagraph(
    makeRun(code.trimEnd(), { font: 'Courier New', sizePt: 9.2 }),
    { align: 'left', spaceBeforePt: 3, spaceAfterPt: 3, lineSpacing: 248 }
  );
  parts.push(
    `<w:tbl>` +
      `<w:tblPr>` +
      `<w:tblW w:w="9360" w:type="dxa"/>` +
      `<w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar>` +
      `</w:tblPr>` +
      `<w:tblGrid><w:gridCol w:w="9360"/></w:tblGrid>` +
      `<w:tr><w:tc>` +
      `<w:tcPr>` +
      `<w:tcW w:w="9360" w:type="dxa"/>` +
      `<w:shd w:val="clear" w:color="auto" w:fill="F5F6F8"/>` +
      `<w:tcBorders>` +
      `<w:top w:val="single" w:sz="4" w:space="0" w:color="D0D5DD"/>` +
      `<w:left w:val="single" w:sz="12" w:space="0" w:color="3B82F6"/>` +
      `<w:bottom w:val="single" w:sz="4" w:space="0" w:color="D0D5DD"/>` +
      `<w:right w:val="single" w:sz="4" w:space="0" w:color="D0D5DD"/>` +
      `</w:tcBorders>` +
      `</w:tcPr>` +
      `${codePara}` +
      `</w:tc></w:tr>` +
      `</w:tbl>`
  );
  parts.push(makeParagraph('', { align: 'left', spaceBeforePt: 0, spaceAfterPt: 4 }));
  return parts.join('');
}

export function makeTable(headers, rows) {
  const colCount = headers.length;
  const colW = Math.floor(9360 / Math.max(1, colCount));
  const grid = `<w:tblGrid>${headers.map(() => `<w:gridCol w:w="${colW}"/>`).join('')}</w:tblGrid>`;
  const borders =
    `<w:tblBorders>` +
    `<w:top w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>` +
    `<w:left w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>` +
    `<w:bottom w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>` +
    `<w:right w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>` +
    `<w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>` +
    `<w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>` +
    `</w:tblBorders>`;

  const makeRow = (cells, isHeader = false) =>
    `<w:tr>${cells
      .map((cell) => {
        const shd = isHeader ? `<w:shd w:val="clear" w:color="auto" w:fill="EEF2F6"/>` : '';
        const p = makeParagraph(
          makeInlineRuns(cell, { sizePt: isHeader ? 10.5 : 10, bold: isHeader }),
          { align: 'left', spaceBeforePt: 2, spaceAfterPt: 2, lineSpacing: 240 }
        );
        return `<w:tc><w:tcPr><w:tcW w:w="${colW}" w:type="dxa"/>${shd}</w:tcPr>${p}</w:tc>`;
      })
      .join('')}</w:tr>`;

  const allRows = [makeRow(headers, true), ...rows.map((r) => makeRow(r, false))].join('');
  return (
    `<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/>${borders}` +
    `<w:tblCellMar><w:top w:w="50" w:type="dxa"/><w:bottom w:w="50" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar>` +
    `</w:tblPr>${grid}${allRows}</w:tbl>` +
    makeParagraph('', { align: 'left', spaceBeforePt: 0, spaceAfterPt: 4 })
  );
}

export function makeImageBlock(relId, docPrId, widthEmu, heightEmu, caption = '') {
  const drawing =
    `<w:r><w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${widthEmu}" cy="${heightEmu}"/>` +
    `<wp:docPr id="${docPrId}" name="Picture ${docPrId}"/>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="${docPrId}" name="img_${docPrId}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;

  const imgP = makeParagraph(drawing, { align: 'center', spaceBeforePt: 6, spaceAfterPt: 3 });
  if (!caption) return imgP;
  const capP = makeParagraph(makeRun(caption, { sizePt: 11, italic: true }), {
    align: 'center',
    spaceBeforePt: 0,
    spaceAfterPt: 8,
  });
  return imgP + capP;
}
