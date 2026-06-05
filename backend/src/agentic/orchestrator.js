import { promptConstraintsAgent } from './agents/promptConstraintsAgent.js';
import { internalRagAgent } from './knowledge/internalRagAgent.js';
import { onlineResearchAgent } from './knowledge/onlineResearchAgent.js';
import { verificationAgent } from './knowledge/verificationAgent.js';
import { outlineAgent } from './agents/outlineAgent.js';
import { layoutPlannerAgent } from './agents/layoutPlannerAgent.js';
import { visualCompositionAgent } from './agents/visualCompositionAgent.js';
import { copyAgent } from './agents/copyAgent.js';
import { chartSpecAgent } from './agents/chartSpecAgent.js';
import { imageAgent } from './agents/imageAgent.js';
import { assemblyAgent } from './assembly/assemblyAgent.js';
import { layoutQaAgent } from './qa/layoutQaAgent.js';
import { evidenceQaAgent } from './qa/evidenceQaAgent.js';
import { renderQaAgent } from './qa/renderQaAgent.js';
import { createEditablePowerPoint, savePowerPoint } from '../services/pptxService.js';

export const runAgenticDeck = async (payload = {}) => {
  const { constraints } = promptConstraintsAgent(payload);
  const prompt = payload.userPrompt || '';
  const documentIds = Array.isArray(payload.documentIds)
    ? payload.documentIds
    : payload.documentId
      ? [payload.documentId]
      : [];

  const state = {
    constraints,
    knowledge: {
      internal_evidence: [],
      external_evidence: [],
      datasets: [],
      open_questions: [],
    },
    deck_plan: {
      story_arc: '',
      slides: [],
    },
    slide_specs: [],
    assets: { charts: [], images: [], icons: [] },
    qa: { issues: [], score: 0 },
  };

  const internal = await internalRagAgent({ query: prompt || 'presentation context', documentIds, topK: 10 });
  const external = await onlineResearchAgent({ prompt, allow: payload.allowExternalResearch === true });
  const verification = verificationAgent({ internalEvidence: internal.evidence, externalEvidence: external.evidence });

  state.knowledge.internal_evidence = internal.evidence;
  state.knowledge.external_evidence = external.evidence;
  state.knowledge.datasets = [...internal.datasets, ...external.datasets];
  state.knowledge.open_questions = [...(external.openQuestions || [])];
  if (internal.coverage < 0.7 && !external.evidence.length) {
    state.knowledge.open_questions.push('Evidence coverage below threshold; consider external research.');
  }

  const deckBlueprint = outlineAgent({ constraints, prompt });
  state.deck_plan = deckBlueprint;

  const visualTokens = visualCompositionAgent();

  const slidePlans = [];
  const slotContents = [];
  const slideAssets = [];
  const qaIssues = [];

  for (let i = 0; i < deckBlueprint.slides.length; i += 1) {
    const slide = deckBlueprint.slides[i];
    const layoutPlan = layoutPlannerAgent({ slide });
    slidePlans.push(layoutPlan);

    const chartSpecs = chartSpecAgent({ slide, layoutPlan, datasets: state.knowledge.datasets });
    const imageSpecs = imageAgent({ slide, layoutPlan });

    const slotContent = copyAgent({
      slide,
      layoutPlan,
      evidence: verification.mergedEvidence,
      prompt,
    });
    slotContents.push(slotContent);

    const assets = {
      chartData: chartSpecs[0]?.chartSpec || null,
      image: imageSpecs[0] || null,
      imageId: imageSpecs[0]?.slotId || null,
      imageBrief: imageSpecs[0]?.brief || '',
      evidenceRefs: verification.mergedEvidence.slice(0, 2).map((item) => item.id),
      visualTokens,
    };

    slideAssets.push(assets);

    const layoutQa = layoutQaAgent({
      layoutPlan,
      slotContent,
      constraints: state.constraints,
      slideIntent: slide.intent,
    });
    const evidenceQa = evidenceQaAgent({ slotContent, evidence: verification.mergedEvidence });

    const slideSpec = {
      slide_id: layoutPlan.slide_id,
      intent: slide.intent,
      pattern: layoutPlan.layout_pattern_id,
      components: layoutPlan.slots.map((slot) => ({
        type: slot.type,
        id: slot.id,
        text: slotContent[slot.id],
        chartSpec: slot.type === 'chart' ? assets.chartData : undefined,
      })),
      evidence_refs: assets.evidenceRefs,
      qa: {
        status: 'checked',
        issues: [...layoutQa.issues, ...evidenceQa.issues],
      },
    };

    const renderQa = renderQaAgent({ slideSpec });
    slideSpec.qa.issues.push(...renderQa.issues);

    qaIssues.push(...slideSpec.qa.issues.map((issue) => ({ slide: slideSpec.slide_id, issue })));
    state.slide_specs.push(slideSpec);

    if (assets.chartData) state.assets.charts.push({ slide: slideSpec.slide_id, chart: assets.chartData });
    if (assets.image) state.assets.images.push({ slide: slideSpec.slide_id, image: assets.image });
  }

  const { slideSpecs, presentation } = assemblyAgent({
    slidePlans,
    slotContents,
    assets: slideAssets,
    metadata: {
      title: prompt || 'Agentic Deck',
      subtitle: constraints.audience,
      theme: payload.theme || 'ir-deck',
      slides: deckBlueprint.slides,
    },
  });

  state.slide_specs = slideSpecs;

  state.qa.issues = qaIssues;
  state.qa.score = Math.max(0, 100 - qaIssues.length * 5);

  let pptxResult = null;
  if (payload.generatePptx) {
    const pptx = await createEditablePowerPoint(presentation, {});
    const filename = `agentic_${Date.now()}.pptx`;
    const filepath = await savePowerPoint(pptx, filename);
    pptxResult = { filename, filepath };
  }

  return {
    state,
    deck_ir: slideSpecs,
    assets: state.assets,
    evidence_bundle: {
      internal: internal.evidence,
      external: external.evidence,
      conflicts: verification.conflicts,
      guidance: verification.guidance,
    },
    qa_report: {
      issues: qaIssues,
      score: state.qa.score,
    },
    presentation,
    pptx: pptxResult,
  };
};
