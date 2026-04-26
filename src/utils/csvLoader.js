// utils/csvLoader.js
export async function fetchCSV(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed: ${path}`);
  const text = await res.text();
  return Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: true }).data
    .filter(r => r.timestamp);
}
