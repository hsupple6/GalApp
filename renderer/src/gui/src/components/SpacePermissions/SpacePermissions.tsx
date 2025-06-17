import React, { useState, useEffect } from 'react';
import { FiX, FiUserPlus, FiUsers, FiShield, FiEye, FiEdit2, FiMessageSquare, FiLink } from 'react-icons/fi';
import { spaceService } from '../../services/spaceService';
import { userService, UserProfile } from '../../services/userService';
import { ACLEntryWithUser } from '../../types/spaces';
import { useSpaceStore } from '../../stores/spaceStore';
import './SpacePermissions.scss';

interface SpacePermissionsProps {
  spaceId: string;
  onClose: () => void;
}

const roleIcons = {
  owner: FiShield,
  editor: FiEdit2,
  viewer: FiEye,
  commenter: FiMessageSquare,
};

const roleLabels = {
  owner: 'Owner',
  editor: 'Editor',
  viewer: 'Viewer',
  commenter: 'Commenter',
};

export const SpacePermissions: React.FC<SpacePermissionsProps> = ({ spaceId, onClose }) => {
  // Get ACL data from spaceStore (instant, no API call needed)
  const spaceAcl = useSpaceStore(state => state.activeSpace?.acl || []);
  const spaceName = useSpaceStore(state => state.activeSpace?.name);
  
  const [userDetails, setUserDetails] = useState<Record<string, UserProfile>>({});
  const [loadingUserDetails, setLoadingUserDetails] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer' | 'commenter'>('editor');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    loadUserDetails();
  }, [spaceAcl]);

  const loadUserDetails = async () => {
    try {
      setLoadingUserDetails(true);
      
      if (spaceAcl.length === 0) {
        setLoadingUserDetails(false);
        return;
      }

      // Get all unique auth0 IDs from ACL
      const auth0Ids = [...new Set(spaceAcl.map(entry => entry.subject))];
      
      // Bulk load user details (single API call instead of N+1)
      const users = await userService.getUsersBulk(auth0Ids);
      
      // Create lookup map
      const userMap: Record<string, UserProfile> = {};
      users.forEach(user => {
        userMap[user.auth0Id] = user;
      });
      
      setUserDetails(userMap);
    } catch (err) {
      console.error('Error loading user details:', err);
      setError('Failed to load user details');
    } finally {
      setLoadingUserDetails(false);
    }
  };

  // Combine ACL data with user details
  const permissions: ACLEntryWithUser[] = spaceAcl.map(aclEntry => {
    const user = userDetails[aclEntry.subject];
    return {
      ...aclEntry,
      auth0Id: aclEntry.subject,
      user: {
        email: user?.skeleton?.auth0?.email || aclEntry.subject,
        name: user?.skeleton?.name || user?.skeleton?.auth0?.name,
        picture: user?.skeleton?.auth0?.picture
      }
    };
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setInviting(true);
    setError(null);

    try {
      await spaceService.addPermission(spaceId, inviteEmail, inviteRole);
      setInviteEmail('');
      
      // Refresh space data to get updated ACL
      const updatedSpace = await spaceService.fetchSpace(spaceId);
      if (updatedSpace) {
        // Update spaceStore with new ACL data
        const spaceStore = useSpaceStore.getState();
        spaceStore.initialize(spaceId);
      }
    } catch (err: any) {
      console.error('Error inviting user:', err);
      if (err.message?.includes('404')) {
        setError('User not found. They need to sign up first.');
      } else if (err.message?.includes('403')) {
        setError('You do not have permission to share this space.');
      } else {
        setError('Failed to invite user');
      }
    } finally {
      setInviting(false);
    }
  };

  const handleRemovePermission = async (userAuth0Id: string) => {
    if (!window.confirm('Are you sure you want to remove this user\'s access?')) return;

    try {
      await spaceService.removePermission(spaceId, userAuth0Id);
      
      // Refresh space data to get updated ACL
      const updatedSpace = await spaceService.fetchSpace(spaceId);
      if (updatedSpace) {
        // Update spaceStore with new ACL data  
        const spaceStore = useSpaceStore.getState();
        spaceStore.initialize(spaceId);
      }
    } catch (err) {
      console.error('Error removing permission:', err);
      setError('Failed to remove permission');
    }
  };

  const currentUserIsOwner = permissions.some(p => p.role === 'owner');

  const handleCopyLink = async () => {
    const shareableLink = `${window.location.origin}/spaces/${spaceId}`;
    try {
      await navigator.clipboard.writeText(shareableLink);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
      setError('Failed to copy link');
    }
  };

  return (
    <div className="space-permissions-overlay">
      <div className="space-permissions-modal">
        {/* Header */}
        <div className="space-permissions-header">
          <div className="header-content">
            <FiUsers className="header-icon" />
            <div className="header-text">
              <h2>Share <span className="space-name-gradient">{spaceName}</span></h2>
              <p>Manage who has access to this space</p>
            </div>
          </div>
          <button onClick={onClose} className="close-button">
            <FiX />
          </button>
        </div>

        {/* Content */}
        <div className="space-permissions-content">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Copy Link Button */}
          <div className="copy-link-section">
            <button
              onClick={handleCopyLink}
              className="copy-link-button"
              title="Copy shareable link"
            >
              <FiLink />
              {copySuccess ? 'Copied!' : 'Copy Link'}
            </button>
          </div>

          {/* Invite Form */}
          <form onSubmit={handleInvite} className="invite-form">
            <div className="form-row">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Enter email address"
                className="email-input"
                disabled={inviting}
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
                className="role-select"
                disabled={inviting}
              >
                <option value="editor">Can edit</option>
                <option value="viewer">Can view</option>
                <option value="commenter">Can comment</option>
              </select>
              <button
                type="submit"
                disabled={inviting || !inviteEmail}
                className="invite-button"
              >
                <FiUserPlus />
                Invite
              </button>
            </div>
          </form>

          {/* Permissions List */}
          <div className="permissions-list">
            <h3 className="list-header">People with access</h3>
            
            {permissions.length === 0 ? (
              <div className="empty-state">No users have access</div>
            ) : (
              permissions.map((permission) => {
                const RoleIcon = roleIcons[permission.role];
                const isOwner = permission.role === 'owner';
                const showingUserDetails = !loadingUserDetails || userDetails[permission.auth0Id];
                
                return (
                  <div key={permission.auth0Id} className="permission-item">
                    <div className="user-info">
                      {showingUserDetails && permission.user.picture ? (
                        <img
                          src={permission.user.picture}
                          alt={permission.user.name || 'User'}
                          className="user-avatar"
                        />
                      ) : (
                        <div className="avatar-placeholder">
                          <FiUsers />
                        </div>
                      )}
                      <div className="user-details">
                        <div className="user-name">
                          {showingUserDetails 
                            ? (permission.user.name || permission.user.email || 'Unknown User')
                            : (loadingUserDetails ? 'Loading...' : permission.auth0Id)
                          }
                        </div>
                        {showingUserDetails && permission.user.email && (
                          <div className="user-email">
                            {permission.user.email}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="permission-actions">
                      <div className="role-badge">
                        <RoleIcon />
                        <span>{roleLabels[permission.role]}</span>
                      </div>
                      
                      {!isOwner && currentUserIsOwner && (
                        <button
                          onClick={() => handleRemovePermission(permission.auth0Id)}
                          className="remove-button"
                          title="Remove access"
                        >
                          <FiX />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 