import React, { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './Redirect.module.scss';

interface Props {
  loginWithRedirectOpts: any;
  description: string;
}

const Redirect = ({ loginWithRedirectOpts, description }: Props) => {
  const { loginWithRedirect, isAuthenticated, getAccessTokenSilently } = useAuth0();
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If user is already authenticated, redirect to /new
    if (isAuthenticated) {
      // Get the returnTo path from appState if it exists
      const params = new URLSearchParams(location.search);
      const state = params.get('state');
      if (state) {
        try {
          const decodedState = JSON.parse(atob(state));
          if (decodedState.returnTo) {
            navigate(decodedState.returnTo);
            return;
          }
        } catch (e) {
          console.error('Error parsing state:', e);
        }
      }
      // Default to /new if no returnTo path
      navigate('/new');
      return;
    }

    // Check for error parameters in URL
    const params = new URLSearchParams(location.search);
    const errorParam = params.get('error');
    const errorDescription = params.get('error_description');

    if (errorParam) {
      // Decode the error description if it exists
      const decodedError = errorDescription ? decodeURIComponent(errorDescription) : 'An error occurred';
      setError(decodedError);
      return;
    }

    if (!isAuthenticated && !errorParam) {
      loginWithRedirect(loginWithRedirectOpts);
    }
  }, [isAuthenticated, location, navigate, loginWithRedirect]);

  const handleAction = () => {
    loginWithRedirect(loginWithRedirectOpts);
  };

  if (error) {
    return (
      <div className={styles.redirectContainer}>
        <div className={styles.redirectWrapper}>
          <div className={styles.welcome}>
            <div className={styles.logoContainer}>
              <img src="/logo.svg" alt="Bedrock Logo" className={styles.logo} />
            </div>
            <span className={styles.welcomeText}>Error</span>
          </div>

          <div className={styles.redirectContent}>
            <p className={styles.errorMessage}>{error}</p>
            <p>Please try again or contact support if the problem persists.</p>
          </div>

          <div className={styles.buttonContainer}>
            <button onClick={handleAction} className={styles.redirectButton}>
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state while redirecting
  return (
    <div className={styles.redirectContainer}>
      <div className={styles.redirectWrapper}>
        <div className={styles.welcome}>
          <div className={styles.logoContainer}>
            <img src="/logo.svg" alt="Bedrock Logo" className={styles.logo} />
          </div>
          <span className={styles.welcomeText}>Redirecting...</span>
        </div>

        <div className={styles.redirectContent}>
          <p>{description}</p>
        </div>
      </div>
    </div>
  );
};

export default Redirect;
