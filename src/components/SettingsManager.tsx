import React, { useState, useEffect } from 'react';
import { Save, Upload, Loader2 } from 'lucide-react';
import { LogoUploader } from './LogoUploader';
import { useUiSettings } from '../hooks/useUiSettings';

export function SettingsManager() {
  const { settings, loading, initialized, updateSettings } = useUiSettings();
  const [bandName, setBandName] = useState(settings?.band_name || 'uRequest Live');
  const [primaryColor, setPrimaryColor] = useState(settings?.primary_color || '#ff00ff');
  const [secondaryColor, setSecondaryColor] = useState(settings?.secondary_color || '#9d00ff');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Update local state when settings are loaded or changed
  useEffect(() => {
    if (settings) {
      setBandName(settings.band_name || 'uRequest Live');
      setPrimaryColor(settings.primary_color || '#ff00ff');
      setSecondaryColor(settings.secondary_color || '#9d00ff');
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      // Validate colors
      if (!primaryColor.match(/^#[0-9A-Fa-f]{6}$/)) {
        throw new Error('Primary color must be a valid hex color (e.g., #ff00ff)');
      }

      if (!secondaryColor.match(/^#[0-9A-Fa-f]{6}$/)) {
        throw new Error('Secondary color must be a valid hex color (e.g., #9d00ff)');
      }

      // Validate band name
      if (!bandName.trim()) {
        throw new Error('Band name cannot be empty');
      }

      // Update CSS variables to preview changes immediately
      document.documentElement.style.setProperty('--neon-pink', primaryColor);
      document.documentElement.style.setProperty('--neon-purple', secondaryColor);
      document.documentElement.style.setProperty('--frontend-accent-color', primaryColor);

      await updateSettings({
        band_name: bandName.trim(),
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        // Force timestamp update to ensure changes are picked up
        updated_at: new Date().toISOString()
      });
      
      setSaveSuccess(true);
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        if (saveSuccess) setSaveSuccess(false);
      }, 5000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading && !initialized) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-neon-pink" />
        <span className="ml-2 text-white">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="glass-effect rounded-lg p-6 space-y-6">
        <h3 className="text-lg font-medium text-white mb-4">App Settings</h3>
        
        <div>
          <label className="block text-sm font-medium text-white mb-2">
            Band Name
          </label>
          <input
            type="text"
            value={bandName}
            onChange={(e) => setBandName(e.target.value)}
            className="input-field text-gray-800"
            maxLength={50}
            placeholder="Enter band name"
          />
          <p className="text-xs text-gray-400 mt-1">
            This name will appear under the logo in the header
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Primary Color
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-10 rounded"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="input-field text-gray-800"
                pattern="^#[0-9A-Fa-f]{6}$"
                placeholder="#ff00ff"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Used for main accent color, buttons, and highlights
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Secondary Color
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="h-10 w-10 rounded"
              />
              <input
                type="text"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="input-field text-gray-800"
                pattern="^#[0-9A-Fa-f]{6}$"
                placeholder="#9d00ff"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Used for background gradients and secondary elements
            </p>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="neon-button flex items-center"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </>
            )}
          </button>
        </div>
        
        {saveSuccess && (
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded text-green-400 text-sm">
            Settings saved successfully!
          </div>
        )}
        
        {saveError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
            Error: {saveError}
          </div>
        )}
      </form>
    </div>
  );
}