// 节点树工具：节点判断、查找、拖拽规则与乐观更新。
// 节点带 children 数组，指标叶子节点没有 children；
// parent_id 为 0 的节点是根目录，不能移动/改名/删除，也不能直接挂指标。

export function isCategoryNode(node) {
  return Boolean(node) && Array.isArray(node.children);
}

export function isVirtualNode(node) {
  return Boolean(node && node.is_virtual);
}

export function isRealCategory(node) {
  return isCategoryNode(node) && !isVirtualNode(node) &&
    Number.isInteger(node.node_id) && node.node_id > 0;
}

export function isRootCategory(node) {
  return isRealCategory(node) && !node.parent_id;
}

// 修改节点的父节点可选根目录，但不可选自身、后代或虚拟节点。
export function getParentCategoryOptions(tree, excludedNodeId = null) {
  const options = [];
  function visit(node, parentPath) {
    if (!node || isVirtualNode(node) ||
      (excludedNodeId != null && Number(node.node_id) === Number(excludedNodeId))) return;
    const path = isRealCategory(node) ? parentPath.concat(node.name) : parentPath;
    if (isRealCategory(node)) options.push({ value: node.node_id, label: path.join('|') });
    (node.children || []).forEach(child => visit(child, path));
  }
  visit(tree, []);
  return options;
}

// 指标 key 形如 数据库|指标列表|数据表|table_ID
export function parseIndexKey(key) {
  const parts = String(key || '').split('|');
  if (parts.length !== 4) {
    return null;
  }
  return {
    database: parts[0],
    listTable: parts[1],
    dataTable: parts[2],
    tableId: parts[3],
  };
}

export function getListGroup(key) {
  const parsed = parseIndexKey(key);
  return parsed ? `${parsed.database}|${parsed.listTable}` : '';
}

export function walkTree(node, visit, parent = null) {
  if (!node) return;
  visit(node, parent);
  (node.children || []).forEach(child => walkTree(child, visit, node));
}

export function findNode(tree, key) {
  let found = null;
  walkTree(tree, (node, parent) => {
    if (!found && node.key === key) {
      found = { node, parent };
    }
  });
  return found;
}

export function isDescendant(ancestor, key) {
  let result = false;
  (ancestor.children || []).forEach((child) => {
    walkTree(child, (node) => {
      if (node.key === key) result = true;
    });
  });
  return result;
}

export function canDragNode(node) {
  if (!node || isVirtualNode(node)) return false;
  if (isCategoryNode(node)) return isRealCategory(node) && !isRootCategory(node);
  return Boolean(parseIndexKey(node.key));
}

export function canDropNode(tree, dragNode, target, position) {
  if (!dragNode || !target || dragNode.key === target.key || isVirtualNode(target)) {
    return false;
  }
  if (isCategoryNode(dragNode)) {
    if (!isRealCategory(target) || isDescendant(dragNode, target.key)) {
      return false;
    }
    return position === 'inside' || !isRootCategory(target);
  }
  if (position === 'inside') {
    return isRealCategory(target) && !isRootCategory(target);
  }
  if (isCategoryNode(target)) {
    return false;
  }
  const located = findNode(tree, target.key);
  return Boolean(located && isRealCategory(located.parent) && !isRootCategory(located.parent));
}

// 计算后端移动请求：节点按同级节点计序，指标按同一指标列表内的同级指标计序（均为 1 起）
export function buildMoveRequest(tree, dragNode, target, position) {
  if (position === 'inside') {
    return isCategoryNode(dragNode)
      ? { action: 'move_category', node_id: dragNode.node_id, new_parent_id: target.node_id, new_order: null }
      : { action: 'move_indexes', node_keys: [dragNode.key], new_parent_id: target.node_id, new_order: null };
  }
  const located = findNode(tree, target.key);
  if (!located || !located.parent) {
    return null;
  }
  const parent = located.parent;
  if (isCategoryNode(dragNode)) {
    const siblings = parent.children.filter(child => isRealCategory(child) && child.key !== dragNode.key);
    const index = siblings.findIndex(child => child.key === target.key);
    return {
      action: 'move_category',
      node_id: dragNode.node_id,
      new_parent_id: parent.node_id,
      new_order: index + (position === 'after' ? 2 : 1),
    };
  }
  const group = getListGroup(dragNode.key);
  const siblings = parent.children.filter(child =>
    !isCategoryNode(child) && child.key !== dragNode.key && getListGroup(child.key) === group);
  const index = siblings.findIndex(child => child.key === target.key);
  let newOrder;
  if (index === -1) {
    // 目标指标属于其他指标列表：按目标之前的同列表指标数量定位
    const targetPosition = parent.children.findIndex(child => child.key === target.key);
    newOrder = parent.children.slice(0, targetPosition)
      .filter(child => siblings.indexOf(child) !== -1).length + 1;
  } else {
    newOrder = index + (position === 'after' ? 2 : 1);
  }
  return {
    action: 'move_indexes',
    node_keys: [dragNode.key],
    new_parent_id: parent.node_id,
    new_order: newOrder,
  };
}

// 搜索：叶子按 searchText 匹配全部关键字，节点按名称匹配
export function matchTreeNode(node, keywords) {
  const text = String(node.searchText || node.name || '').toLowerCase();
  return keywords.every(keyword => text.indexOf(String(keyword).toLowerCase()) !== -1);
}

// 新建计算指标时可选的保存节点：真实且非根目录的节点
export function getSaveCategoryOptions(categoryMap, tree) {
  const rootIds = new Set();
  walkTree(tree, (node) => {
    if (isRootCategory(node)) rootIds.add(node.node_id);
  });
  return (categoryMap || [])
    .filter(item => Number.isInteger(Number(item.node_id)) &&
      Number(item.node_id) > 0 && !rootIds.has(Number(item.node_id)))
    .map(item => ({ value: Number(item.node_id), label: item.nodes_path }));
}

// 树中按 key 收集叶子指标（用于框选/批量）
export function collectLeafKeys(node) {
  const keys = [];
  walkTree(node, (item) => {
    if (!isCategoryNode(item) && item.key) keys.push(item.key);
  });
  return keys;
}
