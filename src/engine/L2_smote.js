// engine/L2_smote.js
export function computeSmoteWeight(lastNAnomalyFlags) {
  if (!lastNAnomalyFlags || !lastNAnomalyFlags.length) return 2.0;
  const ratio = lastNAnomalyFlags.filter(Boolean).length / lastNAnomalyFlags.length;
  if (ratio < 0.05) return 2.0;
  if (ratio < 0.15) return 1.5;
  return 1.0;
}
