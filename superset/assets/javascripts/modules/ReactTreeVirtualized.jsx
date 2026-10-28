/* eslint-disable react/prop-types */
import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { List, AutoSizer } from '../components/VirtualList';

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 将树形数据扁平化为一维数组
 * @param {Object} node - 树节点
 * @param {number} depth - 当前深度
 * @param {Array} path - 当前路径
 * @param {Set} expandedKeys - 已展开的节点 key 集合
 * @param {string} searchText - 搜索文本
 * @param {Set} matchedKeys - 匹配搜索的节点 key 集合
 * @param {Set} visibleKeys - 因搜索需要显示的节点 key 集合
 * @returns {Array} 扁平化后的节点数组
 */
function flattenTree(node, depth, path, expandedKeys, searchText, matchedKeys, visibleKeys) {
  if (!node) return [];

  const hasChildren = node.children && node.children.length > 0;
  const nodeKey = node.key || node.name;
  const isExpanded = expandedKeys.has(nodeKey);

  // 搜索模式下，只显示匹配节点及其路径上的节点
  if (searchText && visibleKeys && !visibleKeys.has(nodeKey)) {
    return [];
  }

  const flatNode = {
    node,
    depth,
    path: [...path],
    hasChildren,
    isExpanded,
    isMatched: matchedKeys ? matchedKeys.has(nodeKey) : false,
  };

  const result = [flatNode];

  // 如果节点展开且有子节点，递归处理子节点
  if (hasChildren && (isExpanded || (searchText && visibleKeys))) {
    node.children.forEach((child, index) => {
      const childPath = [...path, index];
      const childResults = flattenTree(
        child,
        depth + 1,
        childPath,
        expandedKeys,
        searchText,
        matchedKeys,
        visibleKeys
      );
      result.push(...childResults);
    });
  }

  return result;
}

/**
 * 递归查找匹配搜索文本的节点
 * @param {Object} node - 树节点
 * @param {string} searchText - 搜索文本
 * @param {Array} keywords - 搜索关键字数组
 * @returns {Object} { matchedKeys, visibleKeys }
 */
function findMatchingNodes(node, searchText, keywords, matchNode) {
  const matchedKeys = new Set();
  const visibleKeys = new Set();

  if (!node || !searchText) {
    return { matchedKeys, visibleKeys };
  }

  function traverse(currentNode, ancestors) {
    if (!currentNode) return false;

    const nodeKey = currentNode.key || currentNode.name;
    const nodeName = currentNode.name || '';

    // 检查是否匹配所有关键字
    const isMatch = matchNode ? matchNode(currentNode, keywords) : keywords.every(keyword =>
      nodeName.toLowerCase().includes(keyword.toLowerCase())
    );

    let hasMatchingDescendant = false;

    // 递归检查子节点
    if (currentNode.children && currentNode.children.length > 0) {
      currentNode.children.forEach(child => {
        if (traverse(child, [...ancestors, nodeKey])) {
          hasMatchingDescendant = true;
        }
      });
    }

    // 如果当前节点匹配或有匹配的后代
    if (isMatch || hasMatchingDescendant) {
      visibleKeys.add(nodeKey);

      if (isMatch) {
        matchedKeys.add(nodeKey);
      }

      // 将所有祖先节点也标记为可见
      ancestors.forEach(ancestorKey => {
        visibleKeys.add(ancestorKey);
      });

      return true;
    }

    return false;
  }

  traverse(node, []);

  return { matchedKeys, visibleKeys };
}

/**
 * 获取需要自动展开的节点（搜索时展开匹配节点的路径）
 * @param {Object} node - 树节点
 * @param {Set} visibleKeys - 需要显示的节点 key 集合
 * @returns {Set} 需要展开的节点 key 集合
 */
function findAncestorKeys(node, targetKey, ancestors = []) {
  if (!node) return null;
  const nodeKey = node.key || node.name;
  if (nodeKey === targetKey) return ancestors;
  const children = node.children || [];
  for (let i = 0; i < children.length; i++) {
    const result = findAncestorKeys(children[i], targetKey, [...ancestors, nodeKey]);
    if (result) return result;
  }
  return null;
}

