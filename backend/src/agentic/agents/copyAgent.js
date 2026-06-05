const TITLE_FALLBACKS = {
  title: 'Presentation Title',
  problem: 'Problem Statement',
  solution: 'Solution Overview',
  market: 'Market Snapshot',
  proof: 'Evidence & Impact',
  roadmap: 'Roadmap',
  workflow: 'Workflow',
  metrics: 'Key Metrics',
  compare: 'Comparison',
  overview: 'Overview',
  data: 'Data Snapshot',
};

const takeSentence = (text = '') => {
  const cleaned = String(text).replace(/\s+/g, ' ').trim();
  const parts = cleaned.split(/(?<=[.!?])\s/);
  return parts[0] || cleaned;
};

const clampText = (text, maxChars) => {
  const value = String(text || '').trim();
  if (!maxChars || value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 1)).trim()}…`;
};

const pickEvidence = (evidence = [], used = new Set()) => {
  for (const item of evidence) {
    if (!used.has(item.id)) {
      used.add(item.id);
      return item.text;
    }
  }
  return '';
};

const defaultSteps = ['Intake', 'Process', 'Analyze', 'Synthesize', 'Deliver'];

const defaultPhases = ['Now', 'Next', 'Later'];

const defaultFeatures = ['Capability A', 'Capability B', 'Capability C', 'Capability D', 'Capability E'];

const defaultComparisonRows = ['Speed', 'Cost', 'Risk'];

export const copyAgent = ({ slide, layoutPlan, evidence = [], prompt = '' }) => {
  const used = new Set();
  const slotContent = {};

  layoutPlan.slots.forEach((slot, idx) => {
    let value = '';
    switch (slot.type) {
      case 'title':
        value = slide.title || TITLE_FALLBACKS[slide.intent] || 'Slide Title';
        if (slide.intent === 'title' && prompt) value = prompt.slice(0, 70);
        break;
      case 'subtitle':
        value = takeSentence(prompt) || 'Executive overview';
        break;
      case 'caption':
        value = 'Source: internal materials';
        break;
      case 'callout':
        value = takeSentence(pickEvidence(evidence, used)) || 'MISSING: Supporting evidence';
        break;
      case 'body':
        value = takeSentence(pickEvidence(evidence, used)) || 'MISSING: Key detail';
        break;
      case 'step':
        value = defaultSteps[idx - 1] || `Step ${idx}`;
        break;
      case 'phase':
        value = defaultPhases[idx - 1] || `Phase ${idx}`;
        break;
      case 'kpi':
        value = 'TBD';
        break;
      case 'feature':
        value = defaultFeatures[idx - 1] || `Feature ${idx}`;
        break;
      case 'label':
        value = idx === 1 ? 'Option A' : 'Option B';
        break;
      case 'compare_cell': {
        const rowIndex = Math.floor((idx - 3) / 2);
        const side = (idx - 3) % 2 === 0 ? 'A' : 'B';
        const attribute = defaultComparisonRows[rowIndex] || `Attribute ${rowIndex + 1}`;
        value = `${attribute}: ${side}`;
        break;
      }
      default:
        value = takeSentence(pickEvidence(evidence, used)) || '';
        break;
    }
    slotContent[slot.id] = clampText(value, slot.maxChars);
  });

  return slotContent;
};
