const DEFAULT_ARC = ['problem', 'solution', 'market', 'proof', 'roadmap'];

const TITLE_BY_INTENT = {
  title: 'Title',
  problem: 'Problem & Context',
  solution: 'Solution Overview',
  market: 'Market Landscape',
  proof: 'Evidence & Impact',
  roadmap: 'Roadmap',
  workflow: 'Workflow',
  metrics: 'Key Metrics',
  compare: 'Comparison',
  overview: 'Overview',
  data: 'Data Snapshot',
};

const buildSlideIds = (count) => Array.from({ length: count }, (_, idx) => `S${idx + 1}`);

const pickIntents = (slideCount) => {
  if (slideCount <= 2) return ['title', 'overview'];
  const intents = ['title'];
  const remaining = slideCount - 1;
  for (let i = 0; i < remaining; i += 1) {
    intents.push(DEFAULT_ARC[i % DEFAULT_ARC.length]);
  }
  return intents.slice(0, slideCount);
};

export const outlineAgent = ({ constraints, storyArc = '', prompt = '' }) => {
  const slideCount = Number(constraints.slide_count || 10);
  const intents = pickIntents(slideCount);
  const slideIds = buildSlideIds(slideCount);
  const slides = slideIds.map((id, idx) => {
    const intent = intents[idx];
    const baseTitle = TITLE_BY_INTENT[intent] || intent;
    const title = idx === 0 && prompt ? `${prompt}`.slice(0, 70) : baseTitle;
    return { id, intent, title };
  });

  return {
    story_arc: storyArc || 'problem→solution→proof→roadmap',
    slides,
  };
};
