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
      eventsPerSecond: 5, // Reduce from the default to avoid rate limits
    },
  },
});

// Helper function to handle Supabase errors
export function handleSupabaseError(error: any): never {
  console.error('Supabase error:', error);
  const errorMessage = error?.message || error?.error_description || 'Database operation failed';
  throw new Error(errorMessage);
}

// Execute a database operation with basic error handling
export async function executeDbOperation<T>(
  operationKey: string,
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`DB operation "${operationKey}" failed:`, error);
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