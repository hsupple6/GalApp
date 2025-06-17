import './AppGalaxies.css';
import { useState, useEffect } from 'react';

function AppGalaxies({onAddGalaxy, onAddGalaxyIP }) {
  const [galaxies, setGalaxies] = useState([]);
  window.electronAPI.getGalaxies().then(galaxies => {
    if (typeof galaxies === 'string') {
      try {
        galaxies = JSON.parse(galaxies);
      } catch {
        galaxies = [];
      }
    }
    setGalaxies(Array.isArray(galaxies) ? galaxies : []);
  });
  return (
    <div className="app-galaxies-body">
      {galaxies.length === 0 ? (
        <div className='no-galaxies'>
          <span className='gradient-text-no-galaxy'>You have no Galaxies! Add one using the button below and get Innovating!</span>
        </div>
      ) : (
        <>
          {galaxies.map((Galaxy, idx) => (
            Galaxy.ip && Galaxy.galID ? (
            <li key={idx}>{Galaxy.ip} {Galaxy.galID}</li>) : ""
          ))}
        </>
      )}
      <button className='add-galaxy' onClick={onAddGalaxy}>
        <div className='cross1'></div>
        <div className='cross1' style={{ transform: "rotate(90deg)" }}></div>
      </button>
    </div>
  );
}
export default AppGalaxies;
