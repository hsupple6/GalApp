import React, { useState, useEffect } from 'react';
import { useDockStore } from '../../../stores/dockStore';
import { useAppRegistryStore } from '../../../stores/appRegistryStore';
import { userService, UserProfile, UserProfileUpdate } from '../../../services/userService';
import './AccountTab.scss';

const AccountTab: React.FC = () => {
  const { preferences, setAppOrder, toggleAppVisibility, resetPreferences, syncWithAvailableApps } = useDockStore();
  const apps = useAppRegistryStore(state => state.apps);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      setIsLoading(true);
      const profile = await userService.getUserProfile();
      setUserProfile(profile);
      setEditedName(profile.skeleton.name || '');
    } catch (err) {
      setError('Failed to load user profile');
      console.error('Error fetching user profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!userProfile) return;
    
    try {
      const updated = await userService.updateUserProfile({
        name: editedName
      });
      
      // Force React to re-render by creating a new object
      setUserProfile({ ...updated });
      setIsEditing(false);
      
      // Force a fresh fetch to ensure we have the latest data
      await fetchUserProfile();
    } catch (err) {
      setError('Failed to update name');
      console.error('Error updating name:', err);
    }
  };

  // Sync dock preferences with available apps when component mounts
  useEffect(() => {
    syncWithAvailableApps();
  }, [syncWithAvailableApps]);

  const handleDragStart = (appId: string) => {
    setIsDragging(appId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetAppId: string) => {
    if (!isDragging || isDragging === targetAppId) return;

    const newOrder = [...preferences.appOrder];
    const dragIndex = newOrder.indexOf(isDragging);
    const dropIndex = newOrder.indexOf(targetAppId);

    newOrder.splice(dragIndex, 1);
    newOrder.splice(dropIndex, 0, isDragging);

    setAppOrder(newOrder);
    setIsDragging(null);
  };

  const handleDragEnd = () => {
    setIsDragging(null);
  };

  return (
    <div className="account-settings">
      {/* User Profile Section */}
      <section className="user-profile">
        <h3>Profile</h3>
        {isLoading ? (
          <div className="loading">Loading profile...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : userProfile ? (
          <div className="profile-content">
            <div className="profile-header">
              {userProfile.skeleton.auth0?.picture && (
                <img 
                  src={userProfile.skeleton.auth0.picture} 
                  alt="Profile" 
                  className="profile-picture"
                />
              )}
              <div className="profile-info">
                <div className="name-section">
                  {isEditing ? (
                    <div className="edit-name-inline">
                      <input
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className="name-input"
                        placeholder="Enter your name"
                      />
                      <button onClick={handleSaveName} className="save-button">
                        Save
                      </button>
                      <button onClick={() => {
                        setIsEditing(false);
                        setEditedName(userProfile.skeleton.name || '');
                      }} className="cancel-button">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="display-name">
                      <span className="name">
                        {userProfile.skeleton.name || 'No name set'}
                      </span>
                      <button 
                        onClick={() => setIsEditing(true)} 
                        className="edit-button"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
                <div className="email">
                  {userProfile.skeleton.auth0?.email}
                  {userProfile.skeleton.auth0?.email_verified && (
                    <span className="verified-badge">✓</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {/* Existing Dock Preferences Section */}
      <section className="dock-preferences">
        <h3>Dock Preferences</h3>
        <div className="dock-apps">
          {preferences.appOrder.map((appId) => {
            const app = apps[appId];
            if (!app) return null;

            return (
              <div
                key={appId}
                className={`dock-app-item ${isDragging === appId ? 'dragging' : ''}`}
                draggable
                onDragStart={() => handleDragStart(appId)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(appId)}
                onDragEnd={handleDragEnd}
              >
                {/* <div className="app-icon">{app.skeleton.icon || app.skeleton.name}</div> */}
                <div className="app-name">{app.skeleton.name}</div>
                <button
                  className={`visibility-toggle ${preferences.hiddenApps.includes(appId) ? 'hidden' : ''}`}
                  onClick={() => toggleAppVisibility(appId)}
                >
                  {preferences.hiddenApps.includes(appId) ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            );
          })}
        </div>
        <button className="reset-button" onClick={resetPreferences}>
          Reset to Default
        </button>
      </section>
    </div>
  );
};

export default AccountTab; 