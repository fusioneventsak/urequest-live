import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Plus, Edit2, Trash2, Save, X, Music4, Upload, Loader2, Filter, Tag } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { searchITunes } from '../utils/itunes';
import type { Song } from '../types';

interface SongLibraryProps {
  songs: Song[];
  onAddSong: (song: Omit<Song, 'id'>) => void;
  onUpdateSong: (song: Song) => void;
  onDeleteSong: (id: string) => void;
}

export function SongLibrary({ songs, onAddSong, onUpdateSong, onDeleteSong }: SongLibraryProps) {
  const [isAdding, setIsAdding] = useState<'single' | 'bulk' | false>(false);
  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [bulkInput, setBulkInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<Omit<Song, 'id'>>({
    title: '',
    artist: '',
    genre: '',
    key: '',
    notes: '',
    albumArtUrl: '',
  });

  // Extract all unique genres from songs
  const availableGenres = useMemo(() => {
    const genreSet = new Set<string>();
    
    songs.forEach(song => {
      if (song.genre) {
        song.genre.split(',').forEach(genre => {
          genreSet.add(genre.trim());
        });
      }
    });
    
    return Array.from(genreSet).sort();
  }, [songs]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'genre') {
      const formattedValue = value
        .replace(/\s+/g, ' ')
        .replace(/\s*,\s*/g, ', ')
        .replace(/^,\s*/, '')
        .replace(/\s*,$/, '');
      
      setFormData(prev => ({
        ...prev,
        [name]: formattedValue
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsProcessing(true);
      
      // Search for album art
      const albumArtUrl = await searchITunes(formData.title, formData.artist);
      
      const cleanedGenre = formData.genre
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/\s*,\s*/g, ', ')
        .replace(/^,\s*/, '')
        .replace(/\s*,$/, '');

      const songData = {
        ...formData,
        genre: cleanedGenre,
        albumArtUrl
      };

      if (editingSongId) {
        const { error } = await supabase
          .from('songs')
          .update(songData)
          .eq('id', editingSongId);

        if (error) throw error;
        onUpdateSong({ id: editingSongId, ...songData });
      } else {
        const { data, error } = await supabase
          .from('songs')
          .insert(songData)
          .select()
          .single();

        if (error) throw error;
        if (data) onAddSong(data);
      }

      setFormData({ title: '', artist: '', genre: '', key: '', notes: '', albumArtUrl: '' });
      setIsAdding(false);
      setEditingSongId(null);
    } catch (error) {
      console.error('Error saving song:', error);
      alert('Error saving song. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkTextSubmit = async () => {
    if (!bulkInput.trim()) return;

    const lines = bulkInput
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [title, artist] = line.split(',').map(s => s.trim());
        return { title, artist };
      })
      .filter(({ title, artist }) => title && artist);

    if (lines.length === 0) {
      alert('No valid songs found in the input');
      return;
    }

    setTotalToProcess(lines.length);
    setProcessedCount(0);
    setIsProcessing(true);

    try {
      // Process songs in smaller batches
      const batchSize = 5;
      for (let i = 0; i < lines.length; i += batchSize) {
        const batch = lines.slice(i, i + batchSize);
        
        // Process each song in the batch
        const songsWithArt = await Promise.all(
          batch.map(async ({ title, artist }) => {
            const albumArtUrl = await searchITunes(title, artist);
            return {
              title,
              artist,
              genre: '',
              key: '',
              notes: '',
              albumArtUrl
            };
          })
        );

        // Insert the batch
        const { error } = await supabase
          .from('songs')
          .insert(songsWithArt);

        if (error) throw error;
        
        setProcessedCount(prev => prev + batch.length);
        
        // Add a delay between batches to avoid rate limits
        if (i + batchSize < lines.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      setBulkInput('');
      setIsAdding(false);
      alert(`Successfully added ${lines.length} songs to the library`);
    } catch (error) {
      console.error('Error bulk adding songs:', error);
      alert('An error occurred while adding songs. Please try again.');
    } finally {
      setIsProcessing(false);
      setProcessedCount(0);
      setTotalToProcess(0);
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n');
      
      // Process the CSV content
      const validSongs = lines
        .map(line => {
          const [title, artist] = line.split(',').map(s => s.trim());
          return title && artist ? { title, artist } : null;
        })
        .filter((song): song is { title: string; artist: string } => song !== null);

      if (validSongs.length === 0) {
        alert('No valid songs found in the CSV file');
        return;
      }

      setTotalToProcess(validSongs.length);
      setProcessedCount(0);
      setIsProcessing(true);

      // Process songs in batches
      const batchSize = 5;
      for (let i = 0; i < validSongs.length; i += batchSize) {
        const batch = validSongs.slice(i, i + batchSize);
        
        // Process each song in the batch
        const songsWithArt = await Promise.all(
          batch.map(async ({ title, artist }) => {
            const albumArtUrl = await searchITunes(title, artist);
            return {
              title,
              artist,
              genre: '',
              key: '',
              notes: '',
              albumArtUrl
            };
          })
        );

        // Insert the batch
        const { error } = await supabase
          .from('songs')
          .insert(songsWithArt);

        if (error) throw error;
        
        setProcessedCount(prev => prev + batch.length);
        
        // Add a delay between batches
        if (i + batchSize < validSongs.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      alert(`Successfully added ${validSongs.length} songs to the library`);
      setIsAdding(false);
    } catch (error) {
      console.error('Error processing CSV:', error);
      alert('Error processing CSV file. Please try again.');
    } finally {
      setIsProcessing(false);
      setProcessedCount(0);
      setTotalToProcess(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const startEditing = useCallback((song: Song) => {
    setEditingSongId(song.id);
    setFormData({
      title: song.title,
      artist: song.artist,
      genre: song.genre || '',
      key: song.key || '',
      notes: song.notes || '',
      albumArtUrl: song.albumArtUrl || '',
    });
    setIsAdding('single');
  }, []);

  const handleDeleteSong = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this song?')) {
      try {
        const { error } = await supabase
          .from('songs')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        onDeleteSong(id);
      } catch (error) {
        console.error('Error deleting song:', error);
        alert('Error deleting song. Please try again.');
      }
    }
  };

  // Get filtered songs based on search term and genre filter
  const filteredSongs = useMemo(() => {
    return songs.filter(song => {
      // First filter by search term
      const matchesSearch = 
        song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        song.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (song.genre?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (song.key?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      
      // Then filter by genre if selected
      const matchesGenre = !genreFilter || 
        (song.genre && song.genre.split(',').some(g => g.trim().toLowerCase() === genreFilter.toLowerCase()));
      
      return matchesSearch && matchesGenre;
    });
  }, [songs, searchTerm, genreFilter]);

  const renderGenres = useCallback((genres: string) => {
    if (!genres) return '-';
    return genres.split(', ').map((genre, index) => (
      <span
        key={index}
        className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full mr-1 mb-1 ${
          genreFilter && genre.trim().toLowerCase() === genreFilter.toLowerCase()
            ? 'bg-neon-pink/20 text-neon-pink'
            : 'text-gray-700 bg-gray-100'
        }`}
        onClick={(e) => {
          e.stopPropagation();
          setGenreFilter(genreFilter === genre.trim() ? null : genre.trim());
        }}
        style={{ cursor: 'pointer' }}
      >
        {genre}
      </span>
    ));
  }, [genreFilter]);

  // Calculate genre statistics
  const genreStats = useMemo(() => {
    const stats = new Map<string, number>();
    
    songs.forEach(song => {
      if (song.genre) {
        song.genre.split(',').forEach(genre => {
          const g = genre.trim();
          if (g) {
            stats.set(g, (stats.get(g) || 0) + 1);
          }
        });
      }
    });
    
    return Array.from(stats.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by count, descending
      .slice(0, 10); // Top 10 genres
  }, [songs]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold neon-text">Song Library</h2>
          <span className="text-neon-pink text-sm">({songs.length} songs)</span>
        </div>
        {!isAdding && !editingSongId && (
          <div className="flex space-x-4">
            <button
              onClick={() => setIsAdding('bulk')}
              className="neon-button flex items-center"
            >
              <Upload className="w-4 h-4 mr-2" />
              Bulk Upload
            </button>
            <button
              onClick={() => setIsAdding('single')}
              className="neon-button flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Song
            </button>
          </div>
        )}
      </div>

      {isAdding === 'single' && (
        <form onSubmit={handleSubmit} className="glass-effect rounded-lg p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium mb-2 text-white">Title *</label>
              <input
                type="text"
                id="title"
                name="title"
                required
                value={formData.title}
                onChange={handleInputChange}
                className="input-field"
                placeholder="Enter song title"
              />
            </div>
            <div>
              <label htmlFor="artist" className="block text-sm font-medium mb-2 text-white">Artist *</label>
              <input
                type="text"
                id="artist"
                name="artist"
                required
                value={formData.artist}
                onChange={handleInputChange}
                className="input-field"
                placeholder="Enter artist name"
              />
            </div>
            <div>
              <label htmlFor="genre" className="block text-sm font-medium mb-2 text-white">
                Genres
                <span className="text-gray-400 text-xs ml-2">
                  (separate with comma and space, e.g. "Rock, Pop, Dance")
                </span>
              </label>
              <input
                type="text"
                id="genre"
                name="genre"
                value={formData.genre}
                onChange={handleInputChange}
                className="input-field"
                placeholder="Rock, Pop, Dance"
              />
            </div>
            <div>
              <label htmlFor="key" className="block text-sm font-medium mb-2 text-white">Key</label>
              <input
                type="text"
                id="key"
                name="key"
                value={formData.key}
                onChange={handleInputChange}
                className="input-field"
                placeholder="Enter song key"
              />
            </div>
          </div>
          <div>
            <label htmlFor="albumArtUrl" className="block text-sm font-medium mb-2 text-white">Album Art URL</label>
            <input
              type="url"
              id="albumArtUrl"
              name="albumArtUrl"
              value={formData.albumArtUrl}
              onChange={handleInputChange}
              className="input-field"
              placeholder="https://example.com/album-art.jpg"
            />
          </div>
          <div>
            <label htmlFor="notes" className="block text-sm font-medium mb-2 text-white">Notes</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              className="input-field"
              rows={3}
              placeholder="Add any notes about the song..."
            />
          </div>
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setEditingSongId(null);
                setFormData({ title: '', artist: '', genre: '', key: '', notes: '', albumArtUrl: '' });
              }}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="neon-button flex items-center"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {editingSongId ? 'Update Song' : 'Add Song'}
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {isAdding === 'bulk' && (
        <div className="glass-effect rounded-lg p-6 space-y-6">
          <h3 className="text-lg font-semibold text-white mb-4">Bulk Upload Songs</h3>
          
          {isProcessing && (
            <div className="mb-4">
              <div className="flex justify-between text-sm text-white mb-2">
                <span>Processing songs...</span>
                <span>{processedCount} / {totalToProcess}</span>
              </div>
              <div className="w-full bg-neon-purple/20 rounded-full h-2">
                <div
                  className="bg-neon-pink h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(processedCount / totalToProcess) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-white">Upload CSV File</label>
              <div className="flex items-center space-x-4">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvUpload}
                  ref={fileInputRef}
                  className="hidden"
                  disabled={isProcessing}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="neon-button flex items-center"
                  disabled={isProcessing}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Choose CSV File
                </button>
                <p className="text-sm text-gray-400">Format: Title,Artist (one per line)</p>
              </div>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neon-purple/20"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="px-2 text-sm text-gray-400 bg-darker-purple">OR</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-white">Paste Song List</label>
              <textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder="Title, Artist&#10;Title, Artist&#10;..."
                className="input-field"
                rows={5}
                disabled={isProcessing}
              />
              <p className="text-sm text-gray-400 mt-1">Format: Title,Artist (one per line)</p>
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkTextSubmit}
                disabled={!bulkInput.trim() || isProcessing}
                className="neon-button flex items-center"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Songs
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Genre filter and search section */}
      {!isAdding && (
        <div className="glass-effect rounded-lg p-4">
          <div className="flex flex-wrap gap-4 md:flex-row md:items-center justify-between">
            <div className="w-full md:w-auto flex-1">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search songs by title, artist, genre or key..."
                  className="input-field pl-10 w-full"
                />
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              </div>
            </div>

            <div className="flex items-center">
              {genreFilter && (
                <div className="flex items-center mr-4">
                  <span className="text-white text-sm mr-2">Genre:</span>
                  <span className="px-2 py-1 text-sm bg-neon-pink/20 text-neon-pink rounded flex items-center">
                    {genreFilter}
                    <button 
                      onClick={() => setGenreFilter(null)}
                      className="ml-2 text-neon-pink"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                </div>
              )}
              
              <div className="text-sm text-gray-400">
                {filteredSongs.length} of {songs.length} songs
              </div>
            </div>
          </div>

          {/* Popular genres chips */}
          <div className="mt-3">
            <div className="flex items-center mb-2">
              <Tag className="w-4 h-4 text-neon-pink mr-2" />
              <span className="text-sm text-white">Popular Genres:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {genreStats.map(([genre, count]) => (
                <button
                  key={genre}
                  onClick={() => setGenreFilter(genreFilter === genre ? null : genre)}
                  className={`px-2 py-1 text-xs rounded-full transition-colors ${
                    genreFilter === genre
                      ? 'bg-neon-pink text-white' 
                      : 'bg-neon-purple/10 text-gray-300 hover:text-white hover:bg-neon-purple/20'
                  }`}
                >
                  {genre} ({count})
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="glass-effect rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-neon-purple/20">
          <thead className="bg-neon-purple/10">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">#</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Album Art</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Title</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Artist</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Genres</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Key</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neon-purple/20">
            {filteredSongs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                  {searchTerm || genreFilter 
                    ? 'No songs match your search criteria' 
                    : 'No songs in the library yet'}
                </td>
              </tr>
            ) : (
              filteredSongs.map((song, index) => (
                <tr key={song.id} className="hover:bg-neon-purple/10">
                  <td className="px-6 py-4 text-sm text-gray-300">{index + 1}</td>
                  <td className="px-6 py-4">
                    {song.albumArtUrl ? (
                      <img
                        src={song.albumArtUrl}
                        alt={`${song.title} album art`}
                        className="w-12 h-12 object-cover rounded-md neon-border"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement?.classList.add('fallback-icon');
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-md flex items-center justify-center bg-neon-purple/10">
                        <Music4 className="w-6 h-6 text-neon-pink" />
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-white">{song.title}</td>
                  <td className="px-6 py-4 text-sm text-white">{song.artist}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex flex-wrap">{renderGenres(song.genre || '')}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">{song.key || '-'}</td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => startEditing(song)}
                        className="p-2 text-neon-pink hover:bg-neon-pink/10 rounded-full transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSong(song.id)}
                        className="p-2 text-red-400 hover:bg-red-400/20 rounded-full transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}