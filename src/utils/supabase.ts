import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      'X-Client-Info': 'song-request-app/1.0.0',
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 5,
    },
  },
});

// Helper function to handle Supabase errors
export function handleSupabaseError(error: any): never {
  console.error('Supabase error:', error);
  const errorMessage = error?.message || error?.error_description || 'Database operation failed';
  throw new Error(errorMessage);
}

// Execute a database operation with proper error handling
export async function executeDbOperation<T>(
  operationKey: string,
  operation: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  try {
    // Check network status first
    if (!navigator.onLine) {
      throw new Error('No network connection available');
    }

    // Add abort signal to operation context if provided
    if (signal) {
      // Check if already aborted
      if (signal.aborted) {
        throw new Error('Operation aborted');
      }

      // Create timeout for operation
      const timeout = setTimeout(() => {
        throw new Error('Operation timed out');
      }, 30000); // 30 second timeout

      try {
        return await operation();
      } finally {
        clearTimeout(timeout);
      }
    }

    return await operation();
  } catch (error: any) {
    // Handle AbortError silently - this is expected when component unmounts
    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
      console.log(`Request aborted for ${operationKey}`);
      return { data: null, error: null } as T;
    }

    // Handle component unmount silently
    if (error.message?.includes('Component unmounted')) {
      console.log(`Operation cancelled - component unmounted: ${operationKey}`);
      return { data: null, error: null } as T;
    }

    // Handle timeout errors
    if (error.message?.includes('timeout') || error.name === 'TimeoutError') {
      console.error(`Operation timed out: ${operationKey}`);
      throw new Error(`Operation timed out: ${operationKey}`);
    }

    // Handle network errors
    if (error.message?.includes('network') || error.name === 'NetworkError' || !navigator.onLine) {
      console.error(`Network error during operation: ${operationKey}`);
      throw new Error(`Network error: ${error.message || 'Failed to connect to server'}`);
    }

    // Log the error with context
    console.error(`DB operation "${operationKey}" failed:`, {
      error,
      name: error.name,
      message: error.message,
      stack: error.stack,
      context: operationKey
    });

    // Throw a properly formatted error
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(`DB operation "${operationKey}" failed: ${String(error)}`);
    }
  }
}

// Format request data for consistent handling
export function formatRequestData(request: any) {
  return {
    ...request,
    requesters: request.requesters?.map((requester: any) => ({
      ...requester,
      timestamp: new Date(requester.created_at)
    })) || []
  };
}

// Format set list data for consistent handling
export function formatSetListData(setList: any) {
  return {
    ...setList,
    date: new Date(setList.date),
    songs: setList.set_list_songs
      ?.sort((a: any, b: any) => a.position - b.position)
      .map((item: any) => item.song) || []
  };
}