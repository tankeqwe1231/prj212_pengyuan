// Helper function to check if a node matches the filter
export const defaultMatcher = (filterText, node) => {
    return node.name.toLowerCase().includes(filterText.toLowerCase());
};

// Helper function to recursively find a matching node or its descendants
export const findNode = (node, filter, matcher) => {
    return matcher(filter, node) ||
        (node.children &&
        node.children.length &&
        node.children.some(child => findNode(child, filter, matcher)));
};

// Helper function to filter the tree based on the filter text
export const filterTree = (node, filter, matcher = defaultMatcher) => {
    if (matcher(filter, node) || !node.children) {
        return node;
    }
    const filteredChildren = node.children
        .filter(child => findNode(child, filter, matcher))
        .map(child => filterTree(child, filter, matcher));
    return { ...node, children: filteredChildren };
};

// Helper function to expand filtered nodes
export const expandFilteredNodes = (node, filter, matcher = defaultMatcher) => {
    const children = node.children || [];
    if (children.length === 0) {
        return { ...node, toggled: false };
    }
    const childrenWithMatches = children.filter(child => findNode(child, filter, matcher));
    const shouldExpand = childrenWithMatches.length > 0;
    if (shouldExpand) {
        const expandedChildren = childrenWithMatches.map(child =>
            expandFilteredNodes(child, filter, matcher)
        );
        return { ...node, children: expandedChildren, toggled: true };
    }
    return { ...node, toggled: false };
};

