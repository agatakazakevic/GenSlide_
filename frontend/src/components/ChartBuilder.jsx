import React, { useMemo, useRef, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Treemap,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import {
  Download,
  Plus,
  Trash2,
  Settings,
  TrendingUp,
  BarChart3,
  Layers,
  GitBranch,
  Activity,
  Target,
  Grid,
  Award,
  ChevronLeft,
} from 'lucide-react';
import { toPng } from 'html-to-image';

const ChartBuilder = ({ onBack }) => {
  const [chartType, setChartType] = useState('line');
  const [psstSection, setPsstSection] = useState('market-status');
  const [title, setTitle] = useState('Revenue Growth');
  const [unitLabel, setUnitLabel] = useState('$M');
  const [data, setData] = useState([
    { label: '2021', value: 100, forecast: false },
    { label: '2022', value: 125, forecast: false },
    { label: '2023', value: 156, forecast: false },
    { label: '2024', value: 195, forecast: false },
    { label: '2025E', value: 240, forecast: true },
    { label: '2026E', value: 288, forecast: true },
  ]);
  const [colors, setColors] = useState({
    primary: '#2563eb',
    secondary: '#10b981',
    forecast: '#94a3b8',
    accent: '#f59e0b',
  });
  const [multiSeries, setMultiSeries] = useState([
    { key: 'seriesA', label: 'Baseline' },
    { key: 'seriesB', label: 'Target' },
  ]);
  const [multiSeriesData, setMultiSeriesData] = useState([
    { label: '2021', seriesA: 100, seriesB: 130 },
    { label: '2022', seriesA: 120, seriesB: 160 },
    { label: '2023', seriesA: 150, seriesB: 190 },
    { label: '2024', seriesA: 180, seriesB: 230 },
  ]);
  const [pieData, setPieData] = useState([
    { label: 'Domestic', value: 45 },
    { label: 'Import', value: 30 },
    { label: 'Other', value: 25 },
  ]);
  const [waffleData, setWaffleData] = useState([
    { label: 'Data accuracy concerns', value: 55, note: 'of companies express concern' },
    { label: 'Fully digitized', value: 21, note: 'of companies are fully digitized' },
    { label: 'Data quality doubts', value: 45, note: 'of companies doubt data quality' },
  ]);
  const [beforeAfterData, setBeforeAfterData] = useState([
    { label: 'Cycle Time', before: 100, after: 65 },
    { label: 'Energy Use', before: 100, after: 72 },
  ]);
  const [bulletData, setBulletData] = useState([
    { label: 'Revenue', value: 72, target: 85, max: 100 },
    { label: 'Margin', value: 48, target: 60, max: 100 },
  ]);
  const [comparisonTable, setComparisonTable] = useState({
    columns: ['Metric', 'Current', 'Our Tech'],
    rows: [
      ['Throughput', '120 units', '180 units'],
      ['Cost per unit', '$12', '$8'],
      ['Energy use', '100%', '72%'],
    ],
  });
  const [ganttData, setGanttData] = useState([
    { task: 'R&D', start: 0, duration: 3 },
    { task: 'Pilot', start: 2, duration: 2 },
    { task: 'Scale', start: 4, duration: 2 },
  ]);
  const [timelineData, setTimelineData] = useState([
    { date: 'Q1', event: 'Prototype' },
    { date: 'Q2', event: 'Pilot' },
    { date: 'Q3', event: 'Certification' },
  ]);
  const [funnelData, setFunnelData] = useState([
    { stage: 'Awareness', value: 10000 },
    { stage: 'Qualified', value: 3200 },
    { stage: 'Signed', value: 900 },
  ]);
  const [trlData, setTrlData] = useState({
    current: 4,
    target: 7,
    max: 9,
    milestones: [2, 4, 6, 8, 9],
  });
  const [kpiCards, setKpiCards] = useState([
    { label: 'Revenue', value: '$240M', change: '+23%' },
    { label: 'CO2 Saved', value: '18k tons', change: '-28%' },
  ]);
  const [quadrantItems, setQuadrantItems] = useState([
    { name: 'A', x: 75, y: 80 },
    { name: 'B', x: 30, y: 70 },
    { name: 'C', x: 80, y: 35 },
    { name: 'D', x: 25, y: 30 },
  ]);
  const [growthCallout, setGrowthCallout] = useState('Revenue milestone reached');
  const [growthCaption, setGrowthCaption] = useState('Goal: 40% margin with steady scale to 2028.');
  const [revenueMixTitle, setRevenueMixTitle] = useState('Revenue Plan');
  const [revenueMixSubtitle, setRevenueMixSubtitle] = useState('Revenue Mix');
  const [pricingTitle, setPricingTitle] = useState('Pricing Model');
  const [pricingSummary, setPricingSummary] = useState('SaaS subscription + usage fee');
  const [pricingDetails, setPricingDetails] = useState([
    'Enterprise license (monthly / annual)',
    'Base fee + overage usage',
    'Optional success fee',
  ]);
  const [conciergeTitle, setConciergeTitle] = useState('Concierge');
  const [conciergeDetails, setConciergeDetails] = useState([
    'Managed service',
    'Reporting, review, and submission support',
  ]);
  const [marketSizeRings, setMarketSizeRings] = useState([
    { label: 'TAM', amount: '1.6T', color: '#fed7aa' },
    { label: 'SAM', amount: '1.1T', color: '#fdba74' },
    { label: 'SOM', amount: '0.47T', color: '#fb923c' },
  ]);
  const [isExporting, setIsExporting] = useState(false);
  const chartRef = useRef(null);

  const chartTypes = [
    { id: 'bar', name: 'Bar Chart', icon: BarChart3 },
    { id: 'grouped', name: 'Grouped Bar', icon: Layers },
    { id: 'stacked', name: 'Stacked Bar', icon: Layers },
    { id: 'line', name: 'Line Chart', icon: TrendingUp },
    { id: 'combo', name: 'Combo Chart', icon: GitBranch },
    { id: 'waterfall', name: 'Waterfall', icon: Activity },
    { id: 'before-after', name: 'Before / After', icon: Activity },
    { id: 'comparison-table', name: 'Comparison Table', icon: Grid },
    { id: 'kpi-table', name: 'KPI Table', icon: Grid },
    { id: 'gantt', name: 'Gantt / Roadmap', icon: Target },
    { id: 'timeline', name: 'Timeline', icon: Activity },
    { id: 'funnel', name: 'Funnel', icon: Target },
    { id: 'trl', name: 'TRL Progress', icon: Activity },
    { id: 'pie', name: 'Pie', icon: Grid },
    { id: 'donut', name: 'Donut', icon: Grid },
    { id: 'quadrant', name: '2x2 Quadrant', icon: Grid },
    { id: 'kpi-cards', name: 'KPI Cards', icon: Award },
    { id: 'treemap', name: 'Treemap', icon: Grid },
    { id: 'bullet', name: 'Bullet Chart', icon: Target },
    { id: 'waffle', name: 'Waffle Chart', icon: Grid },
    { id: 'growth-curve', name: 'Growth Curve', icon: TrendingUp },
    { id: 'revenue-mix', name: 'Revenue Mix Plan', icon: Layers },
    { id: 'bar-line', name: 'Bar + Line', icon: GitBranch },
    { id: 'market-size', name: 'Market Size', icon: Target },
  ];

  const psstSections = [
    { id: 'market-status', label: 'Market Status', required: ['bar', 'line'] },
    { id: 'solution-tech', label: 'Solution & Tech', required: ['comparison-table', 'trl'] },
    { id: 'rd-plan', label: 'R&D Plan', required: ['gantt', 'timeline'] },
    { id: 'scale-up', label: 'Scale-up', required: ['line', 'funnel'] },
    { id: 'budget', label: 'Budget', required: ['stacked', 'waterfall', 'pie'] },
    { id: 'impact', label: 'Impact', required: ['before-after', 'bar'] },
  ];

  const recommendedChartIds = useMemo(() => {
    const section = psstSections.find((item) => item.id === psstSection);
    return new Set(section?.required || []);
  }, [psstSection]);

  const addDataPoint = () => {
    setData([...data, { label: `Point ${data.length + 1}`, value: 0, forecast: false }]);
  };

  const updateDataPoint = (index, field, value) => {
    const newData = [...data];
    newData[index][field] = field === 'value' ? parseFloat(value) || 0 : value;
    setData(newData);
  };

  const removeDataPoint = (index) => {
    setData(data.filter((_, i) => i !== index));
  };

  const exportChart = async () => {
    if (!chartRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(chartRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      link.download = `${title.replace(/\s+/g, '-').toLowerCase() || 'chart'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const seriesColors = [colors.primary, colors.secondary, colors.accent, colors.forecast];

  const formatValue = (value) => {
    if (!unitLabel) return value;
    const trimmed = unitLabel.trim();
    if (!trimmed) return value;
    if (trimmed.startsWith('$') || trimmed.startsWith('₩') || trimmed.startsWith('€')) {
      return `${trimmed}${value}`;
    }
    return `${value} ${trimmed}`;
  };

  const updateMultiSeriesLabel = (index, value) => {
    setMultiSeries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], label: value };
      return next;
    });
  };

  const updateMultiSeriesValue = (rowIndex, seriesKey, value) => {
    setMultiSeriesData((prev) => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [seriesKey]: Number(value) || 0 };
      return next;
    });
  };

  const updateMultiSeriesLabelValue = (rowIndex, value) => {
    setMultiSeriesData((prev) => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], label: value };
      return next;
    });
  };

  const addMultiSeriesRow = () => {
    setMultiSeriesData((prev) => [
      ...prev,
      { label: `Row ${prev.length + 1}`, ...multiSeries.reduce((acc, series) => ({ ...acc, [series.key]: 0 }), {}) },
    ]);
  };

  const removeMultiSeriesRow = (index) => {
    setMultiSeriesData((prev) => prev.filter((_, idx) => idx !== index));
  };

  const addSeries = () => {
    const key = `series${String.fromCharCode(65 + multiSeries.length)}`;
    setMultiSeries((prev) => [...prev, { key, label: `Series ${prev.length + 1}` }]);
    setMultiSeriesData((prev) =>
      prev.map((row) => ({
        ...row,
        [key]: 0,
      }))
    );
  };

  const removeSeries = (index) => {
    setMultiSeries((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      const removed = prev[index];
      setMultiSeriesData((rows) =>
        rows.map((row) => {
          const nextRow = { ...row };
          delete nextRow[removed.key];
          return nextRow;
        })
      );
      return next;
    });
  };

  const renderLineChart = () => (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={multiSeriesData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" stroke="#6b7280" style={{ fontSize: 12 }} />
        <YAxis stroke="#6b7280" style={{ fontSize: 12 }} tickFormatter={formatValue} />
        <Tooltip
          contentStyle={{ background: '#fff', border: '1px solid #e5e7eb' }}
          formatter={(value) => formatValue(value)}
        />
        <Legend />
        {multiSeries.map((series, idx) => (
          <Line
            key={series.key}
            type="monotone"
            dataKey={series.key}
            stroke={seriesColors[idx % seriesColors.length]}
            strokeWidth={3}
            dot={{ fill: seriesColors[idx % seriesColors.length], r: 5 }}
            name={series.label}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );

  const renderBarChart = () => (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data} layout="vertical" margin={{ top: 20, right: 30, left: 60, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis type="number" stroke="#6b7280" style={{ fontSize: 12 }} tickFormatter={formatValue} />
        <YAxis dataKey="label" type="category" stroke="#6b7280" style={{ fontSize: 12 }} />
        <Tooltip
          contentStyle={{ background: '#fff', border: '1px solid #e5e7eb' }}
          formatter={(value) => formatValue(value)}
        />
        <Legend />
        <Bar dataKey="value" name="Value" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.forecast ? colors.forecast : colors.primary} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  const renderGroupedChart = () => (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={multiSeriesData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" stroke="#6b7280" style={{ fontSize: 12 }} />
        <YAxis stroke="#6b7280" style={{ fontSize: 12 }} tickFormatter={formatValue} />
        <Tooltip
          contentStyle={{ background: '#fff', border: '1px solid #e5e7eb' }}
          formatter={(value) => formatValue(value)}
        />
        <Legend />
        {multiSeries.map((series, idx) => (
          <Bar
            key={series.key}
            dataKey={series.key}
            name={series.label}
            fill={seriesColors[idx % seriesColors.length]}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );

  const renderStackedChart = () => (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={multiSeriesData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" stroke="#6b7280" style={{ fontSize: 12 }} />
        <YAxis stroke="#6b7280" style={{ fontSize: 12 }} tickFormatter={formatValue} />
        <Tooltip
          contentStyle={{ background: '#fff', border: '1px solid #e5e7eb' }}
          formatter={(value) => formatValue(value)}
        />
        <Legend />
        {multiSeries.map((series, idx) => (
          <Bar
            key={series.key}
            dataKey={series.key}
            stackId="a"
            fill={seriesColors[idx % seriesColors.length]}
            name={series.label}
            radius={idx === multiSeries.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );

  const renderComboChart = () => (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" stroke="#6b7280" style={{ fontSize: 12 }} />
        <YAxis stroke="#6b7280" style={{ fontSize: 12 }} tickFormatter={formatValue} />
        <Tooltip
          contentStyle={{ background: '#fff', border: '1px solid #e5e7eb' }}
          formatter={(value) => formatValue(value)}
        />
        <Legend />
        <Bar dataKey="value" fill={colors.primary} name="Volume" radius={[4, 4, 0, 0]} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={colors.secondary}
          strokeWidth={3}
          name="Trend"
          dot={{ fill: colors.secondary, r: 5 }}
          data={data.map((d) => ({ ...d, value: d.value * 1.1 }))}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );

  const renderWaterfall = () => {
    let cumulative = 0;
    const waterfallData = data.map((d) => {
      const start = cumulative;
      cumulative += d.value;
      return { label: d.label, start, end: cumulative, value: d.value };
    });

    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={waterfallData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="label" stroke="#6b7280" style={{ fontSize: 12 }} />
          <YAxis stroke="#6b7280" style={{ fontSize: 12 }} tickFormatter={formatValue} />
          <Tooltip
            contentStyle={{ background: '#fff', border: '1px solid #e5e7eb' }}
            formatter={(value) => formatValue(value)}
          />
          <Bar dataKey="end" fill="transparent" />
          <Bar dataKey="value" radius={[4, 4, 4, 4]}>
            {waterfallData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.value >= 0 ? colors.primary : '#ef4444'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderKPITable = () => {
    return (
      <div className="overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              {comparisonTable.columns.map((column, idx) => (
                <th
                  key={`col-${idx}`}
                  className={`border border-gray-300 px-4 py-2 font-semibold ${
                    idx === 0 ? 'text-left' : 'text-right'
                  }`}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparisonTable.rows.map((row, rowIdx) => (
              <tr key={`row-${rowIdx}`} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {row.map((cell, cellIdx) => (
                  <td
                    key={`cell-${rowIdx}-${cellIdx}`}
                    className={`border border-gray-300 px-4 py-2 ${
                      cellIdx === 0 ? 'font-medium text-left' : 'text-right'
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderComparisonTable = () => renderKPITable();

  const renderCohortHeatmap = () => {
    const cohorts = ['Q1 2023', 'Q2 2023', 'Q3 2023', 'Q4 2023'];
    const months = ['M0', 'M1', 'M2', 'M3', 'M4', 'M5'];
    const heatmapData = cohorts.map((c, i) =>
      months.map((m, j) => Math.max(0, 100 - (i * 5 + j * 8)))
    );

    const getColor = (value) => {
      if (value >= 80) return 'bg-green-600';
      if (value >= 60) return 'bg-green-400';
      if (value >= 40) return 'bg-yellow-400';
      if (value >= 20) return 'bg-orange-400';
      return 'bg-red-400';
    };

    return (
      <div className="overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border border-gray-300 px-3 py-2 bg-gray-100 text-left font-semibold">Cohort</th>
              {months.map((m) => (
                <th key={m} className="border border-gray-300 px-3 py-2 bg-gray-100 text-center font-semibold">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.map((c, i) => (
              <tr key={c}>
                <td className="border border-gray-300 px-3 py-2 font-medium bg-gray-50">{c}</td>
                {heatmapData[i].map((v, j) => (
                  <td
                    key={`${c}-${j}`}
                    className={`border border-gray-300 px-3 py-2 text-center text-white font-semibold ${getColor(
                      v
                    )}`}
                  >
                    {v}%
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderGantt = () => {
    const maxRange = Math.max(
      ...ganttData.map((item) => item.start + item.duration),
      8
    );
    return (
      <div className="space-y-3">
        <div className="flex text-xs text-gray-600 mb-2">
          <div className="w-48"></div>
          {[...Array(maxRange)].map((_, i) => (
            <div key={`q-${i}`} className="flex-1 text-center">
              M{i + 1}
            </div>
          ))}
        </div>
        {ganttData.map((item, idx) => (
          <div key={`${item.task}-${idx}`} className="flex items-center">
            <div className="w-48 text-sm font-medium pr-4">{item.task}</div>
            <div className="flex-1 flex">
              <div style={{ width: `${(item.start / maxRange) * 100}%` }}></div>
              <div
                style={{
                  width: `${(item.duration / maxRange) * 100}%`,
                  backgroundColor: seriesColors[idx % seriesColors.length],
                }}
                className="h-8 rounded flex items-center justify-center text-white text-xs font-semibold"
              >
                {item.duration}M
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderTimeline = () => {
    return (
      <div className="relative py-8">
        <div className="absolute left-1/2 transform -translate-x-1/2 w-1 h-full bg-gray-300"></div>
        {timelineData.map((m, i) => (
          <div key={m.event} className={`flex items-center mb-8 ${i % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}>
            <div className={`w-5/12 ${i % 2 === 0 ? 'text-right pr-8' : 'text-left pl-8'}`}>
              <div className="font-semibold text-sm">{m.date}</div>
              <div className="text-gray-600 text-xs">{m.event}</div>
            </div>
            <div className="relative z-10">
              <div
                className="w-4 h-4 rounded-full border-4 border-white"
                style={{ backgroundColor: seriesColors[i % seriesColors.length] }}
              ></div>
            </div>
            <div className="w-5/12"></div>
          </div>
        ))}
      </div>
    );
  };

  const renderFunnel = () => {
    const maxValue = Math.max(...funnelData.map((item) => item.value), 1);

    return (
      <div className="space-y-2 py-8">
        {funnelData.map((item, i) => {
          const width = (item.value / maxValue) * 100;
          return (
            <div key={item.stage} className="flex items-center gap-4">
              <div className="w-32 text-sm font-medium text-right">{item.stage}</div>
              <div className="flex-1">
                <div
                  className="h-12 flex items-center justify-center text-white font-semibold text-sm"
                  style={{
                    width: `${width}%`,
                    backgroundColor: seriesColors[i % seriesColors.length],
                    clipPath: i === 0 ? 'none' : 'polygon(5% 0%, 100% 0%, 95% 100%, 0% 100%)',
                  }}
                >
                  {item.value.toLocaleString()} ({Math.round((item.value / maxValue) * 100)}%)
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderQuadrant = () => {
    return (
      <div className="relative w-full h-96 border-2 border-gray-300">
        <div className="absolute inset-0 flex">
          <div className="w-1/2 h-full bg-yellow-50 border-r border-gray-300"></div>
          <div className="w-1/2 h-full bg-green-50"></div>
        </div>
        <div className="absolute inset-0 flex flex-col">
          <div className="h-1/2 border-b border-gray-300"></div>
          <div className="h-1/2"></div>
        </div>
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 text-xs font-semibold text-gray-600">
          High Impact
        </div>
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs font-semibold text-gray-600">
          Low Impact
        </div>
        <div className="absolute left-2 top-1/2 transform -translate-y-1/2 -rotate-90 text-xs font-semibold text-gray-600">
          High Effort
        </div>
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 rotate-90 text-xs font-semibold text-gray-600">
          Low Effort
        </div>
        {quadrantItems.map((item) => (
          <div
            key={item.name}
            className="absolute w-16 h-16 rounded-full flex items-center justify-center text-xs font-semibold text-white shadow-lg"
            style={{
              left: `${item.x}%`,
              top: `${100 - item.y}%`,
              transform: 'translate(-50%, -50%)',
              backgroundColor: colors.primary,
            }}
          >
            {item.name}
          </div>
        ))}
      </div>
    );
  };

  const renderKPICards = () => {
    return (
      <div className="grid grid-cols-2 gap-4">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="bg-white border-2 border-gray-200 rounded-lg p-6">
            <div className="text-sm text-gray-600 mb-2">{kpi.label}</div>
            <div className="text-3xl font-bold mb-2">{kpi.value}</div>
            <div className="text-sm font-semibold text-green-600">{kpi.change} vs LY</div>
          </div>
        ))}
      </div>
    );
  };

  const renderPieChart = (innerRadius = 0) => (
    <ResponsiveContainer width="100%" height={400}>
      <PieChart>
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="label"
          innerRadius={innerRadius}
          outerRadius={140}
          paddingAngle={2}
        >
          {pieData.map((entry, index) => (
            <Cell key={`slice-${entry.label}`} fill={seriesColors[index % seriesColors.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => formatValue(value)} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );

  const renderTreemap = () => (
    <ResponsiveContainer width="100%" height={320}>
      <Treemap
        data={pieData.map((entry, idx) => ({
          ...entry,
          name: entry.label,
          fill: seriesColors[idx % seriesColors.length],
        }))}
        dataKey="value"
        nameKey="name"
        stroke="#ffffff"
      />
    </ResponsiveContainer>
  );

  const renderBullet = () => {
    const maxValue = Math.max(...bulletData.map((row) => row.max || row.value || 0), 1);
    return (
      <div className="space-y-4">
        {bulletData.map((row, idx) => {
          const rowMax = row.max || maxValue;
          const valuePct = Math.min((row.value / rowMax) * 100, 100);
          const targetPct = Math.min((row.target / rowMax) * 100, 100);
          return (
            <div key={`bullet-${idx}`}>
              <div className="flex items-center justify-between text-sm text-slate-600 mb-1">
                <span>{row.label}</span>
                <span>{formatValue(row.value)}</span>
              </div>
              <div className="relative h-4 rounded-full bg-slate-100">
                <div
                  className="absolute left-0 top-0 h-4 rounded-full bg-blue-600"
                  style={{ width: `${valuePct}%` }}
                ></div>
                <div
                  className="absolute top-[-4px] h-6 w-1 bg-amber-500"
                  style={{ left: `${targetPct}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const buildWaffleCells = () => {
    const order = [];
    for (let row = 9; row >= 0; row -= 1) {
      for (let col = 0; col < 10; col += 1) {
        order.push(row * 10 + col);
      }
    }
    return order;
  };

  const renderWaffle = () => {
    const order = buildWaffleCells();
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {waffleData.map((item, idx) => {
            const count = Math.max(0, Math.min(100, Math.round(Number(item.value || 0))));
            const fillColor = seriesColors[idx % seriesColors.length];
            return (
              <div key={`waffle-card-${idx}`} className="space-y-3">
                <div className="grid grid-cols-10 gap-1">
                  {order.map((cellIndex, cellIdx) => {
                    const filled = cellIdx < count;
                    return (
                      <div
                        key={`waffle-${idx}-${cellIndex}`}
                        className="w-4 h-4 rounded-[3px]"
                        style={{ backgroundColor: filled ? fillColor : '#ede9fe' }}
                      ></div>
                    );
                  })}
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-slate-900">{`${count}%`}</div>
                  <div className="text-sm text-slate-600">{item.note || item.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderBeforeAfter = () => (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={beforeAfterData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="label" stroke="#6b7280" style={{ fontSize: 12 }} />
        <YAxis stroke="#6b7280" style={{ fontSize: 12 }} tickFormatter={formatValue} />
        <Tooltip
          contentStyle={{ background: '#fff', border: '1px solid #e5e7eb' }}
          formatter={(value) => formatValue(value)}
        />
        <Legend />
        <Bar dataKey="before" fill={colors.forecast} name="Before" radius={[4, 4, 0, 0]} />
        <Bar dataKey="after" fill={colors.primary} name="After" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );

  const renderGrowthCurve = () => {
    const width = 640;
    const height = 280;
    const padding = 50;
    const values = data.map((item) => item.value);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const span = Math.max(max - min, 1);
    const points = data.map((item, idx) => {
      const x = padding + (idx * (width - padding * 2)) / Math.max(data.length - 1, 1);
      const y = height - padding - ((item.value - min) / span) * (height - padding * 2);
      return { x, y, label: item.label, value: item.value };
    });
    if (!points.length) {
      return <div className="text-sm text-slate-500">Add data points to render the curve.</div>;
    }
    const path = points.map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt.x} ${pt.y}`).join(' ');
    const lastPoint = points[points.length - 1];
    const calloutWidth = 210;
    const calloutHeight = 44;
    const calloutX = Math.min(lastPoint.x + 10, width - calloutWidth - 10);
    const calloutY = Math.max(lastPoint.y - calloutHeight - 20, 10);

    return (
      <div className="space-y-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-72">
          <defs>
            <linearGradient id="growthLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f9a8d4" />
              <stop offset="100%" stopColor="#f472b6" />
            </linearGradient>
          </defs>
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#d1d5db" />
          <path d={path} fill="none" stroke="url(#growthLine)" strokeWidth="6" strokeLinecap="round" />
          {points.map((pt, idx) => (
            <g key={`point-${idx}`}>
              <circle cx={pt.x} cy={pt.y} r="6" fill="#f472b6" />
              <text x={pt.x} y={pt.y - 14} textAnchor="middle" fontSize="14" fill="#f472b6" fontWeight="600">
                {formatValue(pt.value)}
              </text>
              <text x={pt.x} y={height - padding + 20} textAnchor="middle" fontSize="12" fill="#9ca3af">
                {pt.label}
              </text>
            </g>
          ))}
          {growthCallout && (
            <g>
              <rect x={calloutX} y={calloutY} rx="10" ry="10" width={calloutWidth} height={calloutHeight} fill="#f9a8d4" />
              <text
                x={calloutX + calloutWidth / 2}
                y={calloutY + calloutHeight / 2 + 5}
                textAnchor="middle"
                fontSize="14"
                fill="#ffffff"
                fontWeight="700"
              >
                {growthCallout}
              </text>
            </g>
          )}
        </svg>
        {growthCaption && <div className="text-sm text-slate-600">{growthCaption}</div>}
      </div>
    );
  };

  const renderBarLine = () => {
    const barSeries = multiSeries[0];
    const lineSeries = multiSeries[1] || multiSeries[0];
    return (
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={multiSeriesData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="label" stroke="#6b7280" style={{ fontSize: 12 }} />
          <YAxis stroke="#6b7280" style={{ fontSize: 12 }} tickFormatter={formatValue} />
          <Tooltip
            contentStyle={{ background: '#fff', border: '1px solid #e5e7eb' }}
            formatter={(value) => formatValue(value)}
          />
          <Legend />
          {barSeries && (
            <Bar dataKey={barSeries.key} fill={colors.primary} name={barSeries.label} radius={[4, 4, 0, 0]} />
          )}
          {lineSeries && (
            <Line
              type="monotone"
              dataKey={lineSeries.key}
              stroke={colors.secondary}
              strokeWidth={3}
              name={lineSeries.label}
              dot={{ fill: colors.secondary, r: 5 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  const renderRevenueMix = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">{revenueMixTitle}</span>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={multiSeriesData} margin={{ top: 20, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" stroke="#6b7280" style={{ fontSize: 12 }} />
            <YAxis stroke="#6b7280" style={{ fontSize: 12 }} tickFormatter={formatValue} />
            <Tooltip
              contentStyle={{ background: '#fff', border: '1px solid #e5e7eb' }}
              formatter={(value) => formatValue(value)}
            />
            {multiSeries.slice(0, 2).map((series, idx) => (
              <Line
                key={series.key}
                type="monotone"
                dataKey={series.key}
                stroke={idx === 0 ? colors.primary : '#111827'}
                strokeWidth={3}
                dot={{ fill: idx === 0 ? colors.primary : '#111827', r: 4 }}
                name={series.label}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          {multiSeries.slice(0, 2).map((series, idx) => (
            <span key={`legend-${series.key}`} className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ background: idx === 0 ? colors.primary : '#111827' }}
              ></span>
              {series.label}
            </span>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col md:flex-row gap-4">
          <div className="w-full md:w-48 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="label" innerRadius={50} outerRadius={70}>
                  {pieData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={seriesColors[idx % seriesColors.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-700 mb-2">{revenueMixSubtitle}</div>
            <div className="space-y-2 text-sm">
              {pieData.map((slice, idx) => (
                <div key={`mix-${idx}`} className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ background: seriesColors[idx % seriesColors.length] }}
                  ></span>
                  <span className="font-medium text-slate-700">{slice.label}</span>
                  <span className="text-slate-500">{slice.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <div className="text-sm font-semibold text-slate-700">{pricingTitle}</div>
          <div className="text-base font-semibold text-blue-600 mt-1">{pricingSummary}</div>
          <ul className="mt-2 text-sm text-slate-600 list-disc list-inside space-y-1">
            {pricingDetails.map((item, idx) => (
              <li key={`pricing-${idx}`}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <div className="text-sm font-semibold text-slate-700">{conciergeTitle}</div>
          <ul className="mt-2 text-sm text-slate-600 list-disc list-inside space-y-1">
            {conciergeDetails.map((item, idx) => (
              <li key={`concierge-${idx}`}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );

  const renderMarketSize = () => {
    const width = 520;
    const height = 320;
    const centerX = 190;
    const centerY = 180;
    const maxRadius = 140;
    const gap = 34;
    return (
      <div className="flex flex-col lg:flex-row gap-6 items-center">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-xl h-72">
          {marketSizeRings.map((ring, idx) => {
            const radius = maxRadius - idx * gap;
            const labelY = centerY - radius / 2;
            return (
              <g key={`ring-${idx}`}>
                <circle cx={centerX} cy={centerY} r={radius} fill={ring.color} opacity={0.9} />
                <text x={centerX} y={labelY} textAnchor="middle" fontSize="16" fill="#1f2937" fontWeight="600">
                  {ring.label}
                </text>
                <text x={centerX} y={labelY + 20} textAnchor="middle" fontSize="13" fill="#1f2937">
                  {ring.amount}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="space-y-3 text-sm text-slate-600">
          {marketSizeRings.map((ring, idx) => (
            <div key={`ring-note-${idx}`} className="flex items-center gap-3">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: ring.color }}></span>
              <span className="font-semibold text-slate-700">{ring.label}</span>
              <span>{ring.amount}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTRL = () => {
    const max = Math.max(1, trlData.max);
    const currentPct = (trlData.current / max) * 100;
    const targetPct = (trlData.target / max) * 100;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span>Current TRL {trlData.current}</span>
          <span>Target TRL {trlData.target}</span>
        </div>
        <div className="relative h-4 bg-gray-200 rounded-full">
          <div
            className="absolute h-4 bg-blue-600 rounded-full"
            style={{ width: `${currentPct}%` }}
          ></div>
          <div
            className="absolute h-4 bg-blue-200 rounded-full"
            style={{ width: `${targetPct}%` }}
          ></div>
          {trlData.milestones.map((milestone) => (
            <div
              key={`milestone-${milestone}`}
              className="absolute -top-1 w-3 h-3 rounded-full bg-gray-500"
              style={{ left: `${(milestone / max) * 100}%` }}
            ></div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>TRL 1</span>
          <span>TRL {max}</span>
        </div>
      </div>
    );
  };

  const renderChart = () => {
    switch (chartType) {
      case 'line':
        return renderLineChart();
      case 'bar':
        return renderBarChart();
      case 'grouped':
        return renderGroupedChart();
      case 'stacked':
        return renderStackedChart();
      case 'combo':
        return renderComboChart();
      case 'bar-line':
        return renderBarLine();
      case 'waterfall':
        return renderWaterfall();
      case 'before-after':
        return renderBeforeAfter();
      case 'comparison-table':
        return renderComparisonTable();
      case 'kpi-table':
        return renderKPITable();
      case 'gantt':
        return renderGantt();
      case 'timeline':
        return renderTimeline();
      case 'funnel':
        return renderFunnel();
      case 'trl':
        return renderTRL();
      case 'pie':
        return renderPieChart(0);
      case 'donut':
        return renderPieChart(60);
      case 'treemap':
        return renderTreemap();
      case 'bullet':
        return renderBullet();
      case 'waffle':
        return renderWaffle();
      case 'quadrant':
        return renderQuadrant();
      case 'kpi-cards':
        return renderKPICards();
      case 'growth-curve':
        return renderGrowthCurve();
      case 'revenue-mix':
        return renderRevenueMix();
      case 'market-size':
        return renderMarketSize();
      default:
        return renderLineChart();
    }
  };

  const showDataEditor = ['bar', 'combo', 'waterfall', 'growth-curve'].includes(chartType);
  const showMultiSeriesEditor = ['line', 'grouped', 'stacked', 'bar-line', 'revenue-mix'].includes(chartType);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 rounded-full text-gray-600 hover:bg-gray-100"
                type="button"
              >
                <ChevronLeft size={18} />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">IR-Grade Chart Builder</h1>
            </div>
            <button
              onClick={exportChart}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              disabled={isExporting}
              type="button"
            >
              <Download size={18} />
              {isExporting ? 'Exporting...' : 'Export PNG'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-slate-600 mb-2">PSST section</div>
              <select
                value={psstSection}
                onChange={(event) => {
                  const next = event.target.value;
                  setPsstSection(next);
                  const section = psstSections.find((item) => item.id === next);
                  if (section?.required?.length) {
                    setChartType(section.required[0]);
                  }
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                {psstSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.label}
                  </option>
                ))}
              </select>
              <div className="mt-3 flex flex-wrap gap-2">
                {chartTypes
                  .filter((type) => recommendedChartIds.has(type.id))
                  .map((type) => (
                    <button
                      key={`rec-${type.id}`}
                      type="button"
                      onClick={() => setChartType(type.id)}
                      className="px-3 py-1 rounded-full text-xs border border-emerald-200 bg-emerald-50 text-emerald-700"
                    >
                      {type.name}
                    </button>
                  ))}
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-slate-600 mb-2">Units</div>
              <input
                type="text"
                value={unitLabel}
                onChange={(event) => setUnitLabel(event.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                placeholder="₩, %, tons CO2, $M"
              />
              <div className="text-[11px] text-slate-500 mt-2">
                Used for axes, tooltips, and tables.
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-slate-600 mb-2">Chart title</div>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-6">
            {chartTypes.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  onClick={() => setChartType(type.id)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition ${
                    chartType === type.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                  type="button"
                >
                  <Icon size={20} className={chartType === type.id ? 'text-blue-600' : 'text-gray-600'} />
                  <span className={`text-xs font-medium ${chartType === type.id ? 'text-blue-600' : 'text-gray-700'}`}>
                    {type.name}
                  </span>
                </button>
              );
            })}
          </div>

          <div ref={chartRef} className="bg-white p-6 rounded-lg border border-gray-200 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{title}</h2>
            {renderChart()}
          </div>

          {showDataEditor && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Data Points</h3>
                <button
                  onClick={addDataPoint}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                  type="button"
                >
                  <Plus size={16} />
                  Add Point
                </button>
              </div>

              <div className="space-y-2">
                {data.map((point, index) => (
                  <div key={`${point.label}-${index}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="text"
                      value={point.label}
                      onChange={(e) => updateDataPoint(index, 'label', e.target.value)}
                      placeholder="Label"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      value={point.value}
                      onChange={(e) => updateDataPoint(index, 'value', e.target.value)}
                      placeholder="Value"
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={point.forecast}
                        onChange={(e) => updateDataPoint(index, 'forecast', e.target.checked)}
                        className="rounded"
                      />
                      Forecast
                    </label>
                    <button
                      onClick={() => removeDataPoint(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showMultiSeriesEditor && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Series</h3>
                <button
                  onClick={addSeries}
                  className="flex items-center gap-2 px-3 py-2 text-emerald-600 border border-emerald-200 rounded-lg text-sm"
                  type="button"
                >
                  <Plus size={16} />
                  Add series
                </button>
              </div>
              <div className="space-y-2">
                {multiSeries.map((series, idx) => (
                  <div key={series.key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="text"
                      value={series.label}
                      onChange={(e) => updateMultiSeriesLabel(idx, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    {multiSeries.length > 1 && (
                      <button
                        onClick={() => removeSeries(idx)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        type="button"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <h4 className="text-md font-semibold text-gray-900">Rows</h4>
                <button
                  onClick={addMultiSeriesRow}
                  className="flex items-center gap-2 px-3 py-2 text-emerald-600 border border-emerald-200 rounded-lg text-sm"
                  type="button"
                >
                  <Plus size={16} />
                  Add row
                </button>
              </div>
              <div className="space-y-2">
                {multiSeriesData.map((row, rowIdx) => (
                  <div key={`row-${rowIdx}`} className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) => updateMultiSeriesLabelValue(rowIdx, e.target.value)}
                      className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    {multiSeries.map((series) => (
                      <input
                        key={`${rowIdx}-${series.key}`}
                        type="number"
                        value={row[series.key]}
                        onChange={(e) => updateMultiSeriesValue(rowIdx, series.key, e.target.value)}
                        className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    ))}
                    <button
                      onClick={() => removeMultiSeriesRow(rowIdx)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {chartType === 'growth-curve' && (
            <div className="mt-8 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Growth callout</h3>
              <input
                type="text"
                value={growthCallout}
                onChange={(e) => setGrowthCallout(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Callout text"
              />
              <textarea
                value={growthCaption}
                onChange={(e) => setGrowthCaption(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                rows={3}
                placeholder="Caption"
              />
            </div>
          )}

          {chartType === 'revenue-mix' && (
            <div className="mt-8 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Revenue mix layout</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={revenueMixTitle}
                  onChange={(e) => setRevenueMixTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Left chart title"
                />
                <input
                  type="text"
                  value={revenueMixSubtitle}
                  onChange={(e) => setRevenueMixSubtitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Donut title"
                />
              </div>
              <input
                type="text"
                value={pricingTitle}
                onChange={(e) => setPricingTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Pricing title"
              />
              <input
                type="text"
                value={pricingSummary}
                onChange={(e) => setPricingSummary(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Pricing summary"
              />
              <textarea
                value={pricingDetails.join('\n')}
                onChange={(e) => setPricingDetails(e.target.value.split('\n').filter(Boolean))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                rows={4}
                placeholder="Pricing details (one per line)"
              />
              <input
                type="text"
                value={conciergeTitle}
                onChange={(e) => setConciergeTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Concierge title"
              />
              <textarea
                value={conciergeDetails.join('\n')}
                onChange={(e) => setConciergeDetails(e.target.value.split('\n').filter(Boolean))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                rows={3}
                placeholder="Concierge details (one per line)"
              />
            </div>
          )}

          {['comparison-table', 'kpi-table'].includes(chartType) && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Table editor</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setComparisonTable((prev) => ({
                        ...prev,
                        columns: [...prev.columns, `Column ${prev.columns.length + 1}`],
                        rows: prev.rows.map((row) => [...row, '']),
                      }))
                    }
                    className="flex items-center gap-2 px-3 py-2 text-emerald-600 border border-emerald-200 rounded-lg text-sm"
                    type="button"
                  >
                    <Plus size={16} />
                    Column
                  </button>
                  <button
                    onClick={() =>
                      setComparisonTable((prev) => ({
                        ...prev,
                        rows: [...prev.rows, prev.columns.map(() => '')],
                      }))
                    }
                    className="flex items-center gap-2 px-3 py-2 text-emerald-600 border border-emerald-200 rounded-lg text-sm"
                    type="button"
                  >
                    <Plus size={16} />
                    Row
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {comparisonTable.columns.map((column, idx) => (
                  <input
                    key={`col-${idx}`}
                    type="text"
                    value={column}
                    onChange={(e) =>
                      setComparisonTable((prev) => {
                        const columns = [...prev.columns];
                        columns[idx] = e.target.value;
                        return { ...prev, columns };
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                ))}
                {comparisonTable.rows.map((row, rowIdx) => (
                  <div key={`row-edit-${rowIdx}`} className="flex flex-wrap gap-3 items-center">
                    {row.map((cell, cellIdx) => (
                      <input
                        key={`cell-${rowIdx}-${cellIdx}`}
                        type="text"
                        value={cell}
                        onChange={(e) =>
                          setComparisonTable((prev) => {
                            const rows = prev.rows.map((r) => [...r]);
                            rows[rowIdx][cellIdx] = e.target.value;
                            return { ...prev, rows };
                          })
                        }
                        className="flex-1 min-w-[140px] px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    ))}
                    <button
                      onClick={() =>
                        setComparisonTable((prev) => ({
                          ...prev,
                          rows: prev.rows.filter((_, idx) => idx !== rowIdx),
                        }))
                      }
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {chartType === 'before-after' && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Before / After</h3>
                <button
                  onClick={() =>
                    setBeforeAfterData((prev) => [...prev, { label: `Item ${prev.length + 1}`, before: 0, after: 0 }])
                  }
                  className="flex items-center gap-2 px-3 py-2 text-emerald-600 border border-emerald-200 rounded-lg text-sm"
                  type="button"
                >
                  <Plus size={16} />
                  Add row
                </button>
              </div>
              <div className="space-y-2">
                {beforeAfterData.map((row, idx) => (
                  <div key={`ba-${idx}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) =>
                        setBeforeAfterData((prev) => prev.map((item, i) => (i === idx ? { ...item, label: e.target.value } : item)))
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      value={row.before}
                      onChange={(e) =>
                        setBeforeAfterData((prev) => prev.map((item, i) => (i === idx ? { ...item, before: Number(e.target.value) || 0 } : item)))
                      }
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      value={row.after}
                      onChange={(e) =>
                        setBeforeAfterData((prev) => prev.map((item, i) => (i === idx ? { ...item, after: Number(e.target.value) || 0 } : item)))
                      }
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      onClick={() => setBeforeAfterData((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {chartType === 'gantt' && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Gantt tasks</h3>
                <button
                  onClick={() =>
                    setGanttData((prev) => [...prev, { task: `Task ${prev.length + 1}`, start: 0, duration: 1 }])
                  }
                  className="flex items-center gap-2 px-3 py-2 text-emerald-600 border border-emerald-200 rounded-lg text-sm"
                  type="button"
                >
                  <Plus size={16} />
                  Add task
                </button>
              </div>
              <div className="space-y-2">
                {ganttData.map((row, idx) => (
                  <div key={`gantt-${idx}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="text"
                      value={row.task}
                      onChange={(e) =>
                        setGanttData((prev) => prev.map((item, i) => (i === idx ? { ...item, task: e.target.value } : item)))
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      value={row.start}
                      onChange={(e) =>
                        setGanttData((prev) => prev.map((item, i) => (i === idx ? { ...item, start: Number(e.target.value) || 0 } : item)))
                      }
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      value={row.duration}
                      onChange={(e) =>
                        setGanttData((prev) => prev.map((item, i) => (i === idx ? { ...item, duration: Number(e.target.value) || 0 } : item)))
                      }
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      onClick={() => setGanttData((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {chartType === 'timeline' && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Timeline</h3>
                <button
                  onClick={() =>
                    setTimelineData((prev) => [...prev, { date: `Q${prev.length + 1}`, event: 'Milestone' }])
                  }
                  className="flex items-center gap-2 px-3 py-2 text-emerald-600 border border-emerald-200 rounded-lg text-sm"
                  type="button"
                >
                  <Plus size={16} />
                  Add milestone
                </button>
              </div>
              <div className="space-y-2">
                {timelineData.map((row, idx) => (
                  <div key={`timeline-${idx}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="text"
                      value={row.date}
                      onChange={(e) =>
                        setTimelineData((prev) => prev.map((item, i) => (i === idx ? { ...item, date: e.target.value } : item)))
                      }
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      value={row.event}
                      onChange={(e) =>
                        setTimelineData((prev) => prev.map((item, i) => (i === idx ? { ...item, event: e.target.value } : item)))
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      onClick={() => setTimelineData((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {chartType === 'funnel' && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Funnel stages</h3>
                <button
                  onClick={() => setFunnelData((prev) => [...prev, { stage: `Stage ${prev.length + 1}`, value: 0 }])}
                  className="flex items-center gap-2 px-3 py-2 text-emerald-600 border border-emerald-200 rounded-lg text-sm"
                  type="button"
                >
                  <Plus size={16} />
                  Add stage
                </button>
              </div>
              <div className="space-y-2">
                {funnelData.map((row, idx) => (
                  <div key={`funnel-${idx}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="text"
                      value={row.stage}
                      onChange={(e) =>
                        setFunnelData((prev) => prev.map((item, i) => (i === idx ? { ...item, stage: e.target.value } : item)))
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      value={row.value}
                      onChange={(e) =>
                        setFunnelData((prev) => prev.map((item, i) => (i === idx ? { ...item, value: Number(e.target.value) || 0 } : item)))
                      }
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      onClick={() => setFunnelData((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {chartType === 'bullet' && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Bullet rows</h3>
                <button
                  onClick={() =>
                    setBulletData((prev) => [
                      ...prev,
                      { label: `Metric ${prev.length + 1}`, value: 0, target: 0, max: 100 },
                    ])
                  }
                  className="flex items-center gap-2 px-3 py-2 text-emerald-600 border border-emerald-200 rounded-lg text-sm"
                  type="button"
                >
                  <Plus size={16} />
                  Add row
                </button>
              </div>
              <div className="space-y-2">
                {bulletData.map((row, idx) => (
                  <div key={`bullet-${idx}`} className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) =>
                        setBulletData((prev) => prev.map((item, i) => (i === idx ? { ...item, label: e.target.value } : item)))
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      value={row.value}
                      onChange={(e) =>
                        setBulletData((prev) => prev.map((item, i) => (i === idx ? { ...item, value: Number(e.target.value) || 0 } : item)))
                      }
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      value={row.target}
                      onChange={(e) =>
                        setBulletData((prev) => prev.map((item, i) => (i === idx ? { ...item, target: Number(e.target.value) || 0 } : item)))
                      }
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      value={row.max}
                      onChange={(e) =>
                        setBulletData((prev) => prev.map((item, i) => (i === idx ? { ...item, max: Number(e.target.value) || 0 } : item)))
                      }
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      onClick={() => setBulletData((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {['pie', 'donut', 'revenue-mix', 'treemap'].includes(chartType) && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Slices</h3>
                <button
                  onClick={() => setPieData((prev) => [...prev, { label: `Slice ${prev.length + 1}`, value: 0 }])}
                  className="flex items-center gap-2 px-3 py-2 text-emerald-600 border border-emerald-200 rounded-lg text-sm"
                  type="button"
                >
                  <Plus size={16} />
                  Add slice
                </button>
              </div>
              <div className="space-y-2">
                {pieData.map((row, idx) => (
                  <div key={`pie-${idx}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) =>
                        setPieData((prev) => prev.map((item, i) => (i === idx ? { ...item, label: e.target.value } : item)))
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      value={row.value}
                      onChange={(e) =>
                        setPieData((prev) => prev.map((item, i) => (i === idx ? { ...item, value: Number(e.target.value) || 0 } : item)))
                      }
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      onClick={() => setPieData((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {chartType === 'waffle' && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Waffle cards</h3>
                <button
                  onClick={() =>
                    setWaffleData((prev) => [
                      ...prev,
                      { label: `Metric ${prev.length + 1}`, value: 0, note: '' },
                    ])
                  }
                  className="flex items-center gap-2 px-3 py-2 text-emerald-600 border border-emerald-200 rounded-lg text-sm"
                  type="button"
                >
                  <Plus size={16} />
                  Add card
                </button>
              </div>
              <div className="space-y-2">
                {waffleData.map((row, idx) => (
                  <div key={`waffle-edit-${idx}`} className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) =>
                        setWaffleData((prev) => prev.map((item, i) => (i === idx ? { ...item, label: e.target.value } : item)))
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Label"
                    />
                    <input
                      type="number"
                      value={row.value}
                      onChange={(e) =>
                        setWaffleData((prev) => prev.map((item, i) => (i === idx ? { ...item, value: Number(e.target.value) || 0 } : item)))
                      }
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="%"
                    />
                    <input
                      type="text"
                      value={row.note}
                      onChange={(e) =>
                        setWaffleData((prev) => prev.map((item, i) => (i === idx ? { ...item, note: e.target.value } : item)))
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Caption"
                    />
                    <button
                      onClick={() => setWaffleData((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {chartType === 'market-size' && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Market size rings</h3>
                <button
                  onClick={() =>
                    setMarketSizeRings((prev) => [
                      ...prev,
                      { label: `Tier ${prev.length + 1}`, amount: '0', color: '#fde68a' },
                    ])
                  }
                  className="flex items-center gap-2 px-3 py-2 text-emerald-600 border border-emerald-200 rounded-lg text-sm"
                  type="button"
                >
                  <Plus size={16} />
                  Add ring
                </button>
              </div>
              <div className="space-y-2">
                {marketSizeRings.map((ring, idx) => (
                  <div key={`ring-${idx}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="text"
                      value={ring.label}
                      onChange={(e) =>
                        setMarketSizeRings((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, label: e.target.value } : item))
                        )
                      }
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      value={ring.amount}
                      onChange={(e) =>
                        setMarketSizeRings((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, amount: e.target.value } : item))
                        )
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="color"
                      value={ring.color}
                      onChange={(e) =>
                        setMarketSizeRings((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, color: e.target.value } : item))
                        )
                      }
                      className="w-10 h-10 border border-gray-300 rounded-lg"
                    />
                    <button
                      onClick={() => setMarketSizeRings((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {chartType === 'trl' && (
            <div className="mt-8 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">TRL setup</h3>
              <div className="flex flex-wrap items-center gap-4">
                <label className="text-sm text-gray-600">
                  Current
                  <input
                    type="number"
                    value={trlData.current}
                    onChange={(e) => setTrlData((prev) => ({ ...prev, current: Number(e.target.value) || 0 }))}
                    className="ml-2 w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </label>
                <label className="text-sm text-gray-600">
                  Target
                  <input
                    type="number"
                    value={trlData.target}
                    onChange={(e) => setTrlData((prev) => ({ ...prev, target: Number(e.target.value) || 0 }))}
                    className="ml-2 w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </label>
                <label className="text-sm text-gray-600">
                  Max
                  <input
                    type="number"
                    value={trlData.max}
                    onChange={(e) => setTrlData((prev) => ({ ...prev, max: Number(e.target.value) || 1 }))}
                    className="ml-2 w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </label>
              </div>
              <input
                type="text"
                value={trlData.milestones.join(',')}
                onChange={(e) =>
                  setTrlData((prev) => ({
                    ...prev,
                    milestones: e.target.value
                      .split(',')
                      .map((value) => Number(value.trim()))
                      .filter((value) => !Number.isNaN(value)),
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Milestones (e.g. 2,4,6,8,9)"
              />
            </div>
          )}

          {chartType === 'kpi-cards' && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">KPI cards</h3>
                <button
                  onClick={() => setKpiCards((prev) => [...prev, { label: 'Metric', value: '0', change: '+0%' }])}
                  className="flex items-center gap-2 px-3 py-2 text-emerald-600 border border-emerald-200 rounded-lg text-sm"
                  type="button"
                >
                  <Plus size={16} />
                  Add KPI
                </button>
              </div>
              <div className="space-y-2">
                {kpiCards.map((row, idx) => (
                  <div key={`kpi-${idx}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) =>
                        setKpiCards((prev) => prev.map((item, i) => (i === idx ? { ...item, label: e.target.value } : item)))
                      }
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      value={row.value}
                      onChange={(e) =>
                        setKpiCards((prev) => prev.map((item, i) => (i === idx ? { ...item, value: e.target.value } : item)))
                      }
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      value={row.change}
                      onChange={(e) =>
                        setKpiCards((prev) => prev.map((item, i) => (i === idx ? { ...item, change: e.target.value } : item)))
                      }
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      onClick={() => setKpiCards((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {chartType === 'quadrant' && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Quadrant points</h3>
                <button
                  onClick={() => setQuadrantItems((prev) => [...prev, { name: 'New', x: 50, y: 50 }])}
                  className="flex items-center gap-2 px-3 py-2 text-emerald-600 border border-emerald-200 rounded-lg text-sm"
                  type="button"
                >
                  <Plus size={16} />
                  Add point
                </button>
              </div>
              <div className="space-y-2">
                {quadrantItems.map((row, idx) => (
                  <div key={`quad-${idx}`} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) =>
                        setQuadrantItems((prev) => prev.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item)))
                      }
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      value={row.x}
                      onChange={(e) =>
                        setQuadrantItems((prev) => prev.map((item, i) => (i === idx ? { ...item, x: Number(e.target.value) || 0 } : item)))
                      }
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      value={row.y}
                      onChange={(e) =>
                        setQuadrantItems((prev) => prev.map((item, i) => (i === idx ? { ...item, y: Number(e.target.value) || 0 } : item)))
                      }
                      className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      onClick={() => setQuadrantItems((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Settings size={20} />
            Color Settings
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(colors).map(([key, value]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">{key}</label>
                <input
                  type="color"
                  value={value}
                  onChange={(e) => setColors({ ...colors, [key]: e.target.value })}
                  className="w-full h-10 rounded cursor-pointer"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChartBuilder;
