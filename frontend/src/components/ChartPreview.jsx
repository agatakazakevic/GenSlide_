import React, { useEffect, useRef } from 'react';

const ChartPreview = ({ chartData, height = 260, showTitle = false }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !chartData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const canvasHeight = canvas.height;

    ctx.clearRect(0, 0, width, canvasHeight);

    const labels = chartData.labels || [];
    const datasets = Array.isArray(chartData.datasets) ? chartData.datasets : [];
    const parseNumber = (value) => {
      if (typeof value === 'number') return value;
      if (value === null || value === undefined) return 0;
      const cleaned = String(value).replace(/,/g, '').replace(/%/g, '');
      const parsed = Number(cleaned);
      return Number.isNaN(parsed) ? 0 : parsed;
    };
    const normalizedDatasets = datasets.map((dataset) => ({
      ...dataset,
      data: (dataset.data || []).map(parseNumber),
    }));
    const data = normalizedDatasets[0]?.data || [];
    const palette = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    const type = String(chartData.type || 'bar').toLowerCase();

    if (type === 'bar') {
      const minValue = Math.min(...data, 0);
      const maxValue = Math.max(...data, 0);
      const range = maxValue - minValue || 1;
      const chartHeight = canvasHeight - 60;
      const baselineY = canvasHeight - 40 - ((0 - minValue) / range) * chartHeight;
      const barWidth = (width - 100) / Math.max(labels.length, 1);
      const barColor = normalizedDatasets[0]?.backgroundColor || palette[0];

      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(50, baselineY);
      ctx.lineTo(width - 50, baselineY);
      ctx.stroke();

      data.forEach((value, i) => {
        const barHeight = (Math.abs(value) / range) * chartHeight;
        const x = 50 + i * barWidth;
        const y = value >= 0 ? baselineY - barHeight : baselineY;
        const fill = value >= 0 ? barColor : '#ef4444';

        ctx.fillStyle = Array.isArray(fill) ? fill[i % fill.length] : fill;
        ctx.fillRect(x, y, barWidth - 10, barHeight);

        ctx.fillStyle = '#111827';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(labels[i] || i, x + barWidth / 2 - 5, canvasHeight - 18);
      });
    } else if (type === 'line') {
      const stepX = (width - 100) / Math.max(labels.length - 1, 1);
      const maxValue = Math.max(
        ...normalizedDatasets.flatMap((set) => set.data || []),
        1
      );

      normalizedDatasets.forEach((dataset, datasetIdx) => {
        const color = dataset.borderColor || dataset.backgroundColor || palette[datasetIdx % palette.length];
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        (dataset.data || []).forEach((value, i) => {
          const x = 50 + i * stepX;
          const y = canvasHeight - 40 - (value / maxValue) * (canvasHeight - 60);

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, 2 * Math.PI);
          ctx.fill();
        });

        ctx.stroke();
      });

      ctx.fillStyle = '#111827';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      labels.forEach((label, i) => {
        const x = 50 + i * stepX;
        ctx.fillText(label || i, x, canvasHeight - 18);
      });
    } else if (type === 'pie' || type === 'donut' || type === 'doughnut') {
      const centerX = width / 2;
      const centerY = canvasHeight / 2;
      const radius = Math.min(width, canvasHeight) / 3;
      const total = data.reduce((sum, val) => sum + val, 0) || 1;

      let currentAngle = -Math.PI / 2;

      data.forEach((value, i) => {
        const sliceAngle = (value / total) * 2 * Math.PI;

        ctx.fillStyle = palette[i % palette.length];
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fill();

        currentAngle += sliceAngle;
      });
    } else {
      const barWidth = (width - 100) / Math.max(labels.length, 1);
      const maxValue = Math.max(
        ...normalizedDatasets.flatMap((set) => set.data || []),
        1
      );
      const groupCount = Math.max(normalizedDatasets.length, 1);
      const innerBarWidth = (barWidth - 10) / groupCount;

      labels.forEach((label, i) => {
        normalizedDatasets.forEach((dataset, datasetIdx) => {
          const value = dataset.data?.[i] ?? 0;
          const barHeight = (value / maxValue) * (canvasHeight - 60);
          const x = 50 + i * barWidth + datasetIdx * innerBarWidth;
          const y = canvasHeight - 40 - barHeight;
          const color = dataset.backgroundColor || palette[datasetIdx % palette.length];

          ctx.fillStyle = Array.isArray(color) ? color[i % color.length] : color;
          ctx.fillRect(x, y, innerBarWidth - 4, barHeight);
        });

        ctx.fillStyle = '#111827';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label || i, 50 + i * barWidth + barWidth / 2 - 5, canvasHeight - 18);
      });
    }
  }, [chartData]);

  return (
    <div className="w-full">
      {showTitle && chartData?.title && (
        <div className="text-xs font-semibold text-gray-700 mb-2">{chartData.title}</div>
      )}
      <canvas
        ref={canvasRef}
        width={400}
        height={height}
        className="border border-gray-200 rounded-lg bg-white"
      />
    </div>
  );
};

export default ChartPreview;
