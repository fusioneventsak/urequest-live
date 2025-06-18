import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';

interface UiSettings {
  id: string;
  band_logo_url: string | null;
  band_name: string;
  primary_color: string;
  secondary_color: string;
  frontend_bg_color?: string;
  frontend_accent_color?: string;
  frontend_header_bg?: string;
  frontend_secondary_accent?: string;
  song_border_color?: string;
  nav_bg_color?: string;
  highlight_color?: string;
  customMessage?: string;
  show_qr_code?: boolean;
}

// Default logo URL from Fusion Events 
const DEFAULT_LOGO_URL = "https://www.fusion-events.ca/wp-content/uploads/2025/03/ulr-wordmark.png";

// Default settings to use when none exist in the database
const DEFAULT_SETTINGS: Omit<UiSettings, 'id'> = {
  band_logo_url: DEFAULT_LOGO_URL,
  band_name: 'uRequest Live',
  primary_color: '#ff00ff',
  secondary_color: '#9d00ff',
  frontend_bg_color: '#13091f',
  frontend_accent_color: '#ff00ff',
  frontend_header_bg: '#13091f',
  frontend_secondary_accent: '#9d00ff',
  song_border_color: '#ff00ff',
  nav_bg_color: '#0f051d',
  highlight_color: '#ff00ff',
  customMessage: '',
  show_qr_code: false
};

// Function to apply colors instantly without DOM manipulation that breaks scrolling
const applyColorsInstantly = (colors: Record<string, string>) => {
  // Use a simpler, more performant method that doesn't break scrolling
  const style = document.getElementById('instant-colors-style') || document.createElement('style');
  if (!style.id) {
    style.id = 'instant-colors-style';
    document.head.appendChild(style);
  }
  
  // Create CSS rules that override with high specificity instead of !important
  const cssRules = Object.entries(colors).map(([property, value]) => {
    return `:root { ${property}: ${value} !important; }`;
  }).join('\n');
  
  style.textContent = cssRules;
  
  // Save to localStorage for next visit
  localStorage.setItem('uiColors', JSON.stringify(colors));
  
  console.log('Applied colors instantly via CSS injection:', colors);
};

