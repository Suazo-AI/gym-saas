export type CsvColumn = {
  header: string;
  key: string;
};

const FORMULA_PREFIX = /^[=+\-@]/;

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  let cell = String(value);

  if (FORMULA_PREFIX.test(cell)) {
    cell = `'${cell}`;
  }

  if (/[",\r\n]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }

  return cell;
}

export function createCsv(
  rows: ReadonlyArray<Record<string, unknown>>,
  columns: ReadonlyArray<CsvColumn>,
): string {
  const header = columns.map((column) => escapeCsvCell(column.header)).join(",");
  const dataRows = rows.map((row) =>
    columns.map((column) => escapeCsvCell(row[column.key])).join(","),
  );

  return [header, ...dataRows].join("\r\n");
}
