import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { isRealCategory, isRootCategory } from '../utils/treeUtils';

// 将节点树裁剪为只含真实节点的结构；根目录可展开但不可选
function toPickerNodes(node, pathById) {
  if (!isRealCategory(node)) {
    return (node && Array.isArray(node.children) && !node.is_virtual)
      ? node.children.reduce((all, child) => all.concat(toPickerNodes(child, pathById)), [])
      : [];
  }
  return [{
    id: node.node_id,
    name: node.name,
    path: pathById[node.node_id] || node.name,
    selectable: !isRootCategory(node),
    children: node.children.reduce((all, child) => all.concat(toPickerNodes(child, pathById)), []),
  }];
}

function filterNodes(nodes, words) {
  if (!words.length) return nodes;
  return nodes.reduce((all, node) => {
    const children = filterNodes(node.children, words);
    const text = node.path.toLowerCase();
    const matches = words.every(word => text.indexOf(word) !== -1);
    return matches || children.length ? all.concat({ ...node, children }) : all;
  }, []);
}

export default function CategoryTreePicker({ tree, categoryMap, value, onChange, disabled, label }) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const pathById = useMemo(() => {
    const result = {};
    (categoryMap || []).forEach((item) => {
      result[Number(item.node_id)] = String(item.nodes_path || '');
    });
    return result;
  }, [categoryMap]);
  const roots = useMemo(() => toPickerNodes(tree, pathById), [tree, pathById]);
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const visible = filterNodes(roots, words);
  const selectedPath = value != null ? pathById[Number(value)] : '';

  const renderRows = (nodes, depth = 0) => nodes.map((node) => {
    const open = words.length > 0 || (collapsed[node.id] === undefined ? depth < 2 : !collapsed[node.id]);
    const selected = Number(value) === node.id;
    return (
      <div key={node.id}>
        <div className={`category-picker-row${selected ? ' selected' : ''}`} style={{ paddingLeft: depth * 16 }}>
          <button
            type="button"
            className="category-picker-arrow"
            disabled={disabled || !node.children.length}
            aria-label={`${open ? '收起' : '展开'}${node.name}`}
            onClick={() => setCollapsed({ ...collapsed, [node.id]: open })}
          >
            {node.children.length ? (open ? '▾' : '▸') : ''}
          </button>
          <button
            type="button"
            className="category-picker-select"
            disabled={disabled || !node.selectable}
            aria-pressed={selected}
            onClick={() => onChange(node.id)}
          >
            <span className="category-picker-radio" aria-hidden="true" />
            {node.name}
          </button>
        </div>
        {open && renderRows(node.children, depth + 1)}
      </div>
    );
  });

  return (
    <div className={`category-picker${disabled ? ' disabled' : ''}`}>
      <div className="category-picker-header">
        {label && <span className="calc-form-label">{label}</span>}
        <div className="category-picker-path">
          <span>已选路径：</span>
          <span>{selectedPath ? selectedPath.split('|').join(' › ') : '尚未选择节点'}</span>
        </div>
      </div>
      <input
        type="search"
        className="category-picker-search"
        aria-label="搜索节点名称"
        placeholder="搜索节点名称"
        value={search}
        disabled={disabled}
        onChange={e => setSearch(e.target.value)}
      />
      <div className="category-picker-tree" aria-label="保存节点">
        {visible.length ? renderRows(visible) : <div className="category-picker-empty">没有匹配的节点</div>}
      </div>
    </div>
  );
}

CategoryTreePicker.propTypes = {
  tree: PropTypes.object,
  categoryMap: PropTypes.array,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  label: PropTypes.string,
};

CategoryTreePicker.defaultProps = {
  tree: null,
  categoryMap: [],
  value: null,
  disabled: false,
};
