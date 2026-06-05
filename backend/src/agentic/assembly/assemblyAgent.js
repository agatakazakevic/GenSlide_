const mapPatternToLayoutId = (patternId) => {
  switch (patternId) {
    case 'title_hero':
    case 'section_divider':
      return 'title';
    case 'chart_full_with_callouts':
      return 'chart';
    case 'chart_left_insights_right':
      return 'two-column';
    case 'table_full_emphasis_column':
      return 'data';
    case 'comparison_matrix_2x3':
      return 'comparison';
    case 'two_column_image_left_text_right':
    case 'two_column_text_left_image_right':
      return 'image-focus';
    default:
      return 'content';
  }
};

const mapPatternToPresentation = (patternId, slotContent, assets) => {
  switch (patternId) {
    case 'title_hero':
    case 'section_divider':
      return {
        type: 'title',
        title: slotContent.title,
        subtitle: slotContent.subtitle || slotContent.caption || '',
      };
    case 'chart_full_with_callouts':
      return {
        type: 'chart',
        title: slotContent.title,
        subtitle: [slotContent.callout1, slotContent.callout2].filter(Boolean).join(' · '),
        chartData: assets.chartData || null,
      };
    case 'chart_left_insights_right':
      return {
        type: 'two-column',
        title: slotContent.title,
        content: {
          leftColumn: {
            type: 'chart',
            chartData: assets.chartData || null,
          },
          rightColumn: {
            type: 'text',
            items: [slotContent.insight1, slotContent.insight2, slotContent.insight3].filter(Boolean),
          },
        },
      };
    case 'table_full_emphasis_column':
      return {
        type: 'data',
        title: slotContent.title,
        table: assets.tableData || null,
      };
    case 'process_flow_horizontal_5_steps':
      return {
        type: 'content',
        title: slotContent.title,
        content: [slotContent.step1, slotContent.step2, slotContent.step3, slotContent.step4, slotContent.step5].filter(Boolean),
      };
    case 'roadmap_timeline_3_phases':
      return {
        type: 'content',
        title: slotContent.title,
        content: [slotContent.phase1, slotContent.phase2, slotContent.phase3].filter(Boolean),
      };
    case 'kpi_cards_3up':
      return {
        type: 'content',
        title: slotContent.title,
        content: [slotContent.kpi1, slotContent.kpi2, slotContent.kpi3].filter(Boolean),
      };
    case 'comparison_matrix_2x3':
      return {
        type: 'comparison',
        title: slotContent.title,
        leftSide: {
          title: slotContent.left_header,
          content: { items: [slotContent.row1_left, slotContent.row2_left, slotContent.row3_left].filter(Boolean) },
        },
        rightSide: {
          title: slotContent.right_header,
          content: { items: [slotContent.row1_right, slotContent.row2_right, slotContent.row3_right].filter(Boolean) },
        },
      };
    case 'icon_row_3to5_features':
      return {
        type: 'content',
        title: slotContent.title,
        content: [
          slotContent.feature1,
          slotContent.feature2,
          slotContent.feature3,
          slotContent.feature4,
          slotContent.feature5,
        ].filter(Boolean),
      };
    case 'two_column_image_left_text_right':
      return {
        type: 'image-focus',
        title: slotContent.title,
        content: {
          leftColumn: {
            type: 'image',
            placeholderId: assets.imageId || 'image_1',
            prompt: assets.imageBrief || '',
          },
          rightColumn: {
            type: 'text',
            items: [slotContent.body].filter(Boolean),
          },
        },
      };
    case 'two_column_text_left_image_right':
      return {
        type: 'image-focus',
        title: slotContent.title,
        content: {
          leftColumn: {
            type: 'text',
            items: [slotContent.body].filter(Boolean),
          },
          rightColumn: {
            type: 'image',
            placeholderId: assets.imageId || 'image_1',
            prompt: assets.imageBrief || '',
          },
        },
      };
    default:
      return {
        type: 'content',
        title: slotContent.title || 'Slide',
        content: Object.values(slotContent).filter(Boolean),
      };
  }
};

export const assemblyAgent = ({ slidePlans, slotContents, assets, metadata }) => {
  const slideSpecs = slidePlans.map((plan, idx) => {
    const slotContent = slotContents[idx] || {};
    const components = plan.slots.map((slot) => ({
      type: slot.type,
      id: slot.id,
      text: slotContent[slot.id],
      chartSpec: slot.type === 'chart' ? assets[idx]?.chartData : undefined,
      image: slot.type === 'image' ? assets[idx]?.image : undefined,
    }));

    return {
      slide_id: plan.slide_id,
      intent: metadata.slides[idx]?.intent || 'content',
      pattern: plan.layout_pattern_id,
      components,
      evidence_refs: assets[idx]?.evidenceRefs || [],
      qa: { status: 'pending', issues: [] },
    };
  });

  const presentation = {
    metadata: {
      title: metadata.title || 'Agentic Deck',
      subtitle: metadata.subtitle || '',
      author: metadata.author || 'Snapdeck RAG',
      theme: metadata.theme || 'ir-deck',
    },
    slides: slidePlans.map((plan, idx) => {
      const slotContent = slotContents[idx] || {};
      const layoutId = mapPatternToLayoutId(plan.layout_pattern_id);
      return {
        slideId: `slide_${String(idx + 1).padStart(3, '0')}`,
        layoutId,
        patternId: plan.layout_pattern_id,
        ...mapPatternToPresentation(plan.layout_pattern_id, slotContent, assets[idx] || {}),
      };
    }),
  };

  return { slideSpecs, presentation };
};
