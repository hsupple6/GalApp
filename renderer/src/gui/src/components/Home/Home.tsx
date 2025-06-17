import './Home.scss';

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { spaceService } from '../../services/spaceService';
import type { UISpace } from '../../types/spaces';

const Home = () => {
  const [spaces, setSpaces] = useState<UISpace[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSpaces = async () => {
      try {
        const fetchedSpaces = await spaceService.fetchRecentSpaces();
        console.log('[Home] fetchedSpaces', fetchedSpaces);
        setSpaces(fetchedSpaces.slice(0, 6)); // Limit to 6 spaces
      } catch (error) {
        console.error('Failed to fetch spaces:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSpaces();
  }, []);

  const handleSpaceClick = (spaceId: string) => {
    navigate(`/spaces/${spaceId}`);
  };

  const handleCreateSpace = async () => {
    // Navigate to /new which will handle the smart space logic
    // (check for recent space first, create new only if needed)
    navigate('/new');
  };

  if (loading) {
    return <div className="home-loading">Loading...</div>;
  }

  return (
    <div className="home-container">
      <h1>Recent Spaces</h1>
      <div className="spaces-grid">
        {spaces.map(space => (
          <div 
            key={space.id} 
            className="space-card"
            onClick={() => handleSpaceClick(space.id)}
          >
            <div className="space-preview">
              {/* LATER: Preview could show miniature version of space contents */}
            </div>
            <div className="space-info">
              <h3>{space.name}</h3>
              <span className="space-date">
                Last opened: {new Date(space.updated ?? Date.now()).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
        {spaces.length < 6 && (
          <div className="space-card create-new" onClick={handleCreateSpace}>
            <div className="create-new-content">
              <span className="plusButton">+</span>
              <span>Create New Space</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;