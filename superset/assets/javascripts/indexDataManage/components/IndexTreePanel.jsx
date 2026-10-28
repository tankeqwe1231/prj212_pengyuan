import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import debounce from 'lodash.debounce';
import ReactTreeVirtualized from '../../modules/ReactTreeVirtualized';
import { canDragNode, canDropNode, isCategoryNode, matchTreeNode } from '../utils/treeUtils';

function renderNodeIcon(node, { isExpanded, hasChildren }) {
  const isCategory = isCategoryNode(node);
  const label = isCategory ? (hasChildren ? '目录' : '空目录') : '指标';
  const icon = isCategory ? (isExpanded && hasChildren ? 'fa-folder-open-o' : 'fa-folder-o') : 'fa-line-chart';
  return (
    <span
      className={`index-tree-node-icon ${isCategory ? 'is-category' : 'is-indicator'}`}
      title={label}
      role="img"
      aria-label={label}
    >
      <i className={`fa ${icon}`} aria-hidden="true" />
    </span>
  );
}

export default function IndexTreePanel({
  tree,
  loading,
  moving = false,
  selectedKeys,
  revealNodeKey,
  onNodeClick,
  onNodeDoubleClick,
  contextMenuItems,
  onNodeDrop,
}) {
  const [searchText, setSearchText] = useState('');
  const updateSearch = useMemo(() => debounce(setSearchText, 300), []);
  useEffect(() => () => updateSearch.cancel(), [updateSearch]);

  if (!tree) {
    return <div className="tree-empty-message">{loading ? '加载中…' : '暂无数据'}</div>;
  }
  return (
    <div className="tree-container">
      <div className="tree-content" inert={moving ? true : undefined} aria-busy={moving}>
        <div className="tree-search-field">
          <i className="fa fa-search" aria-hidden="true" />
          <input
            className="form-control tree-search-input"
            type="text"
            placeholder="输入关键字(多个以空格分隔)"
            aria-label="搜索指标"
            disabled={moving}
            onChange={event => { if (!moving) updateSearch(event.target.value); }}
          />
        </div>
        <div className="tree-body">
          <ReactTreeVirtualized
            data={tree}
            toggled
            disabled={moving}
            searchText={searchText}
            matchNode={matchTreeNode}
            renderNodeIcon={renderNodeIcon}
            selectedKeys={selectedKeys}
            revealNodeKey={revealNodeKey}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={(node, event) => { if (!isCategoryNode(node)) onNodeDoubleClick(node, event); }}
            contextMenuItems={contextMenuItems}
            canDragNode={canDragNode}
            canDropNode={(dragNode, target, position) => canDropNode(tree, dragNode, target, position)}
            onNodeDrop={onNodeDrop}
          />
        </div>
      </div>
      {moving && (
        <div className="tree-move-overlay" role="status" aria-live="polite" aria-atomic="true">
          <div className="tree-move-message">
            <i className="fa fa-spinner fa-spin" aria-hidden="true" />
            <span>正在保存移动，请稍候…</span>
            <small>完成后将自动恢复操作</small>
          </div>
        </div>
      )}
    </div>
  );
}

IndexTreePanel.propTypes = {
  tree: PropTypes.object,
  loading: PropTypes.bool,
  moving: PropTypes.bool,
  selectedKeys: PropTypes.arrayOf(PropTypes.string),
  revealNodeKey: PropTypes.string,
  onNodeClick: PropTypes.func.isRequired,
  onNodeDoubleClick: PropTypes.func.isRequired,
  contextMenuItems: PropTypes.func.isRequired,
  onNodeDrop: PropTypes.func.isRequired,
};

IndexTreePanel.defaultProps = {
  tree: null,
  loading: false,
  selectedKeys: [],
  revealNodeKey: null,
};
