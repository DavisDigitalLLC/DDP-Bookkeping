import ExcelJS from 'exceljs';
import { addBrandedHeader, BRAND, downloadWorkbook, FONT, loadLogoBuffer, setWorkbookMeta, styleTableHeaderRow, zebraStripe } from './xlsxBranding';

function monthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

/**
 * Renders one Trends-style section (rows with { level, label, glNumber,
 * bold, monthlyTotals, total, average }) into the sheet starting at
 * `cursor`, matching the on-screen table exactly. Returns the next free row.
 */
function addSection(sheet, { title, rows, months, cursor }) {
  if (!rows || rows.length === 0) return cursor;

  const titleRow = sheet.getRow(cursor);
  titleRow.getCell(1).value = title;
  titleRow.getCell(1).font = { name: FONT, size: 13, bold: true, color: { argb: BRAND.deepEvergreen } };
  cursor += 1;

  const headerRowNum = cursor;
  const headerRow = sheet.getRow(headerRowNum);
  headerRow.getCell(1).value = 'G/L#';
  headerRow.getCell(2).value = 'Name';
  months.forEach((m, i) => {
    headerRow.getCell(3 + i).value = monthLabel(m);
  });
  headerRow.getCell(3 + months.length).value = 'Total';
  headerRow.getCell(4 + months.length).value = 'Average';
  styleTableHeaderRow(sheet, headerRowNum);
  cursor += 1;

  const firstDataRow = cursor;
  for (const row of rows) {
    const r = sheet.getRow(cursor);
    r.getCell(1).value = row.glNumber || '';
    r.getCell(2).value = `${'    '.repeat(row.level)}${row.label}`;
    months.forEach((m, i) => {
      const cell = r.getCell(3 + i);
      cell.value = row.monthlyTotals[m] ?? 0;
      cell.numFmt = '$#,##0.00;[RED]($#,##0.00)';
    });
    const totalCell = r.getCell(3 + months.length);
    totalCell.value = row.total;
    totalCell.numFmt = '$#,##0.00;[RED]($#,##0.00)';
    const avgCell = r.getCell(4 + months.length);
    avgCell.value = row.average;
    avgCell.numFmt = '$#,##0.00;[RED]($#,##0.00)';

    if (row.bold) {
      for (let c = 1; c <= 4 + months.length; c++) {
        r.getCell(c).font = { name: FONT, size: 10, bold: true };
      }
    } else {
      r.getCell(1).font = { name: FONT, size: 10 };
      r.getCell(2).font = { name: FONT, size: 10 };
    }
    cursor += 1;
  }
  zebraStripe(sheet, firstDataRow, cursor - 1, 4 + months.length);
  cursor += 1; // spacer
  return cursor;
}

/**
 * Exports the full Income Statement (Revenue, Expenses by Product Line,
 * Expenses by GL Account, Fixed Expenses, Summary) to a single branded
 * .xlsx sheet, mirroring the on-screen tables exactly.
 */
export async function exportIncomeStatementToXlsx(trends, { startMonth, endMonth }) {
  const workbook = new ExcelJS.Workbook();
  setWorkbookMeta(workbook);
  const logoBuffer = await loadLogoBuffer();
  const logoImageId = logoBuffer ? workbook.addImage({ buffer: logoBuffer, extension: 'png' }) : null;

  const sheet = workbook.addWorksheet('Income Statement');
  let cursor = addBrandedHeader(sheet, {
    title: 'Income Statement',
    subtitle: `${startMonth} through ${endMonth}`,
    logoImageId,
    endCol: 4 + trends.months.length,
  });

  cursor = addSection(sheet, { title: 'Revenue', rows: trends.revenueRows, months: trends.months, cursor });
  cursor = addSection(sheet, {
    title: 'Expenses by Service Line / Department / Product',
    rows: trends.expenseByProductRows,
    months: trends.months,
    cursor,
  });
  cursor = addSection(sheet, { title: 'Expenses by GL Account', rows: trends.operatingRows, months: trends.months, cursor });
  cursor = addSection(sheet, { title: 'Fixed Expenses', rows: trends.fixedRows, months: trends.months, cursor });
  addSection(sheet, { title: 'Summary', rows: trends.summaryRows, months: trends.months, cursor });

  sheet.getColumn(1).width = 10;
  sheet.getColumn(2).width = 34;
  for (let i = 0; i < trends.months.length; i++) sheet.getColumn(3 + i).width = 13;
  sheet.getColumn(3 + trends.months.length).width = 14;
  sheet.getColumn(4 + trends.months.length).width = 14;

  await downloadWorkbook(workbook, `DDP-Income-Statement-${startMonth}-to-${endMonth}.xlsx`);
}
