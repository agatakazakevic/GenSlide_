const RESEARCH_TRIGGERS = [
  'market size',
  'cagr',
  'competitor',
  'competitors',
  'latest',
  'regulation',
  'regulatory',
  'forecast',
];

const needsResearch = (prompt = '') => {
  const lower = prompt.toLowerCase();
  return RESEARCH_TRIGGERS.some((term) => lower.includes(term));
};

export const onlineResearchAgent = async ({ prompt = '', allow = false }) => {
  const required = needsResearch(prompt);
  if (!allow || !required) {
    return { required, evidence: [], datasets: [], openQuestions: required ? ['External research required'] : [] };
  }

  return {
    required,
    evidence: [],
    datasets: [],
    openQuestions: ['Online research not implemented in this environment'],
  };
};
