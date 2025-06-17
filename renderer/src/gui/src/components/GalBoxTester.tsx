import React, { useState, useEffect } from 'react';
import { testGalBoxServer } from '../hooks/useGalBoxTest';
import { useGalBoxServer } from '../hooks/useGalBoxServer';

const GalBoxTester: React.FC = () => {
  const { serverStatus } = useGalBoxServer();
  const [testResults, setTestResults] = useState<any>(null);
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [modelToTest, setModelToTest] = useState('');
  
  const runTests = async () => {
    if (!serverStatus.online) return;
    
    setIsRunningTest(true);
    try {
      const results = await testGalBoxServer(serverStatus.address, modelToTest || undefined);
      setTestResults(results);
    } catch (error) {
      console.error('Test error:', error);
      setTestResults({ error: true, message: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsRunningTest(false);
    }
  };
  
  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>GalBox API Tester</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <div>
          <strong>Server Status:</strong> 
          <span style={{ 
            color: serverStatus.online ? '#00c853' : '#ff3d00',
            marginLeft: '8px'
          }}>
            {serverStatus.online ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
        
        {serverStatus.online && (
          <>
            <div><strong>Address:</strong> {serverStatus.address}</div>
            <div><strong>Ollama Version:</strong> {serverStatus.ollamaVersion || 'Unknown'}</div>
          </>
        )}
      </div>
      
      {serverStatus.online && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '10px' }}>
            <label>
              Model to test (leave empty for auto):
              <input 
                type="text" 
                value={modelToTest} 
                onChange={(e) => setModelToTest(e.target.value)}
                placeholder="E.g. llama2"
                style={{ marginLeft: '10px', padding: '5px' }}
              />
            </label>
          </div>
          
          <button 
            onClick={runTests} 
            disabled={isRunningTest}
            style={{
              padding: '8px 16px',
              backgroundColor: '#4291ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isRunningTest ? 'not-allowed' : 'pointer',
              opacity: isRunningTest ? 0.7 : 1
            }}
          >
            {isRunningTest ? 'Running Tests...' : 'Run API Tests'}
          </button>
        </div>
      )}
      
      {testResults && (
        <div style={{ 
          backgroundColor: '#f5f5f5', 
          padding: '15px',
          borderRadius: '5px',
          border: '1px solid #ddd'
        }}>
          <h3>Test Results</h3>
          
          {testResults.error ? (
            <div style={{ color: '#d32f2f' }}>
              <strong>Error:</strong> {testResults.message}
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '15px' }}>
                <h4>Health Check</h4>
                <div>Status: {testResults.health.success ? 'Success' : 'Failed'}</div>
                {testResults.health.success ? (
                  <div>Server Status: {testResults.health.status}</div>
                ) : (
                  <div style={{ color: '#d32f2f' }}>Error: {testResults.health.error}</div>
                )}
              </div>
              
              {testResults.models && (
                <div style={{ marginBottom: '15px' }}>
                  <h4>Models Check</h4>
                  <div>Status: {testResults.models.success ? 'Success' : 'Failed'}</div>
                  {testResults.models.success ? (
                    <div>
                      <div>Available Models: {testResults.models.models.length}</div>
                      <ul>
                        {testResults.models.models.map((model: any) => (
                          <li key={model.name}>{model.name}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div style={{ color: '#d32f2f' }}>Error: {testResults.models.error}</div>
                  )}
                </div>
              )}
              
              {testResults.modelTest && (
                <div>
                  <h4>Model Test</h4>
                  <div>Status: {testResults.modelTest.success ? 'Success' : 'Failed'}</div>
                  {testResults.modelTest.success ? (
                    <div>
                      <div>Response Time: {testResults.modelTest.responseTime}ms</div>
                      <div style={{ marginTop: '10px' }}>
                        <strong>Response:</strong>
                        <div style={{ 
                          backgroundColor: '#fff',
                          padding: '10px', 
                          borderRadius: '4px',
                          border: '1px solid #ddd',
                          marginTop: '5px'
                        }}>
                          {testResults.modelTest.response}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: '#d32f2f' }}>Error: {testResults.modelTest.error}</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default GalBoxTester; 