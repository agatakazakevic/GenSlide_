import React, { useState, useRef, useCallback, useEffect } from 'react';

/**
 * SlideEditor - Wraps slide content and adds interactive editing
 *
 * Features:
 * - Click to select elements
 * - Drag to move selected elements
 * - Resize handles on corners
 * - Click on text to edit
 */
const SlideEditor = ({ children, onElementUpdate, enabled = true }) => {
  const containerRef = useRef(null);
  const [selectedElement, setSelectedElement] = useState(null);
  const [selectionBox, setSelectionBox] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef(null);

  // Get selectable elements
  const getSelectableElement = useCallback((target) => {
    if (!target || target === containerRef.current) return null;

    // Elements that can be selected and moved
    const selectableSelectors = [
      '.ir-chart',
      '.ir-metrics',
      '.ir-metric',
      '.ir-cards',
      '.ir-card',
      '.ir-highlight',
      '.ir-table',
      '.ir-yoy',
      '.ir-two-col > div',
      'img',
      'svg',
      '.chart-preview',
    ].join(', ');

    const selectable = target.closest(selectableSelectors);
    if (selectable && containerRef.current?.contains(selectable)) {
      return selectable;
    }
    return null;
  }, []);

  // Update selection box position
  const updateSelectionBox = useCallback(() => {
    if (!selectedElement || !containerRef.current) {
      setSelectionBox(null);
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const elementRect = selectedElement.getBoundingClientRect();

    setSelectionBox({
      left: elementRect.left - containerRect.left,
      top: elementRect.top - containerRect.top,
      width: elementRect.width,
      height: elementRect.height,
    });
  }, [selectedElement]);

  // Update selection box when element changes or window resizes
  useEffect(() => {
    updateSelectionBox();
    window.addEventListener('resize', updateSelectionBox);
    return () => window.removeEventListener('resize', updateSelectionBox);
  }, [selectedElement, updateSelectionBox]);

  // Handle click
  const handleClick = useCallback((e) => {
    if (!enabled) return;

    const target = e.target;

    // Check if clicking an editable element - let it be editable
    // Check for contentEditable attribute or editable-text class
    if (target.isContentEditable || target.classList?.contains('editable-text')) {
      setSelectedElement(null);
      setSelectionBox(null);
      return; // Let the EditableText handle it
    }

    // Also check for common text elements that might be editable
    const textElements = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'LI', 'TD', 'TH', 'LABEL'];
    if (textElements.includes(target.tagName)) {
      // Check if this element or a parent is contentEditable
      if (target.closest('[contenteditable="true"]') || target.closest('.editable-text')) {
        setSelectedElement(null);
        setSelectionBox(null);
        return; // Let the EditableText handle it
      }
    }

    // Check if clicking a resize handle
    if (target.dataset.resize) {
      return;
    }

    const selectable = getSelectableElement(target);

    if (selectable) {
      e.stopPropagation();
      setSelectedElement(selectable);
    } else {
      setSelectedElement(null);
      setSelectionBox(null);
    }
  }, [enabled, getSelectableElement]);

  // Handle pointer down for dragging
  const handlePointerDown = useCallback((e) => {
    if (!enabled) return;

    const target = e.target;

    // Check for resize handle
    if (target.dataset.resize && selectedElement) {
      e.preventDefault();
      e.stopPropagation();

      const handle = target.dataset.resize;
      const rect = selectedElement.getBoundingClientRect();
      const style = window.getComputedStyle(selectedElement);

      // Initialize position if not set
      if (style.position !== 'absolute' && style.position !== 'relative') {
        selectedElement.style.position = 'relative';
      }

      dragState.current = {
        type: 'resize',
        handle,
        element: selectedElement,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: rect.width,
        startHeight: rect.height,
        startLeft: parseFloat(selectedElement.style.left) || 0,
        startTop: parseFloat(selectedElement.style.top) || 0,
      };

      setIsDragging(true);
      containerRef.current?.setPointerCapture(e.pointerId);
      return;
    }

    // Check for dragging selected element
    const selectable = getSelectableElement(target);
    if (selectable && selectable === selectedElement) {
      e.preventDefault();

      const rect = selectable.getBoundingClientRect();
      const style = window.getComputedStyle(selectable);

      if (style.position !== 'absolute' && style.position !== 'relative') {
        selectable.style.position = 'relative';
      }

      dragState.current = {
        type: 'drag',
        element: selectable,
        startX: e.clientX,
        startY: e.clientY,
        startLeft: parseFloat(selectable.style.left) || 0,
        startTop: parseFloat(selectable.style.top) || 0,
      };

      setIsDragging(true);
      containerRef.current?.setPointerCapture(e.pointerId);
    }
  }, [enabled, selectedElement, getSelectableElement]);

  // Handle pointer move
  const handlePointerMove = useCallback((e) => {
    if (!dragState.current) return;

    const state = dragState.current;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;

    if (state.type === 'drag') {
      state.element.style.left = `${state.startLeft + dx}px`;
      state.element.style.top = `${state.startTop + dy}px`;
      updateSelectionBox();
    } else if (state.type === 'resize') {
      const handle = state.handle;
      let newWidth = state.startWidth;
      let newHeight = state.startHeight;
      let newLeft = state.startLeft;
      let newTop = state.startTop;

      if (handle.includes('e')) newWidth = Math.max(50, state.startWidth + dx);
      if (handle.includes('w')) {
        newWidth = Math.max(50, state.startWidth - dx);
        newLeft = state.startLeft + dx;
      }
      if (handle.includes('s')) newHeight = Math.max(30, state.startHeight + dy);
      if (handle.includes('n')) {
        newHeight = Math.max(30, state.startHeight - dy);
        newTop = state.startTop + dy;
      }

      state.element.style.width = `${newWidth}px`;
      state.element.style.height = `${newHeight}px`;
      if (handle.includes('w') || handle.includes('n')) {
        state.element.style.left = `${newLeft}px`;
        state.element.style.top = `${newTop}px`;
      }
      updateSelectionBox();
    }
  }, [updateSelectionBox]);

  // Handle pointer up
  const handlePointerUp = useCallback((e) => {
    if (dragState.current) {
      containerRef.current?.releasePointerCapture(e.pointerId);

      // Notify parent of changes
      if (onElementUpdate && dragState.current.element) {
        const el = dragState.current.element;
        onElementUpdate({
          left: parseFloat(el.style.left) || 0,
          top: parseFloat(el.style.top) || 0,
          width: parseFloat(el.style.width) || el.offsetWidth,
          height: parseFloat(el.style.height) || el.offsetHeight,
        });
      }

      dragState.current = null;
      setIsDragging(false);
    }
  }, [onElementUpdate]);

  // Handle keyboard
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedElement) {
        setSelectedElement(null);
        setSelectionBox(null);
      }
      if (e.key === 'Delete' && selectedElement) {
        // Don't delete if editing text
        if (document.activeElement?.isContentEditable) return;
        selectedElement.style.display = 'none';
        setSelectedElement(null);
        setSelectionBox(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElement]);

  // Render resize handles
  const renderResizeHandles = () => {
    if (!selectionBox || !selectedElement) return null;

    const handles = [
      { id: 'nw', cursor: 'nwse-resize', left: -5, top: -5 },
      { id: 'n', cursor: 'ns-resize', left: selectionBox.width / 2 - 5, top: -5 },
      { id: 'ne', cursor: 'nesw-resize', left: selectionBox.width - 5, top: -5 },
      { id: 'e', cursor: 'ew-resize', left: selectionBox.width - 5, top: selectionBox.height / 2 - 5 },
      { id: 'se', cursor: 'nwse-resize', left: selectionBox.width - 5, top: selectionBox.height - 5 },
      { id: 's', cursor: 'ns-resize', left: selectionBox.width / 2 - 5, top: selectionBox.height - 5 },
      { id: 'sw', cursor: 'nesw-resize', left: -5, top: selectionBox.height - 5 },
      { id: 'w', cursor: 'ew-resize', left: -5, top: selectionBox.height / 2 - 5 },
    ];

    return (
      <div
        className="selection-overlay"
        style={{
          position: 'absolute',
          left: selectionBox.left,
          top: selectionBox.top,
          width: selectionBox.width,
          height: selectionBox.height,
          border: '2px solid #3b82f6',
          pointerEvents: 'none',
          zIndex: 100,
        }}
      >
        {handles.map(handle => (
          <div
            key={handle.id}
            data-resize={handle.id}
            style={{
              position: 'absolute',
              left: handle.left,
              top: handle.top,
              width: 10,
              height: 10,
              background: '#3b82f6',
              border: '2px solid white',
              borderRadius: 2,
              cursor: handle.cursor,
              pointerEvents: 'auto',
              zIndex: 101,
            }}
            onPointerDown={handlePointerDown}
          />
        ))}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`slide-editor ${isDragging ? 'is-dragging' : ''} ${selectedElement ? 'has-selection' : ''}`}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      <style>{`
        .slide-editor {
          cursor: default;
        }
        .slide-editor.is-dragging {
          cursor: grabbing !important;
          user-select: none;
        }
        .slide-editor.has-selection .ir-chart:hover,
        .slide-editor.has-selection .ir-metrics:hover,
        .slide-editor.has-selection .ir-cards:hover,
        .slide-editor.has-selection .ir-highlight:hover,
        .slide-editor.has-selection .ir-table:hover,
        .slide-editor.has-selection img:hover,
        .slide-editor.has-selection svg:hover {
          outline: 2px dashed rgba(59, 130, 246, 0.5);
          outline-offset: 2px;
          cursor: pointer;
        }
      `}</style>

      {children}
      {renderResizeHandles()}
    </div>
  );
};

export default SlideEditor;