function getDropPosition(node, event) {
  const rect = event.currentTarget.getBoundingClientRect();
  const ratio = rect.height ? (event.clientY - rect.top) / rect.height : 0.5;
  if (Array.isArray(node.children)) {
    if (ratio < 0.25) return 'before';
    if (ratio > 0.75) return 'after';
    return 'inside';
  }
  return ratio < 0.5 ? 'before' : 'after';
}

const DROP_INDICATOR_STYLES = {
  before: { boxShadow: 'inset 0 2px 0 #1890ff' },
  after: { boxShadow: 'inset 0 -2px 0 #1890ff' },
  inside: { backgroundColor: '#bae7ff' },
};

function getExpandedKeysForSearch(node, visibleKeys) {
  const expandedKeys = new Set();

  function traverse(currentNode) {
    if (!currentNode) return;

    const nodeKey = currentNode.key || currentNode.name;
    const hasChildren = currentNode.children && currentNode.children.length > 0;

    if (hasChildren && visibleKeys.has(nodeKey)) {
      // 检查是否有可见的子节点
      const hasVisibleChild = currentNode.children.some(child => {
        const childKey = child.key || child.name;
        return visibleKeys.has(childKey);
      });

      if (hasVisibleChild) {
        expandedKeys.add(nodeKey);
        currentNode.children.forEach(child => traverse(child));
      }
    }
  }

  traverse(node);
  return expandedKeys;
}

/**
 * 高亮文本中的关键字
 * @param {string} text - 原始文本
 * @param {Array} keywords - 关键字数组
 * @returns {Array} React 元素数组
 */
function highlightText(text, keywords) {
  if (!keywords || keywords.length === 0) {
    return text;
  }

  // 创建正则表达式匹配所有关键字
  const escapedKeywords = keywords.map(k =>
    k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const regex = new RegExp(`(${escapedKeywords.join('|')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, index) => {
    const isMatch = keywords.some(k =>
      part.toLowerCase() === k.toLowerCase()
    );
    if (isMatch) {
      return (
        <span
          key={index}
          style={{
            backgroundColor: '#ffeb3b',
            color: '#000',
            fontWeight: 'bold',
            borderRadius: '2px',
            padding: '0 2px',
          }}
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

// ============================================================================
// 右键菜单组件
// ============================================================================

function TreeContextMenu(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(TreeContextMenu.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = TreeContextMenu.defaultProps[key];
  });
  const menuRef = useRef(null);
  const { onClose, x, y, items } = props;
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    // 菜单变宽后，靠近窗口边缘时向内调整，避免操作项超出可视范围。
    menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`;
  }, [x, y, items]);
  useLayoutEffect(() => {
    const handleClickOutside = event => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('scroll', onClose, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('scroll', onClose, true);
    };
  }, [onClose]);
  if (!items || items.length === 0) {
    return null;
  }
  const menuStyle = {
    position: 'fixed',
    top: y,
    left: x,
    backgroundColor: '#fff',
    border: '1px solid #dce1ee',
    borderRadius: '8px',
    boxShadow: '0 6px 20px rgba(44, 54, 90, 0.14)',
    zIndex: 10000,
    minWidth: 'min(180px, calc(100vw - 16px))',
    maxWidth: 'calc(100vw - 16px)',
    maxHeight: 'calc(100vh - 16px)',
    overflowY: 'auto',
    boxSizing: 'border-box',
    padding: '6px'
  };
  const itemStyle = {
    minHeight: '34px',
    padding: '7px 12px',
    borderRadius: '5px',
    boxSizing: 'border-box',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    fontSize: '13px',
    lineHeight: '20px',
    color: '#4b5563',
    whiteSpace: 'nowrap'
  };
  const itemHoverStyle = {
    backgroundColor: '#f0f2fa'
  };
  // 挂载到页面顶层，避免受树容器的层叠上下文和 overflow 限制。
  return createPortal(<div ref={ref => {
    menuRef.current = ref;
  }} className="tree-context-menu" style={menuStyle}>
        {items.map((item, index) => {
      if (item.divider) {
        return <div key={index} className="tree-context-menu-divider" style={{
          height: '1px',
          backgroundColor: '#e7eaf2',
          margin: '5px 6px'
        }} />;
      }
      return <div key={index} className="tree-context-menu-item" style={itemStyle} onMouseEnter={e => {
        Object.assign(e.currentTarget.style, itemHoverStyle);
      }} onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = '';
      }} onClick={e => {
        e.stopPropagation();
        if (item.onClick) {
          item.onClick();
        }
        onClose();
      }}>
              {item.icon && <i className={item.icon} aria-hidden="true" style={{
          marginRight: '10px',
          width: '16px',
          flexShrink: 0,
          color: '#687287',
          textAlign: 'center'
        }} />}
              <span>{item.label}</span>
            </div>;
    })}
      </div>, document.body);
}



