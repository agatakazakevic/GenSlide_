const detectConflicts = (evidence = []) => {
  const conflicts = [];
  const valueMap = new Map();
  evidence.forEach((item) => {
    const numbers = String(item.text || '').match(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?%?/g) || [];
    numbers.forEach((num) => {
      const key = num.replace(/,/g, '');
      if (valueMap.has(key)) {
        const prev = valueMap.get(key);
        if (prev.source?.documentId !== item.source?.documentId) {
          conflicts.push({ value: key, a: prev, b: item });
        }
      } else {
        valueMap.set(key, item);
      }
    });
  });
  return conflicts;
};

export const verificationAgent = ({ internalEvidence = [], externalEvidence = [] }) => {
  const merged = [...internalEvidence, ...externalEvidence];
  const conflicts = detectConflicts(merged);
  return {
    mergedEvidence: merged,
    conflicts,
    guidance: conflicts.length
      ? 'Conflicting values detected; label as ranges or mark uncertainty.'
      : 'Evidence consistent.',
  };
};
