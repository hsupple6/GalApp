import './ConnecttoBox.css';
import { useState, useEffect } from 'react';

function ConnecttoBox({ onAddGalaxy }) {
  const [galaxy, setGalaxy] = useState('Andromeda'); // change to be auto whatever the boxs name is
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');

  function sendCreds() {
    const credentials = `${ssid},${password}`;
    
    fetch('http://localhost:8484/', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({ credentials: credentials })
    })
    .then(response => response.json())
    .then(data => {
      console.log('Success:', data);
    })
    .catch(error => {
      console.error('Error:', error);
    });
  }

  // Add picture or animation or render of the box in here thatd be sick
  return (
    <div className="box-connect">
      <span className='gradient-text-galaxy'>
        <div className='box-connection-message'>New Galaxy Found: <div>{galaxy}</div></div>
      </span>

      <div className="connection-inputs">
        <div className="input-group">
          <label>SSID:</label>
          <input 
            type="text" 
            value={ssid}
            onChange={(e) => setSsid(e.target.value)}
            placeholder="Enter WiFi SSID"
          />
        </div>
        <div className="input-group">
          <label>Password:</label>
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter WiFi password"
          />
        </div>
        <button onClick={sendCreds} className="send-button">
          Send Credentials
        </button>
      </div>

      <button className='box-connect-button'>Connect</button>
    </div>
  );  
}
export default ConnecttoBox;
