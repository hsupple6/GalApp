//  Supposed to be a General Purpose HList
// But also has drag and drop for arbitrary rearrangement
// Modeled on Figma Layer Panel
// So, I am pausing on it, because not ready to deal
// with that complexity in our EntityBrowser

import './HierarchicalList.scss';

import React, { useRef, useState } from 'react';

export interface HierarchicalEntity {
  id: string;
  name: string;
  details?: string;
  children?: HierarchicalEntity[];
  parentId?: string | null; // Track parent for drag-and-drop
  [key: string]: any; // Allow custom metadata
}

interface HierarchicalListProps {
  data: HierarchicalEntity[];
  onChange?: (updatedData: HierarchicalEntity[]) => void; // Callback for updates
}

interface FlattenedNode {
  item: HierarchicalEntity;
  depth: number;
}

const HierarchicalList: React.FC<HierarchicalListProps> = ({ data, onChange }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'above' | 'below' | 'on' | null>(null);
  const [expandTimer, setExpandTimer] = useState<NodeJS.Timeout | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const dragItem = useRef<HierarchicalEntity | null>(null);

  // Toggle expand/collapse
  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(id)) {
        newExpanded.delete(id);
      } else {
        newExpanded.add(id);
      }
      return newExpanded;
    });
  };

  // Handle selection (multi-select with Shift/Ctrl/Cmd)
  const handleSelect = (id: string, event: React.MouseEvent) => {
    const isMultiSelect = event.metaKey || event.ctrlKey;
    const isRangeSelect = event.shiftKey;

    if (isRangeSelect) {
      console.debug('Range selection is not yet implemented');
    } else if (isMultiSelect) {
      setSelectedIds((prev) => {
        const newSelected = new Set(prev);
        if (newSelected.has(id)) {
          newSelected.delete(id);
        } else {
          newSelected.add(id);
        }
        return newSelected;
      });
    } else {
      setSelectedIds(new Set([id]));
    }
  };

  const handleMouseEnter = (id: string) => setHoveredId(id);
  const handleMouseLeave = () => setHoveredId(null);

  const handleDragStart = (item: HierarchicalEntity) => {
    dragItem.current = item;
    setIsDragging(true);
    setDragOverId(null);
    setDropPosition(null);
  };

  const handleDragEnter = (event: React.DragEvent, id: string) => {
    const targetRect = (event.target as HTMLElement).getBoundingClientRect();
    const cursorY = event.clientY;

    const position =
      cursorY < targetRect.top + targetRect.height / 3
        ? 'above'
        : cursorY > targetRect.bottom - targetRect.height / 3
          ? 'below'
          : 'on';

    setDragOverId(id);
    setDropPosition(position);

    console.debug(`DragEnter: targetId=${id}, position=${position}`);

    if (position === 'on') {
      // Start the timer to auto-expand parent nodes
      const timer = setTimeout(() => {
        if (!expanded.has(id)) {
          toggleExpand(id);
        }
      }, 1000); // 1-second delay
      setExpandTimer(timer);
    }
  };

  const handleDragLeave = (event: React.DragEvent) => {
    const relatedTarget = event.relatedTarget as HTMLElement;

    // Prevent clearing state if still hovering over a valid target
    if (relatedTarget && relatedTarget.closest('.row')) {
      return;
    }

    setDragOverId(null);
    setDropPosition(null);

    if (expandTimer) {
      clearTimeout(expandTimer);
      setExpandTimer(null);
    }
  };

  const handleDrop = (targetId: string) => {
    console.debug('Drop detected:', targetId);
    const draggedItem = dragItem.current;
    if (!draggedItem || !dragOverId || !dropPosition) {
      console.debug('Invalid drop:', { draggedItem, dragOverId, dropPosition });
      return;
    }
    const updatedData = moveItemInHierarchy(data, draggedItem.id, dragOverId, dropPosition);
    onChange?.(updatedData);

    // Clear drag state
    dragItem.current = null;
    setDragOverId(null);
    setDropPosition(null);
    setIsDragging(false);
    console.debug('Drop handled successfully');

    if (expandTimer) {
      clearTimeout(expandTimer);
      setExpandTimer(null);
    }
  };

  // Flatten the tree into a visible array
  const flattenTree = (nodes: HierarchicalEntity[], depth = 0): FlattenedNode[] =>
    nodes.flatMap((node) => {
      const isExpanded = expanded.has(node.id);
      const children: FlattenedNode[] = isExpanded ? flattenTree(node.children || [], depth + 1) : [];
      return [{ item: node, depth }, ...children];
    });

  const flattenedData: FlattenedNode[] = flattenTree(data);

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault(); // Critical to allow onDrop to fire
  };

  return (
    <div className="hierarchicalList">
      {flattenedData.map(({ item, depth }: FlattenedNode) => (
        <div
          key={item.id}
          className={`row
                      ${selectedIds.has(item.id) ? 'selected' : ''}
                      ${isDragging && dragItem.current?.id === item.id ? 'dragging' : ''}
                      ${dragOverId === item.id && dropPosition === 'above' ? 'dropAbove' : ''}
                      ${dragOverId === item.id && dropPosition === 'below' ? 'dropBelow' : ''}
                      ${dragOverId === item.id && dropPosition === 'on' ? 'dropOn' : ''}`}
          style={{ paddingLeft: `${depth * 20}px` }}
          draggable
          onClick={(event) => handleSelect(item.id, event)}
          onDragStart={() => handleDragStart(item)}
          onDragEnter={(event) => handleDragEnter(event, item.id)}
          onDragLeave={handleDragLeave}
          onDrop={() => handleDrop(item.id)}
          onDragOver={handleDragOver}
          onMouseEnter={() => handleMouseEnter(item.id)}
          onMouseLeave={handleMouseLeave}
        >
          {item.children && item.children.length > 0 && (
            <span className="caret" onClick={() => toggleExpand(item.id)}>
              {expanded.has(item.id) ? '▾' : '▸'}
            </span>
          )}
          <span className="name">{item.name}</span>
        </div>
      ))}
    </div>
  );
};

