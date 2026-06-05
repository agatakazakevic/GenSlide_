import React, { useCallback, useRef } from 'react';
import ChartPreview from './ChartPreview.jsx';

const ensureArray = (value) => (Array.isArray(value) ? value : []);

/**
 * EditableText - Makes text content editable inline
 */
const EditableText = ({ value, onChange, className = '', tag: Tag = 'div', placeholder = 'Click to edit...' }) => {
  const ref = useRef(null);

  const handleBlur = useCallback(() => {
    if (ref.current && onChange) {
      const newValue = ref.current.textContent || '';
      if (newValue !== value) {
        onChange(newValue);
      }
    }
  }, [onChange, value]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ref.current?.blur();
    }
    if (e.key === 'Escape') {
      ref.current.textContent = value || '';
      ref.current?.blur();
    }
  }, [value]);

  return (
    <Tag
      ref={ref}
      className={`editable-text ${className}`}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      data-placeholder={placeholder}
    >
      {value || ''}
    </Tag>
  );
};

const IrSlide = ({
  slide,
  index,
  chartData,
  brandColor,
  logoData,
  companyShort,
  companyLegal,
  year,
  pageNo,
  className = '',
  onSlideUpdate, // New prop for handling updates
  editable = true, // Enable/disable editing
}) => {
  const template = slide?.template || slide?.layout || slide?.type || 'overview';
  const resolvedTable =
    slide?.table ||
    slide?.content?.table ||
    (slide?.content?.type === 'table' ? slide?.content : null);
  const resolvedChartData =
    chartData ||
    slide?.chartData ||
    slide?.content?.chartData ||
    slide?.leftColumn?.chartData ||
    slide?.rightColumn?.chartData ||
    slide?.content?.leftColumn?.chartData ||
    slide?.content?.rightColumn?.chartData ||
    null;

  // Update handler for slide properties
  const updateSlide = useCallback((path, value) => {
    if (!onSlideUpdate || !editable) return;
    onSlideUpdate(index, path, value);
  }, [onSlideUpdate, index, editable]);

  const renderLogo = () => (
    <div className="ir-logo">
      {logoData ? <img src={logoData} alt="Logo" /> : <div className="ir-logo__text">{companyShort}</div>}
    </div>
  );

  const renderFooter = () => (
    <div className="ir-footer">
      <div>© {companyLegal} {year}</div>
      <div>{pageNo ?? index + 1}</div>
    </div>
  );

  const renderTable = (table, tablePath = 'table') => {
    const columns = ensureArray(table?.columns || table?.headers);
    const rows = ensureArray(table?.rows);
    if (!columns.length || !rows.length) {
      return <div className="ir-chart__placeholder">Add table data</div>;
    }
    return (
      <table className="ir-table">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th key={`${col}-${idx}`} className={idx ? 'ir-number' : undefined}>
                {editable && onSlideUpdate ? (
                  <EditableText
                    value={col}
                    onChange={(val) => {
                      const newCols = [...columns];
                      newCols[idx] = val;
                      updateSlide(`${tablePath}.columns`, newCols);
                    }}
                    tag="span"
                  />
                ) : col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => {
            const cells = Array.isArray(row) ? row : columns.map((key) => row?.[key]);
            return (
              <tr key={`row-${rowIdx}`}>
                {cells.map((cell, cellIdx) => {
                  const value = cell?.value ?? cell;
                  const deltaClass = cell?.deltaClass || cell?.className || '';
                  const classes = [cellIdx ? 'ir-number' : '', deltaClass].filter(Boolean).join(' ');
                  return (
                    <td key={`cell-${rowIdx}-${cellIdx}`} className={classes}>
                      {editable && onSlideUpdate ? (
                        <EditableText
                          value={String(value)}
                          onChange={(val) => {
                            const newRows = [...rows];
                            if (Array.isArray(newRows[rowIdx])) {
                              newRows[rowIdx] = [...newRows[rowIdx]];
                              newRows[rowIdx][cellIdx] = val;
                            } else {
                              newRows[rowIdx] = { ...newRows[rowIdx], [columns[cellIdx]]: val };
                            }
                            updateSlide(`${tablePath}.rows`, newRows);
                          }}
                          tag="span"
                        />
                      ) : value}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const renderMetrics = (metrics) => {
    const items = ensureArray(metrics);
    if (!items.length) return null;
    return (
      <div className="ir-metrics">
        {items.map((item, idx) => (
          <div key={`metric-${idx}`} className="ir-metric">
            <div className="ir-metric__label">
              {editable && onSlideUpdate ? (
                <EditableText
                  value={item.label}
                  onChange={(val) => {
                    const newMetrics = [...items];
                    newMetrics[idx] = { ...newMetrics[idx], label: val };
                    updateSlide('metrics', newMetrics);
                  }}
                  tag="span"
                />
              ) : item.label}
            </div>
            <div className="ir-metric__value">
              {editable && onSlideUpdate ? (
                <EditableText
                  value={item.value}
                  onChange={(val) => {
                    const newMetrics = [...items];
                    newMetrics[idx] = { ...newMetrics[idx], value: val };
                    updateSlide('metrics', newMetrics);
                  }}
                  tag="span"
                />
              ) : item.value}
            </div>
            <div className={`ir-metric__change ${item.trend === 'down' ? 'ir-negative' : 'ir-positive'}`}>
              {editable && onSlideUpdate ? (
                <EditableText
                  value={item.change}
                  onChange={(val) => {
                    const newMetrics = [...items];
                    newMetrics[idx] = { ...newMetrics[idx], change: val };
                    updateSlide('metrics', newMetrics);
                  }}
                  tag="span"
                />
              ) : item.change}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderHighlights = (items, path = 'highlights') => {
    const list = ensureArray(items);
    if (!list.length) return null;
    return (
      <div className="ir-highlight">
        <h3>Key Highlights</h3>
        <ul>
          {list.map((item, idx) => (
            <li key={`highlight-${idx}`}>
              {editable && onSlideUpdate ? (
                <EditableText
                  value={item}
                  onChange={(val) => {
                    const newList = [...list];
                    newList[idx] = val;
                    updateSlide(path, newList);
                  }}
                  tag="span"
                />
              ) : item}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const renderBullets = (items, path = 'content') => {
    const list = ensureArray(items);
    if (!list.length) return null;
    return (
      <ul className="ir-bullets">
        {list.map((item, idx) => (
          <li key={`bullet-${idx}`}>
            {editable && onSlideUpdate ? (
              <EditableText
                value={item}
                onChange={(val) => {
                  const newList = [...list];
                  newList[idx] = val;
                  updateSlide(path, newList);
                }}
                tag="span"
              />
            ) : item}
          </li>
        ))}
      </ul>
    );
  };

  const renderInlineChart = () => {
    if (!resolvedChartData || slide?.chartImage) return null;
    return (
      <div className="ir-chart ir-chart--inline">
        <ChartPreview chartData={resolvedChartData} height={220} showTitle />
      </div>
    );
  };

  const renderStrategyCards = (cards) => {
    const items = ensureArray(cards);
    if (!items.length) return null;
    return (
      <div className="ir-cards">
        {items.map((item, idx) => (
          <div key={`card-${idx}`} className="ir-card">
            <h3>
              {editable && onSlideUpdate ? (
                <EditableText
                  value={item.title}
                  onChange={(val) => {
                    const newCards = [...items];
                    newCards[idx] = { ...newCards[idx], title: val };
                    updateSlide('cards', newCards);
                  }}
                  tag="span"
                />
              ) : item.title}
            </h3>
            <p>
              {editable && onSlideUpdate ? (
                <EditableText
                  value={item.body}
                  onChange={(val) => {
                    const newCards = [...items];
                    newCards[idx] = { ...newCards[idx], body: val };
                    updateSlide('cards', newCards);
                  }}
                  tag="span"
                />
              ) : item.body}
            </p>
          </div>
        ))}
      </div>
    );
  };

  const renderEditableTitle = () => {
    if (editable && onSlideUpdate) {
      return (
        <EditableText
          value={slide.title}
          onChange={(val) => updateSlide('title', val)}
          className="ir-title"
          tag="div"
          placeholder="Enter title..."
        />
      );
    }
    return <div className="ir-title">{slide.title}</div>;
  };

  const renderEditableSubtitle = () => {
    if (!slide.subtitle && !editable) return null;
    if (editable && onSlideUpdate) {
      return (
        <EditableText
          value={slide.subtitle || ''}
          onChange={(val) => updateSlide('subtitle', val)}
          className="ir-subtitle"
          tag="div"
          placeholder="Enter subtitle..."
        />
      );
    }
    return slide.subtitle ? <div className="ir-subtitle">{slide.subtitle}</div> : null;
  };

  const renderContentBody = () => {
    if (template === 'section-divider') {
      return (
        <>
          <div className="ir-section-number">
            {editable && onSlideUpdate ? (
              <EditableText
                value={slide.sectionNumber || '01'}
                onChange={(val) => updateSlide('sectionNumber', val)}
                tag="span"
              />
            ) : (slide.sectionNumber || '01')}
          </div>
          <div className="ir-section-title">
            {editable && onSlideUpdate ? (
              <EditableText
                value={slide.title}
                onChange={(val) => updateSlide('title', val)}
                tag="span"
              />
            ) : slide.title}
          </div>
          {(slide.subtitle || editable) && (
            <div className="ir-section-description">
              {editable && onSlideUpdate ? (
                <EditableText
                  value={slide.subtitle || ''}
                  onChange={(val) => updateSlide('subtitle', val)}
                  tag="span"
                  placeholder="Add description..."
                />
              ) : slide.subtitle}
            </div>
          )}
          {renderFooter()}
        </>
      );
    }

    if (template === 'overview') {
      return (
        <>
          {renderMetrics(slide.metrics)}
          {renderHighlights(slide.highlights || slide.content, slide.highlights ? 'highlights' : 'content')}
          {renderInlineChart()}
        </>
      );
    }

    if (template === 'results' || template === 'forecast') {
      return (
        <>
          {renderTable(slide.table)}
          {renderHighlights(slide.highlights || slide.notes, slide.highlights ? 'highlights' : 'notes')}
          {renderInlineChart()}
        </>
      );
    }

    if (resolvedTable && (template === 'content' || template === 'data' || template === 'table')) {
      return (
        <>
          {renderTable(resolvedTable)}
          {renderHighlights(slide.highlights || slide.notes, slide.highlights ? 'highlights' : 'notes')}
          {renderInlineChart()}
        </>
      );
    }

    if (template === 'comparison') {
      const comparison = slide.comparison || {};
      return (
        <>
          <div className="ir-yoy">
            <div className="ir-yoy__item">
              <div className="ir-yoy__year">
                {editable && onSlideUpdate ? (
                  <EditableText
                    value={comparison.prevYear || 'FY2025.2Q'}
                    onChange={(val) => updateSlide('comparison.prevYear', val)}
                    tag="span"
                  />
                ) : (comparison.prevYear || 'FY2025.2Q')}
              </div>
              <div className="ir-yoy__amount">
                {editable && onSlideUpdate ? (
                  <EditableText
                    value={comparison.prevValue || '-'}
                    onChange={(val) => updateSlide('comparison.prevValue', val)}
                    tag="span"
                  />
                ) : (comparison.prevValue || '-')}
              </div>
              <div className="ir-subtitle">Previous Year</div>
            </div>
            <div className="ir-yoy__arrow">→</div>
            <div className="ir-yoy__item">
              <div className="ir-yoy__year">
                {editable && onSlideUpdate ? (
                  <EditableText
                    value={comparison.currentYear || 'FY2026.2Q'}
                    onChange={(val) => updateSlide('comparison.currentYear', val)}
                    tag="span"
                  />
                ) : (comparison.currentYear || 'FY2026.2Q')}
              </div>
              <div className="ir-yoy__amount">
                {editable && onSlideUpdate ? (
                  <EditableText
                    value={comparison.currentValue || '-'}
                    onChange={(val) => updateSlide('comparison.currentValue', val)}
                    tag="span"
                  />
                ) : (comparison.currentValue || '-')}
              </div>
              <div className="ir-subtitle">Current Year</div>
            </div>
          </div>
          <div className="ir-yoy__delta">
            <div className="ir-yoy__delta-value ir-positive">
              {editable && onSlideUpdate ? (
                <EditableText
                  value={comparison.deltaValue || ''}
                  onChange={(val) => updateSlide('comparison.deltaValue', val)}
                  tag="span"
                />
              ) : (comparison.deltaValue || '')}
            </div>
            {(comparison.deltaPercent || editable) && (
              <span className="ir-yoy__delta-percent ir-positive">
                {editable && onSlideUpdate ? (
                  <EditableText
                    value={comparison.deltaPercent || ''}
                    onChange={(val) => updateSlide('comparison.deltaPercent', val)}
                    tag="span"
                    placeholder="+0%"
                  />
                ) : comparison.deltaPercent}
              </span>
            )}
          </div>
          {renderStrategyCards(slide.cards)}
          {renderInlineChart()}
        </>
      );
    }

    if (template === 'strategy') {
      return (
        <>
          {renderBullets(slide.content, 'content')}
          {renderInlineChart()}
        </>
      );
    }

    if (template === 'segment') {
      return (
        <>
          <div className="ir-two-col">
            <div>
              <h3 className="ir-title" style={{ fontSize: '16px', color: 'var(--ir-brand)' }}>
                {editable && onSlideUpdate ? (
                  <EditableText
                    value={slide.leftTable?.title || 'Operating Revenues by Segment'}
                    onChange={(val) => updateSlide('leftTable.title', val)}
                    tag="span"
                  />
                ) : (slide.leftTable?.title || 'Operating Revenues by Segment')}
              </h3>
              {renderTable(slide.leftTable, 'leftTable')}
            </div>
            <div>
              <h3 className="ir-title" style={{ fontSize: '16px', color: 'var(--ir-brand)' }}>
                {editable && onSlideUpdate ? (
                  <EditableText
                    value={slide.rightTable?.title || 'Operating Profit by Segment'}
                    onChange={(val) => updateSlide('rightTable.title', val)}
                    tag="span"
                  />
                ) : (slide.rightTable?.title || 'Operating Profit by Segment')}
              </h3>
              {renderTable(slide.rightTable, 'rightTable')}
            </div>
          </div>
          {renderInlineChart()}
        </>
      );
    }

    if (template === 'metrics') {
      return (
        <>
          {renderMetrics(slide.metrics)}
          {renderStrategyCards(slide.cards)}
          {renderInlineChart()}
        </>
      );
    }

    if (template === 'chart') {
      return (
        <>
          {renderBullets(slide.content, 'content')}
          {resolvedChartData ? (
            <div className="ir-chart ir-chart--inline">
              <ChartPreview chartData={resolvedChartData} height={260} showTitle />
            </div>
          ) : (
            <div className="ir-chart__placeholder">Add chart</div>
          )}
        </>
      );
    }

    // Default two-column layout
    return (
      <div className="ir-two-col">
        <div>
          {renderBullets(slide.content, 'content')}
        </div>
        <div className="ir-chart">
          {resolvedTable ? (
            renderTable(resolvedTable)
          ) : resolvedChartData ? (
            <ChartPreview chartData={resolvedChartData} height={260} showTitle />
          ) : (
            <div className="ir-chart__placeholder">Add chart</div>
          )}
        </div>
      </div>
    );
  };

  if (template === 'section-divider') {
    return (
      <div className={`ir-slide ir-section-divider ${className}`} style={{ '--ir-brand': brandColor, '--ir-brand-dark': brandColor }}>
        {renderContentBody()}
      </div>
    );
  }

  return (
    <div className={`ir-slide ${className}`} style={{ '--ir-brand': brandColor }}>
      <style>{`
        .editable-text {
          cursor: text;
          min-width: 20px;
          min-height: 1em;
          border-radius: 2px;
          transition: outline 0.15s ease, background 0.15s ease;
        }
        .editable-text:hover {
          outline: 2px solid rgba(59, 130, 246, 0.3);
          outline-offset: 2px;
        }
        .editable-text:focus {
          outline: 2px solid #22c55e;
          outline-offset: 2px;
          background: rgba(34, 197, 94, 0.05);
        }
        .editable-text:empty::before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
      `}</style>
      <div className="ir-header">{renderLogo()}</div>
      <div className="ir-title-area">
        {renderEditableTitle()}
        {renderEditableSubtitle()}
      </div>
      <div className="ir-content">{renderContentBody()}</div>
      {renderFooter()}
    </div>
  );
};

export default IrSlide;
