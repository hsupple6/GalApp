import './App.css';
import logo from './png/galOS.png';

import AppBody from './components/AppBody';

function App() {
  return (
    <div className="App">
      <img src={logo} alt="logo" style = {{height: '10%', aspectRatio: '1/1', left: '0', top: '0', position: 'absolute'}} />
      <div className="app-header">
        <div className="app-header-title">
          <span className="gradient-text">G a l O S</span>
        </div>
      </div>
      <AppBody />
      
    </div>
  );
}

export default App;