// Utility: Move item in hierarchy
const moveItemInHierarchy = (
  nodes: HierarchicalEntity[],
  draggedId: string,
  targetId: string,
  position: 'above' | 'below' | 'on',
): HierarchicalEntity[] => {
  const draggedNode = findNode(nodes, draggedId);
  if (!draggedNode) return nodes;

  // Remove dragged node
  const withoutDragged = removeNode(nodes, draggedId);

  if (position === 'on') {
    // Add as a child
    return addChildNode(withoutDragged, draggedNode, targetId);
  }

  // Insert above or below
  return insertSibling(withoutDragged, draggedNode, targetId, position);
};

// Helper: Insert a sibling
const insertSibling = (
  nodes: HierarchicalEntity[],
  draggedNode: HierarchicalEntity,
  targetId: string,
  position: 'above' | 'below',
): HierarchicalEntity[] => {
  const result: HierarchicalEntity[] = [];
  for (const node of nodes) {
    if (node.id === targetId) {
      if (position === 'above') result.push(draggedNode);
      result.push(node);
      if (position === 'below') result.push(draggedNode);
    } else {
      result.push({
        ...node,
        children: insertSibling(node.children || [], draggedNode, targetId, position),
      });
    }
  }
  return result;
};

// Helper: Find a node by ID
const findNode = (nodes: HierarchicalEntity[], id: string): HierarchicalEntity | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    const childNode = findNode(node.children || [], id);
    if (childNode) return childNode;
  }
  return null;
};

// Helper: Remove a node
const removeNode = (nodes: HierarchicalEntity[], id: string): HierarchicalEntity[] => {
  return nodes
    .map((node) => ({
      ...node,
      children: removeNode(node.children || [], id),
    }))
    .filter((node) => node.id !== id);
};

// Helper: Add a child node
const addChildNode = (
  nodes: HierarchicalEntity[],
  child: HierarchicalEntity,
  parentId: string,
): HierarchicalEntity[] => {
  return nodes.map((node) => {
    if (node.id === parentId) {
      return {
        ...node,
        children: [...(node.children || []), child],
      };
    }
    return {
      ...node,
      children: addChildNode(node.children || [], child, parentId),
    };
  });
};

export default HierarchicalList;
