/**
 * Simple test utility to validate GalBox server functionality
 */

// Function to check API health
export async function checkGalBoxHealth(address: string) {
  try {
    const response = await fetch(`http://${address}:3001/health`);
    
    if (!response.ok) {
      throw new Error(`Health check failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      success: true,
      data,
      status: data.status,
      ollama: data.ollama
    };
  } catch (error) {
    console.error('[GalBoxTest] Health check failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Function to list available models
export async function listGalBoxModels(address: string) {
  try {
    const response = await fetch(`http://${address}:3001/models`);
    
    if (!response.ok) {
      throw new Error(`Models check failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      success: true,
      data,
      models: data.models || []
    };
  } catch (error) {
    console.error('[GalBoxTest] Models check failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Function to test running a model
export async function testGalBoxModel(address: string, model: string) {
  try {
    console.log(`[GalBoxTest] Testing model ${model} at http://${address}:3001/run-model`);
    
    const startTime = Date.now();
    
    const response = await fetch(`http://${address}:3001/run-model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: 'Hello, respond with a short greeting.'
      })
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`[GalBoxTest] Model test response received in ${responseTime}ms`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Model test failed with status: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('[GalBoxTest] Model test response:', data);
    
    return {
      success: true,
      data,
      response: data.response,
      responseTime
    };
  } catch (error) {
    console.error('[GalBoxTest] Model test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Run all tests in sequence
export async function testGalBoxServer(address: string, modelToTest?: string) {
  const results = {
    health: await checkGalBoxHealth(address),
    models: null as any,
    modelTest: null as any
  };
  
  // Only continue if health check passed
  if (results.health.success) {
    results.models = await listGalBoxModels(address);
    
    // Only test a model if we have models available
    if (results.models.success && results.models.models.length > 0) {
      // Use the specified model or the first available model
      const testModel = modelToTest || results.models.models[0].name;
      results.modelTest = await testGalBoxModel(address, testModel);
    }
  }
  
  return results;
} 