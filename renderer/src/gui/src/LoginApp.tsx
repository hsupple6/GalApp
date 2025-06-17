import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from './api/config';
import fetchService from './services/fetchService';

const LoginApp = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const response = await fetchService(`${API_BASE_URL}/login_app`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('authToken', data.access_token);

        // Check for a redirect URL and navigate to it
        const redirectTo = localStorage.getItem('redirectAfterLogin') || '/app/chat'; // Default to chat
        localStorage.removeItem('redirectAfterLogin'); // Clear the stored URL
        navigate(redirectTo); // Redirect to the saved URL or a default page
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred');
    }
  };

  return (
    <div>
      <h1>Login to Access Chat</h1>
      <form onSubmit={handleLogin}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Log In</button>
      </form>
      {error && <p>{error}</p>}

      {/*<a href="http://localhost:3001/signup" target="_blank" rel="noopener noreferrer">*/}
      {/*  Sign Up!*/}
      {/*</a>*/}
    </div>
  );
};

export default LoginApp;
