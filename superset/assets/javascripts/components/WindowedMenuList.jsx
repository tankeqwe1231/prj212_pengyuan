import React, {
  Children,
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import PropTypes from 'prop-types';
import { FixedSizeList } from 'react-window';

export const WINDOWED_OPTION_HEIGHT = 36;

const OuterElementContext = createContext({});

const OuterElement = forwardRef(function WindowedMenuOuterElement(props, ref) {
  const outerProps = useContext(OuterElementContext);
  return <div ref={ref} {...props} {...outerProps} />;
});

function renderRow({ data, index, style }) {
  return <div style={style}>{data[index]}</div>;
}

renderRow.propTypes = {
  data: PropTypes.arrayOf(PropTypes.node).isRequired,
  index: PropTypes.number.isRequired,
  style: PropTypes.object.isRequired,
};

function itemKey(index, items) {
  return items[index] && items[index].key != null ? items[index].key : index;
}

export default function WindowedMenuList({
  children,
  focusedOption,
  innerProps,
  innerRef,
  maxHeight,
}) {
  const items = useMemo(() => Children.toArray(children), [children]);
  const outerProps = useMemo(() => innerProps || {}, [innerProps]);
  const listRef = useRef(null);
  const focusedIndex = items.findIndex(item => item.props && item.props.data === focusedOption);
  const height = Math.min(maxHeight, items.length * WINDOWED_OPTION_HEIGHT);

  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      listRef.current.scrollToItem(focusedIndex, 'smart');
    }
  }, [focusedIndex]);

  return (
    <OuterElementContext.Provider value={outerProps}>
      <FixedSizeList
        ref={listRef}
        outerRef={innerRef}
        outerElementType={OuterElement}
        height={height}
        itemCount={items.length}
        itemData={items}
        itemKey={itemKey}
        itemSize={WINDOWED_OPTION_HEIGHT}
        overscanCount={4}
        width="100%"
      >
        {renderRow}
      </FixedSizeList>
    </OuterElementContext.Provider>
  );
}

WindowedMenuList.propTypes = {
  children: PropTypes.node,
  focusedOption: PropTypes.object,
  innerProps: PropTypes.object,
  innerRef: PropTypes.oneOfType([PropTypes.func, PropTypes.object]),
  maxHeight: PropTypes.number.isRequired,
};
