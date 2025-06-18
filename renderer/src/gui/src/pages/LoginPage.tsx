import React, { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import styles from '../components/Redirect/Redirect.module.scss';

const LoginPage = () => {
  const { loginWithPopup, isAuthenticated, isLoading, user, error } = useAuth0();
  const navigate = useNavigate();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    // If user is already authenticated, redirect to /new
    if (isAuthenticated) {
      navigate('/new');
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async () => {
    try {
      setIsLoggingIn(true);
      setLoginError(null);
      await loginWithPopup({
        authorizationParams: {
          screen_hint: 'login',
        },
      });
    } catch (err: any) {
      console.error('Login error:', err);
      setLoginError(err.message || 'An error occurred during login');
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.redirectContainer}>
        <div className={styles.redirectWrapper}>
          <div className={styles.welcome}>
            <div className={styles.logoContainer}>
              <img src="/logo.svg" alt="Bedrock Logo" className={styles.logo} />
            </div>
            <span className={styles.welcomeText}>Loading...</span>
          </div>
          <div className={styles.redirectContent}>
            <p>Checking authentication status...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className={styles.redirectContainer}>
        <div className={styles.redirectWrapper}>
          <div className={styles.welcome}>
            <div className={styles.logoContainer}>
              <img src="/logo.svg" alt="Bedrock Logo" className={styles.logo} />
            </div>
            <span className={styles.welcomeText}>Welcome, {user.name}!</span>
          </div>
          <div className={styles.redirectContent}>
            <p>Redirecting to application...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.redirectContainer}>
      <div className={styles.redirectWrapper}>
        <div className={styles.welcome}>
          <div className={styles.logoContainer}>
            <img src="/logo.svg" alt="Bedrock Logo" className={styles.logo} />
          </div>
          <span className={styles.welcomeText}>Welcome to Bedrock</span>
        </div>

        <div className={styles.redirectContent}>
          <p>Please sign in to continue</p>
          {(loginError || error) && (
            <p className={styles.errorMessage}>
              {loginError || error?.message || 'An error occurred'}
            </p>
          )}
        </div>

        <div className={styles.buttonContainer}>
          <button 
            onClick={handleLogin} 
            className={styles.redirectButton}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? 'Signing In...' : 'Sign In with Auth0'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
