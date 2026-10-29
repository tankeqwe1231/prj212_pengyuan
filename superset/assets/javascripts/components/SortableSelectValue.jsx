import React from 'react';
import { components as selectComponents } from 'react-select';

function SortableSelectValue(props) {
  const { index, innerProps, selectProps } = props;
  const { draggedValueRef, sortableValue, onSortValue } = selectProps;
  const getDraggedIndex = () => {
    const drag = draggedValueRef.current;
    return drag && drag.value === sortableValue ? drag.index : null;
  };

  return (
    <selectComponents.MultiValue
      {...props}
      innerProps={{
        ...innerProps,
        draggable: true,
        title: '拖动调整顺序',
        // react-select prevents the default mousedown action on its control,
        // which also prevents native dragging from starting on a selected value.
        onMouseDown: event => event.stopPropagation(),
        onDragStart: event => {
          event.stopPropagation();
          draggedValueRef.current = { index, value: sortableValue };
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', selectProps.getOptionValue(props.data));
          }
        },
        onDragOver: event => {
          if (getDraggedIndex() !== null) {
            event.preventDefault();
            event.stopPropagation();
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
          }
        },
        onDrop: event => {
          const from = getDraggedIndex();
          if (from === null) return;
          event.preventDefault();
          event.stopPropagation();
          draggedValueRef.current = null;
          if (from !== index) onSortValue(from, index);
        },
        onDragEnd: event => {
          event.stopPropagation();
          draggedValueRef.current = null;
        },
      }}
    />
  );
}

export default SortableSelectValue;
