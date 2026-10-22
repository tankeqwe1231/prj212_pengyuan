import React from 'react';
import PropTypes from 'prop-types';

function TreeNode({ depth, node, onToggle }) {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const toggled = Boolean(node.toggled);
  return (
    <div>
      <div
        className={node.active ? 'tree-node active' : 'tree-node'}
        onClick={() => onToggle(node, !toggled)}
        role="treeitem"
        style={{ cursor: 'pointer', fontSize: '14px', lineHeight: '20px', padding: '0 8px', paddingLeft: 8 + (depth * 18) }}
      >
        {hasChildren && <span><i className={`fa ${toggled ? 'fa-caret-down' : 'fa-caret-right'}`} />{' '}</span>}
        {node.name}
      </div>
      {hasChildren && toggled ? node.children.map((child, index) => (
        <TreeNode
          depth={depth + 1}
          key={child.id || child.key || child.name || index}
          node={child}
          onToggle={onToggle}
        />
      )) : null}
    </div>
  );
}

TreeNode.propTypes = {
  depth: PropTypes.number.isRequired,
  node: PropTypes.object.isRequired,
  onToggle: PropTypes.func.isRequired,
};

function Tree({ data, onToggle, style }) {
  const nodes = Array.isArray(data) ? data : [data];
  return (
    <div role="tree" style={style && (style.tree || style)}>
      {nodes.filter(Boolean).map((node, index) => (
        <TreeNode
          depth={0}
          key={node.id || node.key || node.name || index}
          node={node}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

Tree.propTypes = {
  data: PropTypes.oneOfType([PropTypes.array, PropTypes.object]).isRequired,
  onToggle: PropTypes.func.isRequired,
  style: PropTypes.object,
};

export default Tree;
