export const renderQaAgent = ({ slideSpec }) => {
  const issues = [];
  if (!slideSpec.components || slideSpec.components.length === 0) {
    issues.push('No components rendered');
  }
  if (slideSpec.components?.some((comp) => comp.type === 'chart' && comp.placeholder)) {
    issues.push('Chart data missing');
  }
  return { issues, score: Math.max(0, 100 - issues.length * 10) };
};
