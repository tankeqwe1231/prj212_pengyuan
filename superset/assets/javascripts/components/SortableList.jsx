import React, { useRef } from 'react';
import PropTypes from 'prop-types';

function SortableList({ children, items, keyAccessor, onMove }) {
  const draggedIndex = useRef(null);
  return (
    <div className="list-group">
      {items.map((item, index) => (
        <div
          className="list-group-item clearfix"
          draggable
          key={keyAccessor(item)}
          onDragEnd={() => { draggedIndex.current = null; }}
          onDragOver={event => event.preventDefault()}
          onDragStart={() => { draggedIndex.current = index; }}
          onDrop={(event) => {
            event.preventDefault();
            if (draggedIndex.current != null && draggedIndex.current !== index) {
              onMove(draggedIndex.current, index);
            }
            draggedIndex.current = null;
          }}
        >
          {children(item, index)}
        </div>
      ))}
    </div>
  );
}

SortableList.propTypes = {
  children: PropTypes.func.isRequired,
  items: PropTypes.array.isRequired,
  keyAccessor: PropTypes.func.isRequired,
  onMove: PropTypes.func.isRequired,
};

export default SortableList;
