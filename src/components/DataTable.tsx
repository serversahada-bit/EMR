import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  /** Kolom angka dirapikan kanan dengan tabular-nums. */
  numeric?: boolean;
  render: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption?: string;
}) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {caption ? (
          <caption className="pb-3 text-left text-xs text-muted">
            {caption}
          </caption>
        ) : null}
        <thead>
          <tr className="border-b border-hairline">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted ${
                  column.numeric ? "text-right" : "text-left"
                }`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-hairline last:border-0"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`px-3 py-2.5 align-middle ${
                    column.numeric ? "tnum text-right text-ink" : "text-ink-2"
                  }`}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
