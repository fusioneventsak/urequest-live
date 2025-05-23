// ... (previous imports remain the same)

const handleSubmitRequest = useCallback(async (data: RequestFormData): Promise<boolean> => {
  console.log('Submitting request:', data);
  
  try {
    // Validate photo size if provided
    if (data.userPhoto && data.userPhoto.length > MAX_PHOTO_SIZE) {
      throw new Error('Profile photo is too large. Please use a smaller image (max 300KB).');
    }

    // Check for existing request with same title
    const { data: existingRequests, error: checkError } = await supabase
      .from('requests')
      .select('id, votes, title')
      .eq('title', data.title)
      .eq('is_played', false)
      .limit(1);

    if (checkError) throw checkError;

    if (existingRequests && existingRequests.length > 0) {
      // Add requester to existing request
      const existingId = existingRequests[0].id;
      
      // First check if this user already requested this song
      const { data: existingRequesters, error: requesterCheckError } = await supabase
        .from('requesters')
        .select('id')
        .eq('request_id', existingId)
        .eq('name', data.requestedBy)
        .limit(1);

      if (requesterCheckError) throw requesterCheckError;

      if (existingRequesters && existingRequesters.length > 0) {
        toast.error(`You've already requested "${existingRequests[0].title}". Try another song!`);
        return false;
      }

      // Add new requester
      console.log("Adding requester to existing request:", {
        request_id: existingId,
        name: data.requestedBy,
        photo: data.userPhoto ? "[PHOTO DATA]" : null,  // don't log the actual photo data
        message: data.message || ''
      });
      
      const { error: requesterError } = await supabase
        .from('requesters')
        .insert({
          request_id: existingId,
          name: data.requestedBy,
          photo: data.userPhoto || generateDefaultAvatar(data.requestedBy),
          message: data.message || ''
        });
        
      if (requesterError) {
        console.error("Error adding requester:", requesterError);
        if (requesterError.message.includes('payload string too long')) {
          throw new Error('Profile photo is too large. Please use a smaller image (max 300KB).');
        }
        throw requesterError;
      }
      
      toast.success('Your request has been added to the queue!');
    } else {
      // Create new request
      console.log('Creating new request:', data.title);
      const { data: newRequest, error } = await supabase
        .from('requests')
        .insert({
          title: data.title,
          artist: data.artist,
          votes: 0,
          status: 'pending',
          is_locked: false,
          is_played: false
        })
        .select();
        
      if (error) throw error;
      
      if (newRequest && newRequest[0]) {
        console.log('Successfully created request:', newRequest[0].id);
        
        // Add requester to the new request
        const requesterData = {
          request_id: newRequest[0].id,
          name: data.requestedBy,
          photo: data.userPhoto || generateDefaultAvatar(data.requestedBy),
          message: data.message || ''
        };
        
        console.log('Adding requester data:', {
          request_id: requesterData.request_id,
          name: requesterData.name,
          photo: requesterData.photo ? '[PHOTO DATA]' : null,
          message: requesterData.message
        });
        
        const { data: requesterResult, error: requesterError } = await supabase
          .from('requesters')
          .insert(requesterData)
          .select();
          
        if (requesterError) {
          console.error('Error adding requester:', requesterError);
          if (requesterError.message.includes('payload string too long')) {
            throw new Error('Profile photo is too large. Please use a smaller image (max 300KB).');
          }
          throw requesterError;
        }
        
        console.log('Successfully added requester:', requesterResult);
      }
      
      toast.success('Your request has been added to the queue!');
    }
    
    return true;
  } catch (error) {
    console.error('Error submitting request:', error);
    
    if (error instanceof Error) {
      const errorMsg = error.message.includes('rate limit') 
        ? 'Too many requests. Please try again later.'
        : error.message || 'Failed to submit request. Please try again.';
      toast.error(errorMsg);
    } else {
      toast.error('Failed to submit request. Please try again.');
    }
    
    return false;
  }
}, []);

// ... (rest of the component remains the same)