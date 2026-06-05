const buildChartSpec = ({ title, chartType, dataset }) => {
  if (!dataset || !dataset.values || dataset.values.length < 2) {
    return {
      type: chartType || 'bar',
      title,
      labels: ['A', 'B', 'C'],
      datasets: [
        {
          label: 'MISSING DATA',
          data: [0, 0, 0],
          backgroundColor: ['#CBD5F5', '#A7B7F0', '#7D93E8'],
          placeholder: true,
        },
      ],
      placeholder: true,
    };
  }

  const labels = dataset.values.map((_, idx) => `Metric ${idx + 1}`);
  return {
    type: chartType || 'bar',
    title,
    labels,
    datasets: [
      {
        label: dataset.label || 'Series',
        data: dataset.values,
        backgroundColor: ['#3B82F6', '#60A5FA', '#93C5FD', '#22C55E', '#F59E0B'],
      },
    ],
    units: dataset.units || '',
    source: dataset.source,
  };
};

export const chartSpecAgent = ({ slide, layoutPlan, datasets = [] }) => {
  const chartSlots = layoutPlan.slots.filter((slot) => slot.type === 'chart');
  if (!chartSlots.length) return [];

  const dataset = datasets[0];
  return chartSlots.map((slot) => ({
    slotId: slot.id,
    chartSpec: buildChartSpec({
      title: slide.title,
      chartType: slot.chartType,
      dataset,
    }),
  }));
};
