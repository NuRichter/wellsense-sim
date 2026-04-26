// engine/L1_dataStream.js — Layer 1: DAQ Simulation
import { fetchCSV } from '../utils/csvLoader.js';

export const ACTIVE_DATE = '2026-04-27';

export const SENSOR_IDS = [
  { id: 'WHP',      zona: 1 },
  { id: 'WHT',      zona: 1 },
  { id: 'FTHP',     zona: 1 },
  { id: 'Annular',  zona: 1 },
  { id: 'FlowRate', zona: 2 },
  { id: 'Choke',    zona: 2 },
  { id: 'GL_Rate',  zona: 3 },
  { id: 'GL_Press', zona: 3 },
  { id: 'GOR',      zona: 4 },
  { id: 'BSW',      zona: 4 },
];

const allData = {};
let totalRows = 0;
let tickPointer = 0;
let sensorOverride = {};
let anomalyBoost = 0;
let activeDate = ACTIVE_DATE;

const csvPath = (id, date = activeDate) => `data/${date}/sensor_${id}_${date}.csv`;

export async function loadAllCSV(date) {
  if (date) activeDate = date;
  await Promise.all(SENSOR_IDS.map(async s => {
    allData[s.id] = await fetchCSV(csvPath(s.id, activeDate));
  }));
  const minLen = Math.min(...SENSOR_IDS.map(s => allData[s.id].length));
  SENSOR_IDS.forEach(s => { allData[s.id] = allData[s.id].slice(0, minLen); });
  totalRows = minLen;
  tickPointer = 0;
  return totalRows;
}

export function getTotalRows() { return totalRows; }
export function getTickPointer() { return tickPointer; }

export function getNextRow() {
  if (totalRows === 0) return null;
  const merged = { _tick: tickPointer, _stage: 'L1', _daqLayer: 'ROC800L_ModbusTCP_IS_MTL5500' };
  for (const s of SENSOR_IDS) {
    const row = { ...allData[s.id][tickPointer] };
    if (sensorOverride[s.id]) {
      Object.entries(sensorOverride[s.id]).forEach(([col, val]) => {
        if (typeof val === 'function') row[col] = val(row[col], tickPointer);
        else row[col] = val;
      });
    }
    Object.assign(merged, row);
    merged[`_zona_${s.id}`] = s.zona;
  }
  tickPointer = (tickPointer + 1) % totalRows;
  return merged;
}

export function peekRow(idx) {
  if (totalRows === 0) return null;
  const i = ((idx % totalRows) + totalRows) % totalRows;
  const merged = { _tick: i };
  for (const s of SENSOR_IDS) {
    Object.assign(merged, allData[s.id][i]);
  }
  return merged;
}

export function getAllRowsFor(sensorId) {
  return allData[sensorId] || [];
}

export const setAnomalyBoost = v => { anomalyBoost = v; };
export const getAnomalyBoost = () => anomalyBoost;
export const setSensorOverride = (sId, col, val) => {
  sensorOverride[sId] = sensorOverride[sId] || {};
  sensorOverride[sId][col] = val;
};
export const clearOverride = (sId) => { delete sensorOverride[sId]; };
export const clearAllOverrides = () => { sensorOverride = {}; anomalyBoost = 0; };
export const getOverrideKeys = () => Object.keys(sensorOverride);
export const resetTickPointer = () => { tickPointer = 0; };
