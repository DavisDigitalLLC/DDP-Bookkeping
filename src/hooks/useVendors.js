import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './useAuth';

export function useVendors() {
  const { user } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('vendors')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('vendor_name');
    setVendors(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  /** Looks up a vendor by exact name (case-insensitive), creating it if it doesn't exist yet. */
  const getOrCreateVendor = useCallback(
    async (vendorName) => {
      const trimmed = vendorName.trim();
      if (!trimmed) return null;

      const existing = vendors.find((v) => v.vendor_name.toLowerCase() === trimmed.toLowerCase());
      if (existing) return existing;

      const { data, error } = await supabase
        .from('vendors')
        .insert({ user_id: user.id, vendor_name: trimmed })
        .select()
        .single();
      if (error) {
        // Unique-constraint race: another tab/request just created the same vendor -- fetch it instead.
        if (error.code === '23505') {
          const { data: found, error: findError } = await supabase
            .from('vendors')
            .select('*')
            .eq('user_id', user.id)
            .ilike('vendor_name', trimmed)
            .single();
          if (findError) throw findError;
          await refetch();
          return found;
        }
        throw error;
      }
      await refetch();
      return data;
    },
    [user, vendors, refetch]
  );

  return { vendors, loading, refetch, getOrCreateVendor };
}
