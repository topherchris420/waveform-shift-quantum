/** Local exports only; formula-like CSV strings are neutralized for spreadsheet readers. */
export function download(
  name: string,
  value: unknown,
  type = "application/json",
): void {
  const content =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
export function csv(rows: Record<string, string | number | null>[]): string {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    let s = v === null ? "" : String(v);
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [
    keys.map(cell).join(","),
    ...rows.map((r) => keys.map((k) => cell(r[k])).join(",")),
  ].join("\r\n");
}
export const money = (value: number) =>
  `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}m`;
export const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
