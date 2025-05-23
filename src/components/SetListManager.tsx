import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Plus, Save, Trash2, Music4, Check, Edit2, X, Search, Loader2, Play, AlertCircle, Filter, Tags } from 'lucide-react';
import { supabase } from '../utils/supabase';
import type { Song, SetList } from '../types';

interface SetListManagerProps {
  songs: Song[];
  setLists: SetList[];
  onCreateSetList: (setList: Omit<SetList, 'id'>) => void;
  onUpdateSetList: (setList: SetList) => void;
  onDeleteSetList: (id: string) => void;
  onSetActive: (id: string) => void;
}

export function SetListManager({
  songs,
  setLists,
  onCreateSetList,
  onUpdateSetList,
  onDeleteSetList,
  onSetActive,
}: SetListManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingSetList, setEditingSetList] = useState<SetList | null>(null);
  const [selectedSongs, setSelectedSongs] = useState<Song[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isActivating, setIsActivating] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [isCreatingByGenre, setIsCreatingByGenre] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

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

  // Filter songs by selected genres
  const songsByGenre = useMemo(() => {
    if (selectedGenres.length === 0) return [];
    
    return songs.filter(song => {
      if (!song.genre) return false;
      
      const songGenres = song.genre.split(',').map(g => g.trim());
      return selectedGenres.some(genre => songGenres.includes(genre));
    });
  }, [songs, selectedGenres]);

  // Handle genre selection/deselection
  const toggleGenreSelection = useCallback((genre: string) => {
    setSelectedGenres(prev => 
      prev.includes(genre)
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  }, []);

  // Auto-select songs when genres are selected in genre creation mode
  useEffect(() => {
    if (isCreatingByGenre) {
      setSelectedSongs(songsByGenre);
    }
  }, [songsByGenre, isCreatingByGenre]);

  // Manual activation method without relying on database triggers
  const handleSetActive = async (id: string) => {
    if (isActivating || !id) return;
    setIsActivating(id);
    
    try {
      // Use the external activation handler
      await onSetActive(id);
    } catch (error) {
      console.error('Error setting active set list:', error);
    } finally {
      setIsActivating(null);
    } 
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    
    // Validate required fields
    if (!formData.name || !formData.date) {
      alert('Set list name and date are required');
      return;
    }
    
    if (selectedSongs.length === 0) {
      alert('Please select at least one song for your set list');
      return;
    }
    
    console.log('Saving set list...');
    setIsSaving(true);

    try {
      if (editingSetList) {
        console.log('Updating existing set list:', editingSetList.id);
        
        // Update the set list with the edited data
        await onUpdateSetList({
          ...editingSetList,
          name: formData.name,
          date: new Date(formData.date),
          notes: formData.notes || '',
          songs: selectedSongs,
        });
        
        console.log('Set list updated successfully');
      } else {
        // Create new set list
        console.log('Creating new set list...');
        
        let setListName = formData.name;
        
        // If creating by genre, add genre info to name if not specified
        if (isCreatingByGenre && selectedGenres.length > 0 && !setListName.includes('Genre')) {
          const genreText = selectedGenres.length > 1 
            ? `${selectedGenres.length} Genres` 
            : selectedGenres[0];
          
          setListName = setListName || `${genreText} Set`;
        }
        
        // Create the set list object with proper snake_case fields for database
        await onCreateSetList({
          name: setListName,
          date: formData.date,
          notes: isCreatingByGenre 
            ? `${formData.notes ? formData.notes + '\n' : ''}Genres: ${selectedGenres.join(', ')}`
            : formData.notes || '',
          songs: selectedSongs,
          isActive: false
        });
        
        console.log('Set list created successfully');
      }

      // Reset form
      resetForm();
    } catch (error) {
      console.error('Error saving set list:', error);
      alert('Error saving set list. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setIsCreating(false);
    setIsCreatingByGenre(false);
    setEditingSetList(null);
    setSelectedSongs([]);
    setSelectedGenres([]);
    setFormData({
      name: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setSearchTerm('');
  };

  const handleDeleteSetList = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this set list?')) {
      return;
    }

    try {
      await onDeleteSetList(id);
    } catch (error) {
      console.error('Error deleting set list:', error);
      alert('Error deleting set list. Please try again.');
    }
  };

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  const startEditing = useCallback((setList: SetList) => {
    setEditingSetList(setList);
    setFormData({
      name: setList.name,
      date: new Date(setList.date).toISOString().split('T')[0],
      notes: setList.notes || '',
    });
    setSelectedSongs(setList.songs || []);
    setIsCreating(true);
    setIsCreatingByGenre(false);
  }, []);

  const toggleSongSelection = useCallback((song: Song) => {
    setSelectedSongs(prev => 
      prev.find(s => s.id === song.id)
        ? prev.filter(s => s.id !== song.id)
        : [...prev, song]
    );
  }, []);

  const handleStartGenreCreate = useCallback(() => {
    setIsCreating(true);
    setIsCreatingByGenre(true);
    setFormData({
      name: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setSelectedGenres([]);
    setSelectedSongs([]);
  }, []);

  const filteredSongs = useMemo(() => {
    // When creating by genre and genres are selected, we show songs by genre
    if (isCreatingByGenre && selectedGenres.length > 0) {
      return songsByGenre.filter(
        song =>
          song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          song.artist.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Regular song filtering
    return songs.filter(
      song =>
        song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        song.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (song.genre?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );
  }, [songs, searchTerm, isCreatingByGenre, selectedGenres, songsByGenre]);

  const renderGenres = useCallback((genres: string | undefined) => {
    if (!genres) return null;
    return genres.split(',').map((genre, index) => (
      <span
        key={index}
        className="inline-block px-2 py-0.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-full mr-1 mb-1"
      >
        {genre.trim()}
      </span>
    ));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold neon-text">Set Lists</h2>
          <span className="text-neon-pink text-sm">({setLists.length} lists)</span>
        </div>
        {!isCreating && (
          <div className="flex space-x-3">
            <button
              onClick={handleStartGenreCreate}
              className="neon-button flex items-center bg-neon-purple/20"
            >
              <Tags className="w-4 h-4 mr-2" />
              Genre Set List
            </button>
            <button
              onClick={() => setIsCreating(true)}
              className="neon-button flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Set List
            </button>
          </div>
        )}
      </div>

      {isCreating && (
        <form onSubmit={handleSubmit} className="glass-effect p-6 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">
              {editingSetList 
                ? 'Edit Set List' 
                : isCreatingByGenre 
                  ? 'Create Set List by Genre' 
                  : 'Create Set List'
              }
            </h3>
            
            {isCreatingByGenre && (
              <div className="px-3 py-1 bg-neon-purple/10 rounded-md text-sm text-neon-pink flex items-center">
                <Filter className="w-3 h-3 mr-1" />
                Creating by genre
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Set List Name *</label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleInputChange}
                className="input-field"
                placeholder={isCreatingByGenre ? "e.g., Pop Night" : "e.g., Friday Night Show"}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Date *</label>
              <input
                type="date"
                name="date"
                required
                value={formData.date}
                onChange={handleInputChange}
                className="input-field"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-white mb-2">Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              className="input-field"
              rows={3}
              placeholder="Any special notes for this set list..."
            />
          </div>

          {isCreatingByGenre ? (
            <div>
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-white mb-2">
                  Select Genres
                </label>
                <div className="text-xs text-gray-400">
                  {selectedGenres.length} genres selected ({songsByGenre.length} songs)
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {availableGenres.length > 0 ? (
                  availableGenres.map(genre => (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => toggleGenreSelection(genre)}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        selectedGenres.includes(genre)
                          ? 'bg-neon-pink text-white' 
                          : 'bg-neon-purple/10 text-gray-300 hover:text-white hover:bg-neon-purple/20'
                      }`}
                    >
                      {genre}
                    </button>
                  ))
                ) : (
                  <div className="text-gray-400 text-sm py-2">
                    No genres found. Add genres to your songs first.
                  </div>
                )}
              </div>

              {selectedGenres.length > 0 && (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <label className="block text-sm font-medium text-white">
                      Songs in Selected Genres ({songsByGenre.length})
                    </label>
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Filter songs..."
                        className="input-field pl-10 py-1"
                      />
                    </div>
                  </div>

                  <div className="max-h-[400px] overflow-y-auto space-y-2 border border-neon-purple/20 rounded-lg p-2">
                    {filteredSongs.length > 0 ? (
                      filteredSongs.map(song => (
                        <div
                          key={song.id}
                          className="flex items-center justify-between p-2 bg-neon-purple/10 rounded"
                        >
                          <div className="flex items-center space-x-3">
                            {song.albumArtUrl ? (
                              <img
                                src={song.albumArtUrl}
                                alt={`${song.title} album art`}
                                className="w-10 h-10 object-cover rounded-md neon-border"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const container = e.currentTarget.parentElement;
                                  if (container) {
                                    const fallback = document.createElement('div');
                                    fallback.className = "w-10 h-10 rounded-md flex items-center justify-center bg-neon-purple/10";
                                    fallback.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff00ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>';
                                    container.prepend(fallback);
                                  }
                                }}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-md flex items-center justify-center bg-neon-purple/10">
                                <Music4 className="w-5 h-5 text-neon-pink" />
                              </div>
                            )}
                            <div>
                              <span className="font-medium text-white">{song.title}</span>
                              <p className="text-sm text-gray-300">{song.artist}</p>
                              <div className="flex flex-wrap mt-1">
                                {song.genre?.split(',').map((g, i) => (
                                  <span 
                                    key={i} 
                                    className={`inline-block px-2 py-0.5 mr-1 text-xs rounded-full ${
                                      selectedGenres.includes(g.trim())
                                        ? 'bg-neon-pink/20 text-neon-pink'
                                        : 'bg-gray-700/50 text-gray-300'
                                    }`}
                                  >
                                    {g.trim()}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleSongSelection(song)}
                            className={`w-5 h-5 rounded-full flex items-center justify-center ${
                              selectedSongs.find(s => s.id === song.id)
                                ? 'bg-neon-pink text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                          >
                            {selectedSongs.find(s => s.id === song.id) ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <Plus className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-400 text-center py-4">
                        No matching songs found
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-medium text-white">Select Songs</label>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search songs..."
                    className="input-field pl-10 py-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
                {filteredSongs.map((song) => (
                  <div
                    key={song.id}
                    onClick={() => toggleSongSelection(song)}
                    className={`p-4 rounded cursor-pointer transition-colors ${
                      selectedSongs.find((s) => s.id === song.id)
                        ? 'bg-neon-purple/20 border-neon-pink border'
                        : 'hover:bg-neon-purple/10'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {song.albumArtUrl ? (
                        <img
                          src={song.albumArtUrl}
                          alt={`${song.title} album art`}
                          className="w-12 h-12 object-cover rounded-md neon-border"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const container = e.currentTarget.parentElement;
                            if (container) {
                              const fallback = document.createElement('div');
                              fallback.className = "w-12 h-12 rounded-md flex items-center justify-center bg-neon-purple/10";
                              fallback.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff00ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>';
                              container.prepend(fallback);
                            }
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-md flex items-center justify-center bg-neon-purple/10">
                          <Music4 className="w-6 h-6 text-neon-pink" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-white">{song.title}</p>
                        <p className="text-sm text-gray-300">{song.artist}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {renderGenres(song.genre)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {filteredSongs.length === 0 && (
                  <div className="col-span-2 text-center py-8 text-gray-400">
                    No songs match your search criteria
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedSongs.length > 0 && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium text-white">Selected Songs ({selectedSongs.length})</h4>
                {selectedSongs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedSongs([])}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto border border-neon-purple/20 rounded-lg p-2">
                {selectedSongs.map((song, index) => (
                  <div
                    key={`${song.id}`}
                    className="flex items-center justify-between p-2 bg-neon-purple/10 rounded"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-gray-400 text-sm">{index + 1}.</span>
                      {song.albumArtUrl ? (
                        <img
                          src={song.albumArtUrl}
                          alt={`${song.title} album art`}
                          className="w-10 h-10 object-cover rounded-md neon-border"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const container = e.currentTarget.parentElement;
                            if (container) {
                              const fallback = document.createElement('div');
                              fallback.className = "w-10 h-10 rounded-md flex items-center justify-center bg-neon-purple/10";
                              fallback.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff00ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>';
                              container.prepend(fallback);
                            }
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-md flex items-center justify-center bg-neon-purple/10">
                          <Music4 className="w-5 h-5 text-neon-pink" />
                        </div>
                      )}
                      <div>
                        <span className="font-medium text-white">{song.title}</span>
                        <p className="text-sm text-gray-300">{song.artist}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSongSelection(song);
                      }}
                      className="p-1 text-red-400 hover:bg-red-400/20 rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 rounded-md border border-neon-pink text-neon-pink hover:bg-neon-pink/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="neon-button flex items-center"
              disabled={isSaving || selectedSongs.length === 0}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {editingSetList ? 'Update Set List' : 'Create Set List'}
                </>
              )}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {setLists.length === 0 ? (
          <div className="glass-effect rounded-lg p-6 text-center">
            <AlertCircle className="w-12 h-12 text-neon-pink mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No Set Lists Yet</h3>
            <p className="text-gray-300 mb-4">
              Create your first set list to organize the songs your band will play.
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={handleStartGenreCreate}
                className="neon-button flex items-center"
              >
                <Tags className="w-4 h-4 mr-2" />
                Create by Genre
              </button>
              <button
                onClick={() => setIsCreating(true)}
                className="neon-button flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Set List
              </button>
            </div>
          </div>
        ) : (
          setLists.map((setList) => (
            <div
              key={setList.id}
              className={`glass-effect rounded-lg p-4 transition-all duration-300 relative ${
                setList.isActive ? 'set-list-active' : ''
              }`}
            >
              {setList.isActive && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-pulse"></div>
              )}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-semibold text-white">{setList.name}</h3>
                    <div className={`status-badge ${setList.isActive ? 'status-badge-active' : 'status-badge-inactive'}`}>
                      <div className={`w-2 h-2 rounded-full ${setList.isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
                      <span>{setList.isActive ? 'Active' : 'Inactive'}</span>
                      {setList.isActive && (
                        <span className="ml-2 text-xs">
                          ({setList.songs?.length || 0} songs available)
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-300">
                    {new Date(setList.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleSetActive(setList.id)}
                    className={`set-list-action ${
                      setList.isActive
                        ? 'set-list-action-active'
                        : 'set-list-action-inactive'
                    }`}
                    disabled={isActivating === setList.id}
                  >
                    {isActivating === setList.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : setList.isActive ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Deactivate</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>Activate</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => startEditing(setList)}
                    className="p-2 text-neon-pink hover:bg-neon-pink/10 rounded-full"
                    title="Edit Set List"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (setList.isActive) {
                        alert('Cannot delete an active set list. Please deactivate it first.');
                        return;
                      }
                      handleDeleteSetList(setList.id);
                    }}
                    className={`p-2 rounded-full ${
                      setList.isActive
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-red-400 hover:text-red-300 hover:bg-red-400/20'
                    }`}
                    title={setList.isActive ? 'Cannot delete active set list' : 'Delete Set List'}
                    disabled={setList.isActive}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {setList.notes && (
                <p className="text-sm text-gray-300 mb-4">{setList.notes}</p>
              )}
              <div className="space-y-2">
                {setList.songs && setList.songs.length > 0 ? (
                  setList.songs.map((song, index) => (
                    <div
                      key={`${setList.id}-${song.id}`}
                      className="flex items-center space-x-3 p-2 bg-neon-purple/10 rounded"
                    >
                      <span className="text-gray-400 text-sm">{index + 1}.</span>
                      {song.albumArtUrl ? (
                        <img
                          src={song.albumArtUrl}
                          alt={`${song.title} album art`}
                          className="w-10 h-10 object-cover rounded-md neon-border"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const container = e.currentTarget.parentElement;
                            if (container) {
                              const fallback = document.createElement('div');
                              fallback.className = "w-10 h-10 rounded-md flex items-center justify-center bg-neon-purple/10";
                              fallback.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff00ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>';
                              container.prepend(fallback);
                            }
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-md flex items-center justify-center bg-neon-purple/10">
                          <Music4 className="w-5 h-5 text-neon-pink" />
                        </div>
                      )}
                      <div>
                        <span className="font-medium text-white">{song.title}</span>
                        <p className="text-sm text-gray-300">{song.artist}</p>
                        {song.genre && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {song.genre.split(',').map((genre, i) => (
                              <span 
                                key={i} 
                                className="inline-block px-1.5 py-0.5 text-xs rounded-full bg-neon-purple/20 text-gray-300"
                              >
                                {genre.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-400 text-sm italic p-2 bg-neon-purple/5 rounded">
                    No songs in this set list
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}