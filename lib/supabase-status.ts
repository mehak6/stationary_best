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

/**
 * Attempts to wake up a paused Supabase project by making a simple request.
 * Returns true if the project is responsive (not returning 503).
 */
export const resumeSupabase = async (): Promise<boolean> => {
  try {
    console.log('Attempting to resume Supabase project...');
    
    // Attempt a lightweight request to trigger wake-up
    const { error, status } = await supabase
      .from('products')
      .select('id')
      .limit(1);
    
    if (error) {
      if (status === 503) {
        console.warn('Supabase is still waking up (503)...');
        return false;
      }
      // If it's a different error, the project is at least responsive
      console.log('Supabase responded with error (not 503), project is awake:', error.message);
      return true;
    }

    console.log('Supabase project resumed successfully!');
    return true;
  } catch (err) {
    console.error('Error during Supabase resume attempt:', err);
    return false;
  }
};
