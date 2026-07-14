// Shared "professional, on-brand" formatting for every .xlsx export in the
// app (Custom Report, Income Statement, Journal) -- one place to keep the
// look consistent instead of re-deriving it per export.

import logoUrl from '../assets/ddp-monogram-transparent.png';

export const BRAND = {
  deepEvergreen: 'FF005A43',
  forestGreen: 'FF0A3D33',
  emeraldAccent: 'FF00C98D',
  mintHighlight: 'FF6FE7BE',
  softGray: 'FFF4F6F5',
  charcoalText: 'FF18211F',
  mutedText: 'FF64736E',
  white: 'FFFFFFFF',
};

const FONT_FAMILY = 'Calibri';

let logoBufferPromise = null;
/** Fetches the DDP monogram once per session and caches the ArrayBuffer. */
export function loadLogoBuffer() {
  if (!logoBufferPromise) {
    logoBufferPromise = fetch(logoUrl)
      .then((r) => r.arrayBuffer())
      .catch(() => null);
  }
  return logoBufferPromise;
}

/**
 * Adds a branded header block to the top of a sheet: logo, report title,
 * subtitle (period/date range), and a generated-on timestamp, followed by
 * a blank spacer row. Returns the 1-indexed row number the caller's actual
 * table content should start on.
 */
export function addBrandedHeader(sheet, { title, subtitle, logoImageId, startCol = 1, endCol = 6 }) {
  sheet.mergeCells(1, startCol, 3, startCol); // logo cell block, 3 rows tall
  if (logoImageId != null) {
    sheet.addImage(logoImageId, {
      tl: { col: startCol - 1 + 0.15, row: 0.15 },
      ext: { width: 46, height: 46 },
    });
  }

  const titleRow = sheet.getRow(1);
  sheet.mergeCells(1, startCol + 1, 1, endCol);
  titleRow.getCell(startCol + 1).value = title;
  titleRow.getCell(startCol + 1).font = { name: FONT_FAMILY, size: 16, bold: true, color: { argb: BRAND.deepEvergreen } };

  if (subtitle) {
    const subtitleRow = sheet.getRow(2);
    sheet.mergeCells(2, startCol + 1, 2, endCol);
    subtitleRow.getCell(startCol + 1).value = subtitle;
    subtitleRow.getCell(startCol + 1).font = { name: FONT_FAMILY, size: 11, color: { argb: BRAND.charcoalText } };
  }

  const metaRow = sheet.getRow(3);
  sheet.mergeCells(3, startCol + 1, 3, endCol);
  metaRow.getCell(startCol + 1).value = `Generated ${new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} — DDP Bookkeeping`;
  metaRow.getCell(startCol + 1).font = { name: FONT_FAMILY, size: 9, italic: true, color: { argb: BRAND.mutedText } };

  sheet.getRow(4).values = []; // spacer
  return 5;
}

/** Applies the branded look to a table header row: deep evergreen fill, white bold text, frozen below it. */
export function styleTableHeaderRow(sheet, rowNumber) {
  const row = sheet.getRow(rowNumber);
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { name: FONT_FAMILY, size: 11, bold: true, color: { argb: BRAND.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.deepEvergreen } };
    cell.alignment = { vertical: 'middle' };
    cell.border = { bottom: { style: 'thin', color: { argb: BRAND.forestGreen } } };
  });
  row.height = 20;
  sheet.views = [{ state: 'frozen', ySplit: rowNumber }];
}

/** Zebra-stripes data rows for readability; call once all rows are added, passing the first/last data row numbers. */
export function zebraStripe(sheet, firstRow, lastRow, colCount) {
  for (let r = firstRow; r <= lastRow; r++) {
    if ((r - firstRow) % 2 === 1) {
      const row = sheet.getRow(r);
      for (let c = 1; c <= colCount; c++) {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.softGray } };
      }
    }
  }
}

export function setWorkbookMeta(workbook) {
  workbook.creator = 'DDP Bookkeeping';
  workbook.lastModifiedBy = 'DDP Bookkeeping';
  workbook.created = new Date();
}

export const FONT = FONT_FAMILY;

export async function downloadWorkbook(workbook, filename) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
