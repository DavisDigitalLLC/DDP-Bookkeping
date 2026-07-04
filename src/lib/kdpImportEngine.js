import ExcelJS from 'exceljs';
import { supabase } from './supabaseClient';

const COMBINED_SALES_SHEET = 'Combined Sales';
const RECEIVABLE_ACCOUNT_NUMBER = '1100';

/**
 * Reads the "Combined Sales" sheet of a KDP Royalties Estimator export
 * (an .xlsx File/Blob) into an array of row objects keyed by header name.
 */
export async function parseKdpWorkbook(fileOrBuffer) {
  const workbook = new ExcelJS.Workbook();
  const buffer = fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.getWorksheet(COMBINED_SALES_SHEET);
  if (!sheet) {
    throw new Error(`This file doesn't have a "${COMBINED_SALES_SHEET}" sheet -- is it a KDP Royalties Estimator export?`);
  }

  const headerRow = sheet.getRow(1).values; // 1-indexed, values[0] is undefined
  const headers = headerRow.slice(1).map((h) => String(h ?? '').trim());

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values.slice(1);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i];
    });
    // Skip fully blank rows.
    if (Object.values(obj).every((v) => v === undefined || v === null || v === '')) return;
    rows.push(obj);
  });

  return rows;
}

function monthKeyFromDate(value) {
  // ExcelJS may give a Date object or a 'YYYY-MM-DD' string depending on the cell format.
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function lastDayOfMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).toISOString().slice(0, 10);
}

function monthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/**
 * Groups Combined Sales rows by (Title, Author, month), summing Royalty and
 * Net Units Sold within each group -- one group becomes one GL transaction.
 * Non-USD rows are kept separate for manual entry rather than silently
 * skipped or auto-converted.
 */
export function aggregateKdpRows(rows) {
  const usdGroups = new Map(); // key -> group
  const nonUsdRows = [];

  for (const row of rows) {
    const currency = String(row.Currency ?? '').trim().toUpperCase();
    const title = String(row.Title ?? '').trim();
    const author = String(row['Author Name'] ?? '').trim();
    const royalty = Number(row.Royalty ?? 0);
    const units = Number(row['Net Units Sold'] ?? row['Units Sold'] ?? 0);
    const marketplace = String(row.Marketplace ?? '').trim();
    const monthKey = monthKeyFromDate(row['Royalty Date']);

    if (!title || !monthKey) continue;

    if (currency !== 'USD') {
      nonUsdRows.push({ title, author, currency, royalty, units, marketplace, date: row['Royalty Date'] });
      continue;
    }

    const key = `${title}|||${author}|||${monthKey}`;
    if (!usdGroups.has(key)) {
      usdGroups.set(key, {
        key,
        title,
        author,
        monthKey,
        monthLabel: monthLabel(monthKey),
        transactionDate: lastDayOfMonth(monthKey),
        totalRoyalty: 0,
        totalUnits: 0,
        marketplaces: new Set(),
      });
    }
    const group = usdGroups.get(key);
    group.totalRoyalty += royalty;
    group.totalUnits += units;
    if (marketplace) group.marketplaces.add(marketplace);
  }

  const groups = [...usdGroups.values()]
    .map((g) => ({ ...g, totalRoyalty: Math.round(g.totalRoyalty * 100) / 100, marketplaces: [...g.marketplaces] }))
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey) || a.title.localeCompare(b.title));

  return { groups, nonUsdRows };
}

function descriptionFor(group) {
  return `KDP Royalty: ${group.title} — ${group.monthLabel}`;
}

/**
 * Finds an existing transaction that already represents this group, so
 * re-importing the same (or an overlapping) export doesn't double-post.
 * Matches on the exact description + date this importer always generates.
 */
export async function findExistingKdpTransaction(userId, group) {
  const { data, error } = await supabase
    .from('transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('transaction_date', group.transactionDate)
    .eq('description', descriptionFor(group))
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getOrCreateReceivableAccount(userId, accounts, createAccount) {
  const existing = accounts.find((a) => a.account_number === RECEIVABLE_ACCOUNT_NUMBER);
  if (existing) return existing;
  return createAccount({
    accountNumber: RECEIVABLE_ACCOUNT_NUMBER,
    accountName: 'KDP Royalties Receivable',
    accountType: 'asset',
    accountClass: null,
    description: 'Accrued KDP royalty revenue not yet paid out by Amazon (paid ~60 days after the sales month).',
  });
}

export async function getOrCreatePublishingProduct(group, productLines, createProductLine, defaultRevenueAccountId) {
  const existing = productLines.find(
    (p) => p.service_line === 'Publishing' && (p.department ?? '') === group.author && p.product_name === group.title
  );
  if (existing) return existing;
  return createProductLine({
    serviceLine: 'Publishing',
    department: group.author || null,
    productName: group.title,
    description: null,
    defaultRevenueAccountId,
  });
}

export { descriptionFor };
