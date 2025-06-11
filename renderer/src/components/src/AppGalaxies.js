import './AppGalaxies.css';
import { useState, useEffect } from 'react';

function AppGalaxies({ onAddGalaxy }) {
  const [isOne, setisOne] = useState(false);

  return (
    <div className="app-galaxies-body">
      {!isOne ? 
      (
        <>
        <div className='no-galaxies'>
          <span className='gradient-text-no-galaxy'>You have no Galaxies! Add one using the button below and get Innovating!
          </span>
        </div>
        </>
      ) 
      : 
      ""}
      <button className='add-galaxy' onClick={onAddGalaxy}>
        <div className='cross1'></div>
        <div className='cross1' style= {{transform: "rotate(90deg)"}}></div>
      </button>
    </div>
  );  
}
export default AppGalaxies;
