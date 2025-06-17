import React, { useCallback, useEffect, useRef, useState } from 'react';
import './ContextMenu.scss';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  onClick?: () => void;
  children?: ContextMenuItem[];
  type?: 'item' | 'separator' | 'metadata';
  shortcut?: string; // Keyboard shortcut display
}

export interface ContextMenuProps {
  items: ContextMenuItem[];
  visible: boolean;
  x: number;
  y: number;
  onClose: () => void;
  className?: string;
}

/**
 * Simple separator component for the context menu
 */
export const ContextMenuSeparator = () => (
  <li className="context-menu-separator"></li>
);

/**
 * A reusable context menu component that can be used anywhere in the application.
 * It handles positioning, click outside, and keyboard navigation.
 */
const ContextMenu: React.FC<ContextMenuProps> = ({ 
  items, 
  visible, 
  x, 
  y, 
  onClose,
  className = ''
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });
  const [activeItemIndex, setActiveItemIndex] = useState<number>(-1);
  
  // Reset active item when menu visibility changes
  useEffect(() => {
    setActiveItemIndex(-1);
  }, [visible]);
  
  // Adjust position if menu would go off screen
  useEffect(() => {
    if (visible && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      
      let adjustedX = x;
      let adjustedY = y;
      
      // Check if menu would go off right edge
      if (x + rect.width > windowWidth) {
        adjustedX = windowWidth - rect.width - 5; // 5px buffer
      }
      
      // Check if menu would go off bottom edge
      if (y + rect.height > windowHeight) {
        adjustedY = windowHeight - rect.height - 5; // 5px buffer
      }
      
      setPosition({ x: adjustedX, y: adjustedY });
    }
  }, [visible, x, y]);
  
  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [visible, onClose]);
  
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible) return;
      
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setActiveItemIndex(prev => {
            // Find next non-separator, non-metadata item
            let nextIndex = prev + 1;
            while (
              nextIndex < items.length && 
              (items[nextIndex].type === 'separator' || items[nextIndex].type === 'metadata')
            ) {
              nextIndex++;
            }
            return nextIndex < items.length ? nextIndex : prev;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveItemIndex(prev => {
            // Find previous non-separator, non-metadata item
            let prevIndex = prev - 1;
            while (
              prevIndex >= 0 && 
              (items[prevIndex].type === 'separator' || items[prevIndex].type === 'metadata')
            ) {
              prevIndex--;
            }
            return prevIndex >= 0 ? prevIndex : prev;
          });
          break;
        case 'Enter':
          e.preventDefault();
          if (activeItemIndex >= 0 && activeItemIndex < items.length) {
            const item = items[activeItemIndex];
            if (!item.disabled && item.onClick) {
              item.onClick();
              onClose();
            }
          }
          break;
      }
    };
    
    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [visible, onClose, items, activeItemIndex]);
  
  // Render menu items recursively to support sub-menus
  const renderMenuItem = useCallback((item: ContextMenuItem, index: number) => {
    // Render separator if specified
    if (item.type === 'separator') {
      return <ContextMenuSeparator key={`separator-${index}`} />;
    }
    
    // Render metadata item with special styling
    if (item.type === 'metadata') {
      return (
        <li 
          key={item.id} 
          className="context-menu-item metadata"
        >
          {item.icon && <span className="context-menu-item-icon">{item.icon}</span>}
          <span className="context-menu-item-label">{item.label}</span>
          {item.shortcut && (
            <span className="context-menu-item-shortcut">{item.shortcut}</span>
          )}
        </li>
      );
    }
    
    const handleClick = () => {
      if (!item.disabled && item.onClick) {
        item.onClick();
        onClose();
      }
    };
    
    const isActive = index === activeItemIndex;
    
    return (
      <li 
        key={item.id} 
        className={`context-menu-item ${item.disabled ? 'disabled' : ''} ${item.danger ? 'danger' : ''} ${isActive ? 'active' : ''}`}
        onClick={handleClick}
        onMouseEnter={() => setActiveItemIndex(index)}
      >
        {item.icon && <span className="context-menu-item-icon">{item.icon}</span>}
        <span className="context-menu-item-label">{item.label}</span>
        
        {/* Display keyboard shortcut if provided */}
        {item.shortcut && (
          <span className="context-menu-item-shortcut">{item.shortcut}</span>
        )}
        
        {item.children && item.children.length > 0 && (
          <span className="context-menu-item-arrow">▶</span>
        )}
        
        {/* Render sub-menu if this item has children */}
        {item.children && item.children.length > 0 && isActive && (
          <ul className="context-submenu">
            {item.children.map((child, childIndex) => renderMenuItem(child, childIndex))}
          </ul>
        )}
      </li>
    );
  }, [onClose, activeItemIndex]);
  
  if (!visible) return null;
  
  return (
    <div 
      ref={menuRef}
      className={`context-menu ${className}`}
      style={{ 
        left: `${position.x}px`, 
        top: `${position.y}px`,
        display: visible ? 'block' : 'none'
      }}
    >
      <ul className="context-menu-list">
        {items.map((item, index) => renderMenuItem(item, index))}
      </ul>
    </div>
  );
};

/**
 * Helper function to create a separator item
 */
export const createSeparator = (id?: string): ContextMenuItem => ({
  id: id || `separator-${Math.random().toString(36).substr(2, 9)}`,
  label: '',
  type: 'separator'
});

/**
 * Helper function to create a metadata item
 * @param label The text label to display
 * @param id Optional ID for the item
 * @param icon Optional icon to display
 */
export const createMetadata = (
  label: string, 
  id?: string,
  icon?: React.ReactNode
): ContextMenuItem => ({
  id: id || `metadata-${Math.random().toString(36).substr(2, 9)}`,
  label,
  icon,
  type: 'metadata'
});

/**
 * Hook for managing a context menu
 * Returns props for the ContextMenu component and methods to show/hide it
 */
export const useContextMenu = () => {
  const [menuProps, setMenuProps] = useState<Omit<ContextMenuProps, 'onClose'>>({
    items: [],
    visible: false,
    x: 0,
    y: 0
  });
  
  const showMenu = useCallback((x: number, y: number, items: ContextMenuItem[]) => {
    setMenuProps({
      items,
      visible: true,
      x,
      y
    });
  }, []);
  
  const hideMenu = useCallback(() => {
    setMenuProps(prev => ({ ...prev, visible: false }));
  }, []);
  
  // Combine props and onClose handler
  const contextMenuProps: ContextMenuProps = {
    ...menuProps,
    onClose: hideMenu
  };
  
  return {
    contextMenuProps,
    showMenu,
    hideMenu
  };
};

export default ContextMenu; 