TreeContextMenu.propTypes = {
  x: PropTypes.number.isRequired,
  y: PropTypes.number.isRequired,
  items: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string,
    onClick: PropTypes.func,
    icon: PropTypes.string,
    divider: PropTypes.bool,
  })),
  onClose: PropTypes.func.isRequired,
};

// ============================================================================
// 主组件
// ============================================================================

function ReactTreeVirtualized(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(ReactTreeVirtualized.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = ReactTreeVirtualized.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => {
    // 初始化展开的节点
    const initialExpandedKeys = new Set();
    // 如果 toggled 为 true，展开根节点显示一级目录
    // 如果 toggled 为 true，展开根节点显示一级目录
    if (props.toggled && props.data) {
      const rootKey = props.data.key || props.data.name;
      initialExpandedKeys.add(rootKey);
    }
    if (props.revealNodeKey && props.data) {
      (findAncestorKeys(props.data, props.revealNodeKey) || []).forEach(key => initialExpandedKeys.add(key));
    }
    return {
      expandedKeys: initialExpandedKeys,
      selectedKey: null,
      contextMenu: null, // { x, y, node, items }
      dropIndicator: null // { key, position }
    };
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  const updateState = (update, callback) => {
    const previous = stateRef.current;
    const partial = typeof update === 'function' ? update(previous, propsRef.current) : update;
    if (partial == null) return;
    const next = {
      ...previous,
      ...partial
    };
    stateRef.current = next;
    setState(next);
    if (typeof callback === 'function') callback();
  };
  const clickTimerRef = useRef(null);
  const clickDelayRef = useRef(300);
  const dragNodeRef = useRef(null);
  function getFlattenedData() {
    const {
      data,
      searchText,
      matchNode
    } = propsRef.current;
    const {
      expandedKeys
    } = stateRef.current;

    let matchedKeys = null;
    let visibleKeys = null;
    let effectiveExpandedKeys = expandedKeys;
    if (searchText) {
      const keywords = searchText.split(/\s+/).filter(k => k.length > 0);
      const result = findMatchingNodes(data, searchText, keywords, matchNode);
      matchedKeys = result.matchedKeys;
      visibleKeys = result.visibleKeys;

      // 搜索模式下，自动展开匹配路径上的所有节点
      effectiveExpandedKeys = getExpandedKeysForSearch(data, visibleKeys);
    }
    return flattenTree(data, 0, [], effectiveExpandedKeys, searchText, matchedKeys, visibleKeys);
  }
  function handleToggle(node, event) {
    event.stopPropagation();
    if (propsRef.current.disabled) return;
    const nodeKey = node.key || node.name;
    const {
      expandedKeys
    } = stateRef.current;
    const newExpandedKeys = new Set(expandedKeys);
    if (newExpandedKeys.has(nodeKey)) {
      newExpandedKeys.delete(nodeKey);
    } else {
      newExpandedKeys.add(nodeKey);
    }

    updateState({
      expandedKeys: newExpandedKeys
    }, () => {
      if (propsRef.current.onNodeToggle) {
        propsRef.current.onNodeToggle(node, newExpandedKeys.has(nodeKey));
      }
    });
  }
  function handleNodeClick(node, event) {
    if (propsRef.current.disabled) return;
    const hasChildren = node.children && node.children.length > 0;

    // 有子节点的节点，点击时展开/折叠
    if (hasChildren) {
      handleToggle(node, event);
      return;
    }

    // 无子节点的节点，使用延迟区分单击和双击
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      if (propsRef.current.disabled) return;
      const nodeKey = node.key || node.name;
      updateState({
        selectedKey: nodeKey
      });
      if (propsRef.current.onNodeClick) {
        propsRef.current.onNodeClick(node, event);
      }
    }, clickDelayRef.current);
  }
  function handleNodeDoubleClick(node, event) {
    if (propsRef.current.disabled) return;
    const hasChildren = node.children && node.children.length > 0;

    // 有子节点的节点不触发双击事件
    if (hasChildren) {
      return;
    }

    // 清除单击延迟
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    const nodeKey = node.key || node.name;
    updateState({
      selectedKey: nodeKey
    });
    if (propsRef.current.onNodeDoubleClick) {
      propsRef.current.onNodeDoubleClick(node, event);
    }
  }
  function handleContextMenu(node, event) {
    event.preventDefault();
    event.stopPropagation();
    if (propsRef.current.disabled) return;
    const {
      contextMenuItems
    } = propsRef.current;
    if (!contextMenuItems) {
      return;
    }
    const items = contextMenuItems(node);
    if (!items || items.length === 0) {
      return;
    }
    updateState({
      contextMenu: {
        x: event.clientX,
        y: event.clientY,
        node,
        items
      }
    });
  }
  function closeContextMenu() {
    updateState({
      contextMenu: null
    });
  }
  function setDropIndicator(indicator) {
    const current = stateRef.current.dropIndicator;
    if (current === indicator || current && indicator && current.key === indicator.key && current.position === indicator.position) {
      return;
    }
    updateState({
      dropIndicator: indicator
    });
  }
  function handleDragStart(node, event) {
    if (propsRef.current.disabled) {
      event.preventDefault();
      return;
    }
    dragNodeRef.current = node;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', node.key || node.name);
  }
  function handleDragOver(node, event) {
    if (propsRef.current.disabled) return;
    const dragNode = dragNodeRef.current;
    const {
      canDropNode
    } = propsRef.current;
    if (!dragNode || dragNode === node) {
      setDropIndicator(null);
      return;
    }
    const position = getDropPosition(node, event);
    if (canDropNode && !canDropNode(dragNode, node, position)) {
      setDropIndicator(null);
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropIndicator({
      key: node.key || node.name,
      position
    });
  }
  function handleDrop(node, event) {
    event.preventDefault();
    if (propsRef.current.disabled) return;
    const dragNode = dragNodeRef.current;
    const indicator = stateRef.current.dropIndicator;
    dragNodeRef.current = null;
    setDropIndicator(null);
    if (dragNode && indicator && indicator.key === (node.key || node.name) && propsRef.current.onNodeDrop) {
      propsRef.current.onNodeDrop(dragNode, node, indicator.position);
    }
  }
  function handleDragEnd() {
    dragNodeRef.current = null;
    setDropIndicator(null);
  }
  function renderRow({
    index,
    key,
    style
  }) {
    const flatData = getFlattenedData();
    const item = flatData[index];
    if (!item) {
      return null;
    }
    const {
      node,
      depth,
      hasChildren,
      isExpanded,
      isMatched
    } = item;
    const {
      searchText,
      renderNodeContent,
      renderNodeIcon,
      selectedKeys,
      canDragNode,
      onNodeDrop
    } = propsRef.current;
    const {
      selectedKey,
      dropIndicator
    } = stateRef.current;
    const nodeKey = node.key || node.name;
    const isSelected = selectedKeys ? selectedKeys.indexOf(nodeKey) !== -1 : selectedKey === nodeKey;
    const isDraggable = !propsRef.current.disabled && Boolean(canDragNode && canDragNode(node));
    const dropStyle = dropIndicator && dropIndicator.key === nodeKey ? DROP_INDICATOR_STYLES[dropIndicator.position] : null;
    const dragProps = onNodeDrop ? {
      draggable: isDraggable,
      onDragStart: isDraggable ? e => handleDragStart(node, e) : undefined,
      onDragOver: e => handleDragOver(node, e),
      onDrop: e => handleDrop(node, e),
      onDragEnd: handleDragEnd
    } : {};

    // 搜索关键字
    const keywords = searchText ? searchText.split(/\s+/).filter(k => k.length > 0) : [];

    // 节点名称（可能高亮）
    const displayName = keywords.length > 0 ? highlightText(node.name, keywords) : node.name;

    // 节点样式
    const rowStyle = {
      ...style,
      display: 'flex',
      alignItems: 'center',
      paddingRight: 0,
      cursor: 'pointer',
      backgroundColor: isSelected ? '#e3f2fd' : isMatched ? '#fff8e1' : 'transparent',
      boxSizing: 'border-box',
      userSelect: 'none',
      ...dropStyle
    };

    // 计算每层的缩进宽度
    const indentWidth = 14;

    // 渲染缩进区域（包含竖线）
    const indentElements = [];
    for (let i = 0; i < depth; i++) {
      // 检查该层级的祖先节点是否展开且有后续兄弟节点
      const showLine = shouldShowVerticalLine(item, i);
      indentElements.push(<span key={`indent-${i}`} style={{
        display: 'inline-block',
        width: indentWidth,
        height: '100%',
        position: 'relative'
      }}>
          {showLine && <span style={{
          position: 'absolute',
          left: '7px',
          top: 0,
          bottom: 0,
          width: '1px',
          backgroundColor: '#ccc'
        }} />}
        </span>);
    }

    // 展开/折叠图标 (+ / -)
    const toggleIcon = hasChildren ? <span onClick={e => handleToggle(node, e)} style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '16px',
      height: '16px',
      marginRight: '4px',
      cursor: 'pointer',
      border: '1px solid #999',
      backgroundColor: '#fff',
      fontSize: '12px',
      fontWeight: 'bold',
      color: '#666',
      lineHeight: '14px',
      textAlign: 'center',
      flexShrink: 0
    }}>
        {isExpanded ? '−' : '+'}
      </span> : <span style={{
      width: renderNodeIcon ? '16px' : '6px',
      marginRight: renderNodeIcon ? '4px' : '0px',
      flexShrink: 0
    }} />;

    // 自定义内容渲染
    const content = renderNodeContent ? renderNodeContent(node, {
      isExpanded,
      isSelected,
      isMatched,
      depth
    }) : <span style={{
      flex: 1,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      fontSize: '13px',
      color: '#333'
    }} title={node.name}>
          {displayName}
        </span>;
    return <div key={key} style={rowStyle} {...dragProps} onClick={e => handleNodeClick(node, e)} onDoubleClick={e => handleNodeDoubleClick(node, e)} onContextMenu={e => handleContextMenu(node, e)} onMouseEnter={e => {
      if (!isSelected) {
        e.currentTarget.style.backgroundColor = '#f5f5f5';
      }
    }} onMouseLeave={e => {
      if (!isSelected) {
        e.currentTarget.style.backgroundColor = isMatched ? '#fff8e1' : 'transparent';
      }
    }}>
        {indentElements}
        {toggleIcon}
        {renderNodeIcon && renderNodeIcon(node, { isExpanded, hasChildren })}
        {content}
      </div>;
  }
  function shouldShowVerticalLine(item, targetDepth) {
    const {
      expandedKeys
    } = stateRef.current;
    const flatData = getFlattenedData();
    const currentIndex = flatData.indexOf(item);

    // 从当前节点向上查找 targetDepth 深度的祖先
    // 然后检查该祖先是否还有后续的兄弟节点（即竖线是否需要继续）
    for (let i = currentIndex - 1; i >= 0; i--) {
      const prevItem = flatData[i];
      if (prevItem.depth === targetDepth) {
        // 找到了该深度的节点，检查它是否展开
        const prevNodeKey = prevItem.node.key || prevItem.node.name;
        if (prevItem.hasChildren && expandedKeys.has(prevNodeKey)) {
          // 该节点展开了，需要显示竖线
          // 但还需要检查当前节点是否在该节点的子树范围内
          return isDescendantOf(item, prevItem, flatData, currentIndex, i);
        }
        break;
      }
      if (prevItem.depth < targetDepth) {
        // 已经超出了该深度的范围
        break;
      }
    }
    return false;
  }
  function isDescendantOf(item, ancestor, flatData, itemIndex, ancestorIndex) {
    // 从 ancestor 开始，找到它的最后一个后代
    const ancestorDepth = ancestor.depth;
    for (let i = ancestorIndex + 1; i < flatData.length; i++) {
      if (flatData[i].depth <= ancestorDepth) {
        // 已经离开了 ancestor 的子树
        return itemIndex < i;
      }
    }
    // ancestor 的子树延伸到列表末尾
    return true;
  }
  function receiveProps(nextProps) {
    // 当 data 首次加载且 toggled 为 true 时，自动展开根节点
    if (!propsRef.current.data && nextProps.data && nextProps.toggled) {
      const rootKey = nextProps.data.key || nextProps.data.name;
      const newExpandedKeys = new Set(stateRef.current.expandedKeys);
      newExpandedKeys.add(rootKey);
      updateState({
        expandedKeys: newExpandedKeys
      });
    }

    // 当搜索文本变化时，重置展开状态并计算需要展开的节点
    if (nextProps.searchText !== propsRef.current.searchText) {
      if (nextProps.searchText) {
        const keywords = nextProps.searchText.split(/\s+/).filter(k => k.length > 0);
        const {
          visibleKeys
        } = findMatchingNodes(nextProps.data, nextProps.searchText, keywords, nextProps.matchNode);
        const searchExpandedKeys = getExpandedKeysForSearch(nextProps.data, visibleKeys);
        updateState({
          expandedKeys: searchExpandedKeys
        });
      }
      // 清空搜索时，不重置展开状态，保持用户手动展开的节点
    }

    // revealNodeKey 变化或数据刷新后，展开目标节点的所有祖先
    if (nextProps.revealNodeKey && nextProps.data && (nextProps.revealNodeKey !== propsRef.current.revealNodeKey || nextProps.data !== propsRef.current.data)) {
      const ancestors = findAncestorKeys(nextProps.data, nextProps.revealNodeKey) || [];
      if (ancestors.some(key => !stateRef.current.expandedKeys.has(key))) {
        const newExpandedKeys = new Set(stateRef.current.expandedKeys);
        ancestors.forEach(key => newExpandedKeys.add(key));
        updateState({
          expandedKeys: newExpandedKeys
        });
      }
    }
  }
  const previousIncomingPropsRef = useRef(incomingProps);
  const incomingKeys = Object.keys(incomingProps);
  const previousIncomingProps = previousIncomingPropsRef.current;
  const incomingPropsChanged = incomingKeys.length !== Object.keys(previousIncomingProps).length || incomingKeys.some(key => incomingProps[key] !== previousIncomingProps[key]);
  if (incomingPropsChanged) {
    receiveProps(props);
    previousIncomingPropsRef.current = incomingProps;
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    if (!props.disabled) return;
    clearTimeout(clickTimerRef.current);
    clickTimerRef.current = null;
    dragNodeRef.current = null;
    setState(current => ({ ...current, contextMenu: null, dropIndicator: null }));
  }, [props.disabled]);
  useLayoutEffect(() => () => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
  }, []);
  const {
    height,
    rowHeight,
    style,
    width
  } = propsRef.current;
  const {
    contextMenu
  } = stateRef.current;
  const flatData = getFlattenedData();
  const rowCount = flatData.length;
  const containerStyle = {
    position: 'relative',
    height: height || '100%',
    width: width || '100%',
    ...style
  };

  // 如果没有数据，显示空状态
  if (rowCount === 0) {
    return <div style={containerStyle}>
          <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#999',
        fontSize: '14px'
      }}>
            {propsRef.current.searchText ? '无匹配结果' : '暂无数据'}
          </div>
        </div>;
  }
  return <div style={containerStyle}>
        {height ? <List width={width || 300} height={height} rowCount={rowCount} rowHeight={rowHeight || 28} rowRenderer={renderRow} overscanRowCount={10} style={{
      outline: 'none'
    }} /> : <AutoSizer>
            {({
        width: autoWidth,
        height: autoHeight
      }) => <List width={autoWidth} height={autoHeight} rowCount={rowCount} rowHeight={rowHeight || 28} rowRenderer={renderRow} overscanRowCount={10} style={{
        outline: 'none'
      }} />}
          </AutoSizer>}

        {!props.disabled && contextMenu && <TreeContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} onClose={closeContextMenu} />}
      </div>;
}



