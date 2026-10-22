import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { Group, Panel, Separator } from 'react-resizable-panels';

function SplitPane({
  allowResize = true,
  children,
  className = '',
  defaultSize,
  maxSize,
  minSize,
  onChange,
  onDragFinished,
  onDragStarted,
  pane1Style,
  pane2Style,
  resizerStyle,
  split = 'vertical',
  style,
}) {
  const panes = React.Children.toArray(children);
  const firstPanelElementRef = useRef(null);
  const latestSizeRef = useRef(null);
  const orientation = split === 'vertical' ? 'horizontal' : 'vertical';
  const containerStyle = {
    height: '100%',
    position: 'relative',
    width: '100%',
    ...style,
  };
  const firstPaneStyle = {
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
    ...pane1Style,
  };
  const secondPaneStyle = {
    minHeight: 0,
    minWidth: 0,
    overflow: 'hidden',
    ...pane2Style,
  };
  const handleResize = (...resizeArguments) => {
    const panelSize = resizeArguments[0];
    const previousPanelSize = resizeArguments[2];
    latestSizeRef.current = panelSize.inPixels;
    if (onChange && previousPanelSize
      && panelSize.inPixels !== previousPanelSize.inPixels) {
      onChange(panelSize.inPixels);
    }
  };
  const handleLayoutChanged = (...layoutArguments) => {
    const meta = layoutArguments[1];
    const firstPanelElement = firstPanelElementRef.current;
    const renderedSize = firstPanelElement
      ? firstPanelElement[orientation === 'horizontal' ? 'offsetWidth' : 'offsetHeight']
      : latestSizeRef.current;
    if (onDragFinished && meta.isUserInteraction && renderedSize != null) {
      onDragFinished(renderedSize);
    }
  };
  const handleDragStarted = () => {
    if (allowResize && onDragStarted) onDragStarted();
  };

  return (
    <Group
      className={`SplitPane ${split} ${className}`.trim()}
      disabled={!allowResize}
      onLayoutChanged={handleLayoutChanged}
      orientation={orientation}
      style={containerStyle}
    >
      <Panel
        className="Pane Pane1"
        defaultSize={defaultSize}
        elementRef={firstPanelElementRef}
        groupResizeBehavior="preserve-pixel-size"
        maxSize={maxSize}
        minSize={minSize}
        onResize={handleResize}
        style={firstPaneStyle}
      >
        {panes[0]}
      </Panel>
      <Separator
        className={`Resizer ${split}${allowResize ? '' : ' disabled'}`}
        disabled={!allowResize}
        onMouseDown={handleDragStarted}
        onTouchStart={handleDragStarted}
        style={resizerStyle}
      />
      <Panel className="Pane Pane2" style={secondPaneStyle}>
        {panes[1]}
      </Panel>
    </Group>
  );
}

SplitPane.propTypes = {
  allowResize: PropTypes.bool,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  defaultSize: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  maxSize: PropTypes.number,
  minSize: PropTypes.number,
  onChange: PropTypes.func,
  onDragFinished: PropTypes.func,
  onDragStarted: PropTypes.func,
  pane1Style: PropTypes.object,
  pane2Style: PropTypes.object,
  resizerStyle: PropTypes.object,
  split: PropTypes.oneOf(['horizontal', 'vertical']),
  style: PropTypes.object,
};

export default SplitPane;
