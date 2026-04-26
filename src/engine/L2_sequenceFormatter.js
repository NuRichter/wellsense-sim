// engine/L2_sequenceFormatter.js
const SEQ_LEN = 24;
const seqBuffer = [];

export function pushToSequence(featureVector28) {
  seqBuffer.push([...featureVector28]);
  if (seqBuffer.length > SEQ_LEN) seqBuffer.shift();
}

export function getSequence() {
  return seqBuffer.length < SEQ_LEN ? null : seqBuffer.map(r => [...r]);
}

export function getWarmupProgress() {
  return { filled: seqBuffer.length, total: SEQ_LEN };
}

export function reset() { seqBuffer.length = 0; }
