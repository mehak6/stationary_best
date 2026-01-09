import { supabase } from '../supabase_client';

export type SupabaseStatus = 'active' | 'paused' | 'offline' | 'error';

export const checkSupabaseStatus = async (): Promise<SupabaseStatus> => {
  if (!navigator.onLine) {
    return 'offline';
  }

  try {
    // Attempt a lightweight request to check availability
    const { error, status } = await supabase
      .from('products')
      .select('count', { count: 'exact', head: true })
      .limit(1);

    if (error) {
      // Check for 503 Service Unavailable (common for paused projects)
      if (status === 503) {
        return 'paused';
      }

      // Check for specific error messages that might indicate paused state
      if (error.message && (
        error.message.toLowerCase().includes('paused') ||
        error.message.toLowerCase().includes('unavailable')
      )) {
        return 'paused';
      }

      console.error('Supabase status check failed:', error);
      return 'error';
    }

    return 'active';
  } catch (err: any) {
    console.error('Unexpected error checking Supabase status:', err);
    return 'error';
  }
};