ReactTreeVirtualized.propTypes = {
  // 树形数据（根节点）
  data: PropTypes.shape({
    name: PropTypes.string.isRequired,
    key: PropTypes.string,
    children: PropTypes.array,
  }),
  // 容器高度（如果不提供，使用 AutoSizer 自动计算）
  height: PropTypes.number,
  // 容器宽度
  width: PropTypes.number,
  // 行高，默认 28px
  rowHeight: PropTypes.number,
  // 是否默认展开根节点显示一级目录
  toggled: PropTypes.bool,
  // 暂停交互，保留展开状态，并清理菜单、拖拽和延迟点击。
  disabled: PropTypes.bool,
  // 单击回调
  onNodeClick: PropTypes.func,
  // 双击回调
  onNodeDoubleClick: PropTypes.func,
  // 展开/折叠回调
  onNodeToggle: PropTypes.func,
  // 右键菜单配置函数
  contextMenuItems: PropTypes.func,
  // 搜索文本
  searchText: PropTypes.string,
  // 自定义节点内容渲染
  renderNodeContent: PropTypes.func,
  // 可选节点类型图标，不影响默认名称渲染和搜索高亮。
  renderNodeIcon: PropTypes.func,
  // 自定义样式
  style: PropTypes.object,
  // 自定义搜索匹配 (node, keywords) => bool，默认按名称匹配全部关键字
  matchNode: PropTypes.func,
  // 受控的选中节点 key 列表（多选高亮），不传时使用内部单选状态
  selectedKeys: PropTypes.arrayOf(PropTypes.string),
  // 需要展开其祖先使之可见的节点 key
  revealNodeKey: PropTypes.string,
  // 拖拽：是否允许拖动节点 (node) => bool
  canDragNode: PropTypes.func,
  // 拖拽：是否允许放置 (dragNode, targetNode, position) => bool，position 为 before/after/inside
  canDropNode: PropTypes.func,
  // 拖拽：放置回调 (dragNode, targetNode, position)，不传时不启用拖拽
  onNodeDrop: PropTypes.func,
};

ReactTreeVirtualized.defaultProps = {
  rowHeight: 28,
  data: null,
  height: null,
  width: null,
  toggled: false,
  disabled: false,
  onNodeClick: null,
  onNodeDoubleClick: null,
  onNodeToggle: null,
  contextMenuItems: null,
  searchText: '',
  renderNodeContent: null,
  renderNodeIcon: null,
  style: {},
  matchNode: null,
  selectedKeys: null,
  revealNodeKey: null,
  canDragNode: null,
  canDropNode: null,
  onNodeDrop: null,
};
// 示例数据 data示例
// const treeData = {
//   name: '根节点',
//   key: 'root',
//   children: [
//     { name: '子节点1', key: 'child1', children: [...] },
//     { name: '叶子节点', key: 'leaf1' },
//   ]
// };

export default ReactTreeVirtualized;

