import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { fetchDrilldownOptions } from '../lib/trendsEngine';

export function useDrilldownOptions() {
  const { user } = useAuth();
  const [options, setOptions] = useState({ serviceLines: [], departments: [], products: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const data = await fetchDrilldownOptions(user.id);
      setOptions(data);
      setLoading(false);
    })();
  }, [user]);

  return { ...options, loading };
}
