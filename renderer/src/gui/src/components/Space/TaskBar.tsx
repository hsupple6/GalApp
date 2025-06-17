import './TaskBar.scss';

import React from 'react';

import { useAppRegistryStore } from '../../stores/appRegistryStore';
import { useDockStore } from '../../stores/dockStore';

interface TaskBarProps {
  onOpenApp: (appId: string) => void;
  onCreateBlankWindow: () => void;
}

const TaskBar: React.FC<TaskBarProps> = ({ onOpenApp, onCreateBlankWindow }) => {
  const apps = useAppRegistryStore(state => state.apps);
  const { preferences } = useDockStore();

  // Get installed apps and sort them by a predefined order
  const taskbarApps = Object.values(apps).sort((a, b) => {
    const order: Record<string, number> = {
      'chat': 1,
      'EntityBrowserApp': 2,
      'ConsoleApp': 3,
      'browser': 4,
      'webdocument': 5,
      'pdfium': 6,
      'notes': 7,
      'personalModels': 8,
      'settings': 9,
      'finder': 10,
      'docs': 11,
    };
    return (order[a.skeleton.appId] || 99) - (order[b.skeleton.appId] || 99);
  });

  return (
    <div className="taskbar">
      {taskbarApps.map(app => (
        <button 
          key={app.skeleton.appId}
          className="appButton" 
          onClick={() => onOpenApp(app.skeleton.appId)}
          title={app.skeleton.name}
        >
          {app.skeleton.icon || app.skeleton.name}
        </button>
      ))}
      <button className="appButton plus" onClick={onCreateBlankWindow}>
        <span className="plus-icon">+</span>
      </button>
    </div>
  );
};

export default TaskBar;
