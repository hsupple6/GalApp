import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import styles from './LandingPage.module.scss';

const PlanetDots: React.FC = () => {
  return (
    <div className={styles.planetContainer}>
      <div className={styles.planet} />
      <div className={styles.planet} />
      <div className={styles.planet} />
      <div className={styles.planet} />
      <div className={styles.comet} />
    </div>
  );
};

const LandingPage: React.FC = () => {
  const { isAuthenticated, logout } = useAuth0();
  const navigate = useNavigate();

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (window.location.pathname === '/login' || window.location.pathname === '/signup') {
        navigate(window.location.pathname);
      }
    }, 2000);

    return () => {
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className={styles.homeContainer}>
      <PlanetDots />
      <div className={styles.heroPictureX} />
      <div className={styles.mainWrapper}>
        <div className={styles.heroWrapper}>
          <div className={styles.welcome}>
            <div className={styles.logoContainer}>
              <img
                src="/logo.svg"
                alt="Bedrock Logo"
                className={styles.logo}
                style={{ width: '50px', height: '50px' }}
              />
            </div>
            <span className={styles.welcomeText}>Welcome to GalOS</span>
          </div>

          <div className={styles.heroText}>
            {`We're building a personal computer.
It's web-integrated, Ai-augmented,
& owned by you.

Imagine a revolutionary new environment.
You and your Ai, equipped with a suite of modern tools designed to help you navigate the overwhelming chaos of modernity.
Serene power, creative flow,
& confident control.

The 1970s gave us "Bicycles for the Mind".
Now is the era of Spaceships for the Mind.

`}
            <span className={styles.lastLine}>
              Here's to the <span className={styles.jiggle1}>really</span> <span className={styles.jiggle2}>crazy</span>{' '}
              <span className={styles.jiggle3}>ones</span>.
            </span>
          </div>

          <div className={styles.buttonContainer}>
            {isAuthenticated ? (
              <>
                <div className={styles.buttonWrapper}>
                  <Link to="/new">
                    <button className={styles.homeButton}>
                      <span>Open galOS</span>
                    </button>
                  </Link>
                </div>
                <button
                  onClick={() =>
                    logout({
                      logoutParams: {
                        returnTo: window.location.origin,
                      },
                    })
                  }
                  className={styles.logoutLink}
                >
                  log out
                </button>
              </>
            ) : (
              <>
                {window.location.hostname !== 'bedrock.computer' ? (
                  <div className={styles.buttonWrapper}>
                    <Link to="/signup">
                      <button className={styles.homeButton}>
                        <span>Sign Up</span>
                      </button>
                    </Link>
                  </div>
                ) : null}

                <div className={styles.buttonWrapper}>
                  <Link to="/login">
                    <button className={styles.homeButton}>
                      <span>Log in</span>
                    </button>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
