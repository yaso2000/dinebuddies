import { useCallback, useLayoutEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { APP_HOME_PATH } from '../utils/appRouteShell';

const BACK_TO_HOME_KEY = 'dineb_app_back_to_home';

function consumeBackToHomeFlag() {
  try {
    if (sessionStorage.getItem(BACK_TO_HOME_KEY) === '1') {
      sessionStorage.removeItem(BACK_TO_HOME_KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * App-wide back: previous page in history; after returning via back, next back → fallback (home).
 */
export function useAppBackNavigation({ fallback = APP_HOME_PATH } = {}) {
  const navigate = useNavigate();
  const location = useLocation();

  const [backToHome, setBackToHome] = useState(
    () => Boolean(location.state?.backToHome) || consumeBackToHomeFlag()
  );

  useLayoutEffect(() => {
    setBackToHome(Boolean(location.state?.backToHome) || consumeBackToHomeFlag());
  }, [location.key, location.state?.backToHome]);

  const goBack = useCallback(() => {
    if (backToHome || location.state?.backToHome) {
      navigate(fallback, { replace: true });
      return;
    }
    try {
      sessionStorage.setItem(BACK_TO_HOME_KEY, '1');
    } catch {
      /* ignore */
    }
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback, { replace: true });
    }
  }, [navigate, fallback, backToHome, location.state?.backToHome]);

  return { goBack, backToHome };
}

export { APP_HOME_PATH };
