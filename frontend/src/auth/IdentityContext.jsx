import { createContext, useContext, useEffect, useState } from 'react';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { getCurrentUser } from '../api/client';

const IdentityContext = createContext({ account: null, profile: null, loading: false });

export function IdentityProvider({ children }) {
  const { accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!isAuthenticated) {
      setProfile(null);
      return undefined;
    }

    setLoading(true);
    getCurrentUser()
      .then((value) => {
        if (active) setProfile(value);
      })
      .catch(() => {
        if (active) setProfile(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  return <IdentityContext.Provider value={{ account: accounts[0] || null, profile, loading }}>{children}</IdentityContext.Provider>;
}

export function useIdentity() {
  return useContext(IdentityContext);
}
