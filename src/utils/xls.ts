import { Response } from 'express';

export type XlsCell = string | number | boolean | Date | null | undefined;

export interface XlsTable {
  title: string;
  subtitle?: string;
  metadata?: Array<{ label: string; value: XlsCell }>;
  headers: string[];
  rows: XlsCell[][];
}

interface SendXlsOptions {
  filename: string;
  sheetName?: string;
  table: XlsTable;
}

const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const formatCell = (value: XlsCell): string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  return String(value);
};

const buildHtmlTable = (sheetName: string, table: XlsTable): string => {
  const columnCount = Math.max(table.headers.length, 1);

  const metadataRows = (table.metadata ?? [])
    .map(
      (row) => `
        <tr>
          <td style="font-weight:700;background:#f5f5f5;">${escapeHtml(row.label)}</td>
          <td colspan="${Math.max(columnCount - 1, 1)}">${escapeHtml(formatCell(row.value))}</td>
        </tr>`,
    )
    .join('');

  const headerCells = table.headers
    .map((header) => `<th style="background:#e9ecef;font-weight:700;">${escapeHtml(header)}</th>`)
    .join('');

  const bodyRows = table.rows
    .map((row) => {
      const cells = row
        .map((cell) => `<td>${escapeHtml(formatCell(cell))}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="UTF-8" />
    <meta name="ProgId" content="Excel.Sheet" />
    <meta name="Generator" content="Online Shop API" />
    <title>${escapeHtml(sheetName)}</title>
    <style>
      table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
      th, td { border: 1px solid #000; padding: 6px 8px; vertical-align: top; }
      .title { font-size: 16px; font-weight: 700; background: #d9f2d9; }
      .subtitle { font-size: 12px; color: #333; }
    </style>
  </head>
  <body>
    <table>
      <tr>
        <td class="title" colspan="${columnCount}">${escapeHtml(table.title)}</td>
      </tr>
      ${table.subtitle ? `
      <tr>
        <td class="subtitle" colspan="${columnCount}">${escapeHtml(table.subtitle)}</td>
      </tr>` : ''}
      ${metadataRows}
      <tr>${headerCells}</tr>
      ${bodyRows}
    </table>
  </body>
</html>`;
};

export const sendXls = (
  res: Response,
  { filename, sheetName = 'Report', table }: SendXlsOptions,
): void => {
  const html = buildHtmlTable(sheetName, table);
  const safeFilename = filename.replace(/[\r\n"]/g, '_');

  res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  res.status(200).send(`\uFEFF${html}`);
};
