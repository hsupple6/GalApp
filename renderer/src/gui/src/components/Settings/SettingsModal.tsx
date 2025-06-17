import './SettingsModal.scss';

import { useState } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'integrations' | 'account'>('integrations');

  if (!isOpen) return null;

  return (
    <div className="settings-modal">
      {/* Header */}
      <div className="settings-modal__header">
        <h3>Settings</h3>
        <button onClick={onClose} className="close-button">✕</button>
      </div>

      {/* Tabs */}
      <div className="settings-modal__tabs">
        <button
          onClick={() => setActiveTab('integrations')}
          className={`tab ${activeTab === 'integrations' ? 'active' : ''}`}
        >
          Integrations
        </button>
        <button
          onClick={() => setActiveTab('account')}
          className={`tab ${activeTab === 'account' ? 'active' : ''}`}
        >
          Account
        </button>
      </div>

      {/* Content */}
      <div className="settings-modal__content">
        {activeTab === 'integrations' && (
          <div className="integrations-list">
            {/* Gmail */}
            <div className="integration-item">
              <div className="integration-info">
                <span className="integration-icon">📧</span>
                <div className="integration-details">
                  <h4>Gmail</h4>
                  <p>Connect your Gmail account</p>
                </div>
              </div>
              <button className="add-button">Add</button>
            </div>

            {/* Apple Notes */}
            <div className="integration-item">
              <div className="integration-info">
                <span className="integration-icon">📝</span>
                <div className="integration-details">
                  <h4>Apple Notes</h4>
                  <p>Sync your Apple Notes</p>
                </div>
              </div>
              <button className="add-button">Add</button>
            </div>
          </div>
        )}

        {activeTab === 'account' && (
          <div className="account-settings">
            <p>Account settings coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
} 