export function useUiSettings() {
  // All useState hooks first - fixed order
  const [settings, setSettings] = useState<UiSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [timestamp, setTimestamp] = useState(Date.now());
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // All useCallback hooks - fixed order
  const applyCssVariables = useCallback((newSettings: UiSettings) => {
    const colors = {
      '--frontend-bg-color': newSettings.frontend_bg_color || DEFAULT_SETTINGS.frontend_bg_color,
      '--frontend-accent-color': newSettings.frontend_accent_color || DEFAULT_SETTINGS.frontend_accent_color,
      '--frontend-header-bg': newSettings.frontend_header_bg || DEFAULT_SETTINGS.frontend_header_bg,
      '--frontend-secondary-accent': newSettings.frontend_secondary_accent || DEFAULT_SETTINGS.frontend_secondary_accent,
      '--song-border-color': newSettings.song_border_color || newSettings.frontend_accent_color || DEFAULT_SETTINGS.song_border_color,
      '--neon-pink': newSettings.primary_color || DEFAULT_SETTINGS.primary_color,
      '--neon-purple': newSettings.secondary_color || DEFAULT_SETTINGS.secondary_color
    };

    applyColorsInstantly(colors);
  }, []);

  const refreshSettings = useCallback(() => {
    console.log("Refreshing UI settings");
    setTimestamp(Date.now());
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const { data: allSettings, error: fetchError } = await supabase
        .from('ui_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;
      
      let settingsToUse: UiSettings;
      
      if (!allSettings || allSettings.length === 0) {
        console.log("No UI settings found, creating defaults");
        const { data: newSettings, error: createError } = await supabase
          .from('ui_settings')
          .insert(DEFAULT_SETTINGS)
          .select()
          .single();

        if (createError) throw createError;
        settingsToUse = newSettings as UiSettings;
      } else {
        settingsToUse = allSettings[0] as UiSettings;
      }

      // Ensure all required color settings exist
      settingsToUse = {
        ...DEFAULT_SETTINGS,
        ...settingsToUse
      };

      // Apply CSS variables immediately for instant color change
      applyCssVariables(settingsToUse);
      
      setSettings(settingsToUse);
      setInitialized(true);
      setError(null);
    } catch (err) {
      console.error('Error fetching UI settings:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      
      // Apply default settings on error
      applyCssVariables(DEFAULT_SETTINGS as UiSettings);

      // Try to load from localStorage as fallback
      const savedColors = localStorage.getItem('uiColors');
      if (savedColors) {
        try {
          const colors = JSON.parse(savedColors);
          applyColorsInstantly(colors);
        } catch (e) {
          console.error('Error applying saved colors:', e);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [applyCssVariables]);

  const updateSettings = useCallback(async (newSettings: Partial<UiSettings>) => {
    // Apply colors INSTANTLY before any database operation
    if (newSettings.frontend_bg_color || 
        newSettings.frontend_accent_color || 
        newSettings.frontend_header_bg || 
        newSettings.frontend_secondary_accent ||
        newSettings.song_border_color ||
        newSettings.primary_color || 
        newSettings.secondary_color) {
      
      const colors: Record<string, string> = {};
      
      // Build colors object for instant application
      if (newSettings.frontend_bg_color) {
        colors['--frontend-bg-color'] = newSettings.frontend_bg_color;
      }
      if (newSettings.frontend_accent_color) {
        colors['--frontend-accent-color'] = newSettings.frontend_accent_color;
      }
      if (newSettings.frontend_header_bg) {
        colors['--frontend-header-bg'] = newSettings.frontend_header_bg;
      }
      if (newSettings.frontend_secondary_accent) {
        colors['--frontend-secondary-accent'] = newSettings.frontend_secondary_accent;
      }
      if (newSettings.song_border_color) {
        colors['--song-border-color'] = newSettings.song_border_color;
      }
      if (newSettings.primary_color) {
        colors['--neon-pink'] = newSettings.primary_color;
      }
      if (newSettings.secondary_color) {
        colors['--neon-purple'] = newSettings.secondary_color;
      }
      
      // Apply instantly BEFORE database update
      applyColorsInstantly(colors);
    }

    // Then update the database in the background
    try {
      const { data: currentSettings } = await supabase
        .from('ui_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!currentSettings || currentSettings.length === 0) {
        const { error: createError } = await supabase
          .from('ui_settings')
          .insert({
            ...DEFAULT_SETTINGS,
            ...newSettings,
            updated_at: new Date().toISOString()
          });

        if (createError) throw createError;
      } else {
        const { error: updateError } = await supabase
          .from('ui_settings')
          .update({
            ...newSettings,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentSettings[0].id);

        if (updateError) throw updateError;
      }

      // Force refresh to ensure all components update (but colors already applied)
      await fetchSettings();
      refreshSettings();
    } catch (error) {
      console.error('Error updating UI settings:', error);
      throw error;
    }
  }, [fetchSettings, refreshSettings]);

  // Single useEffect to handle everything - FIXED ORDER
  useEffect(() => {
    // Apply saved colors immediately before any database fetch
    try {
      const savedColors = localStorage.getItem('uiColors');
      if (savedColors) {
        const colors = JSON.parse(savedColors);
        applyColorsInstantly(colors);
        console.log('Applied saved colors from localStorage immediately');
      }
    } catch (e) {
      console.warn('Error loading colors from localStorage:', e);
    }

    // Start loading settings
    setLoading(true);
    
    // Fetch settings immediately
    fetchSettings().catch(err => {
      console.error('Error in initial settings fetch:', err);
    });

    // Set up realtime subscription for settings changes
    const channel = supabase.channel('ui_settings_changes')
      .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'ui_settings' },
          () => {
            console.log("UI settings changed, fetching updates");
            fetchSettings().catch(err => {
              console.error('Error fetching updated settings:', err);
            });
          })
      .subscribe((status) => {
        console.log('UI settings subscription status:', status);
      });
    
    // Set up periodic refresh as a fallback
    const refreshInterval = setInterval(() => {
      fetchSettings().catch(err => {
        console.error('Error in periodic settings refresh:', err);
      });
    }, 30000);

    return () => {
      clearInterval(refreshInterval);
      supabase.removeChannel(channel);
    };
  }, [fetchSettings]); // Only depend on fetchSettings

  return {
    settings,
    loading,
    error,
    initialized,
    timestamp,
    updateSettings,
    refreshSettings
  };
}