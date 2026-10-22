import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';

export function List({ height, rowCount, rowHeight, rowRenderer, width }) {
  const [scrollTop, setScrollTop] = useState(0);
  const overscan = 5;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(rowCount, Math.ceil((scrollTop + height) / rowHeight) + overscan);
  const rows = useMemo(() => {
    const rendered = [];
    for (let index = start; index < end; index += 1) {
      rendered.push(rowRenderer({
        index,
        isScrolling: false,
        key: `row-${index}`,
        style: {
          height: rowHeight,
          left: 0,
          position: 'absolute',
          right: 0,
          top: index * rowHeight,
        },
      }));
    }
    return rendered;
  }, [end, rowHeight, rowRenderer, start]);

  return (
    <div
      onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
      style={{ height, overflow: 'auto', position: 'relative', width }}
    >
      <div style={{ height: rowCount * rowHeight, position: 'relative' }}>
        {rows}
      </div>
    </div>
  );
}

List.propTypes = {
  height: PropTypes.number.isRequired,
  rowCount: PropTypes.number.isRequired,
  rowHeight: PropTypes.number.isRequired,
  rowRenderer: PropTypes.func.isRequired,
  width: PropTypes.number.isRequired,
};

export function AutoSizer({ children }) {
  const containerRef = useRef(null);
  const [size, setSize] = useState({ height: 0, width: 0 });

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setSize({
          height: containerRef.current.clientHeight,
          width: containerRef.current.clientWidth,
        });
      }
    };
    updateSize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateSize);
    if (observer) {
      observer.observe(containerRef.current);
    } else {
      window.addEventListener('resize', updateSize);
    }
    return () => {
      if (observer) {
        observer.disconnect();
      } else {
        window.removeEventListener('resize', updateSize);
      }
    };
  }, []);

  return (
    <div ref={containerRef} style={{ height: '100%', width: '100%' }}>
      {size.height > 0 && size.width > 0 ? children(size) : null}
    </div>
  );
}

AutoSizer.propTypes = {
  children: PropTypes.func.isRequired,
};
