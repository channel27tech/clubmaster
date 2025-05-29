'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import { createClub } from '../../../services/clubService';

export default function CreateClubPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [firebaseToken, setFirebaseToken] = useState<string | null>(null);
  const [clubData, setClubData] = useState({
    name: '',
    location: '',
    type: 'public', // Changed to match backend enum values
    description: '',
    logo: '/images/club-icon.svg', // Default logo
    ratingLimit: 1000
  });
  const [errors, setErrors] = useState({
    name: false,
    location: false
  });
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [clubLink, setClubLink] = useState('');
  const linkRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewLogo, setPreviewLogo] = useState('/images/club-icon.svg');

  // Get Firebase token when component mounts
  useEffect(() => {
    const getToken = async () => {
      if (user) {
        try {
          const token = await user.getIdToken();
          setFirebaseToken(token);
        } catch (error) {
          console.error('Error getting Firebase token:', error);
          setApiError('Authentication error. Please try again.');
        }
      }
    };
    
    getToken();
  }, [user]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setApiError('Please select an image file');
      return;
    }
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setApiError('Image size must be less than 2MB');
      return;
    }
    
    // Read the file and convert to base64
    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      if (reader.result && typeof reader.result === 'string') {
        // Update preview
        setPreviewLogo(reader.result);
        // Update club data
        setClubData(prev => ({ 
          ...prev, 
          logo: reader.result as string 
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUploadButtonClick = () => {
    // Trigger the hidden file input
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setClubData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing in a field
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: false }));
    }
    
    // Clear API error when user makes changes
    if (apiError) {
      setApiError('');
    }
  };

  const handleRatingChange = (value: number) => {
    // Ensure rating is within bounds (0-3000)
    const newRating = Math.max(0, Math.min(3000, value));
    setClubData(prev => ({ ...prev, ratingLimit: newRating }));
  };

  const incrementRating = () => {
    handleRatingChange(clubData.ratingLimit + 50);
  };

  const decrementRating = () => {
    handleRatingChange(clubData.ratingLimit - 50);
  };

  // Map frontend type values to backend enum values
  const mapTypeToBackend = (frontendType: string): string => {
    const typeMap: Record<string, string> = {
      'Public': 'public',
      'Private (by rating)': 'private_by_rating',
      'Private (by location)': 'private_by_location',
      'Private (by invite link)': 'private_by_invite'
    };
    return typeMap[frontendType] || 'public';
  };

  const handleTypeSelect = (type: string) => {
    setClubData(prev => ({ ...prev, type }));
    setShowDropdown(false);
  };

  const validateForm = () => {
    const newErrors = {
      name: !clubData.name.trim(),
      location: !clubData.location.trim()
    };
    
    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate the form
    if (!validateForm()) {
      // If validation fails, don't proceed
      return;
    }
    
    // Verify authentication
    if (!user) {
      setApiError('User not authenticated');
      return;
    }
    const token = await user.getIdToken();
    if (!token) {
      alert('No Firebase token found. Please log in again.');
      setApiError('No Firebase token found.');
      return;
    }
    console.log('Club creation token:', token);
    console.log('Club creation Authorization header:', `Bearer ${token}`);
    
    // Clear any previous errors
    setApiError('');
    
    // Set loading state
    setIsLoading(true);
    
    try {
      // Prepare the data for the backend API
      const backendData = {
        name: clubData.name,
        location: clubData.location,
        description: clubData.description || null,
        logo: clubData.logo,
        type: clubData.type === 'public' ? 'public' : mapTypeToBackend(clubData.type),
        ratingLimit: clubData.ratingLimit,
      };
      
      // Log the user-entered rating limit
      console.log('User-entered rating limit:', clubData.ratingLimit);
      
      // Make the API call to create the club
      const responseData = await createClub(backendData, token);
      console.log('Club created successfully:', responseData);
      
      // Generate club link
      const clubId = responseData.id;
      setClubLink(`${window.location.origin}/club/join/${clubId}`);
      
      // Show success message
    setShowSuccess(true);
      
      // Reset form
      setClubData({
        name: '',
        location: '',
        type: 'public',
        description: '',
        logo: '/images/club-icon.svg',
        ratingLimit: 1000
      });
      
    } catch (error: any) {
      console.error('Error creating club:', error);
      
      // Handle specific error responses
      if (axios.isAxiosError(error) && error.response) {
        // Handle specific status codes
        if (error.response.status === 400) {
          // Handle 'User already owns a club' or other validation errors
          setApiError(error.response.data.message || 'Failed to create club. Please try again.');
        } else if (error.response.status === 401) {
          setApiError('Authentication error. Please log in again.');
        } else {
          setApiError('Server error. Please try again later.');
        }
      } else {
        setApiError('Failed to connect to server. Please check your internet connection.');
      }
    } finally {
      // Reset loading state
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // Navigate back to clubs view without creating
    router.push('/club/clubs');
  };

  const handleCopyLink = () => {
    if (linkRef.current) {
      linkRef.current.select();
      document.execCommand('copy');
      // Could add a toast notification here
      console.log('Link copied to clipboard');
    }
  };

  const handleDone = () => {
    // Navigate to club created detail view using next.js router
    router.push('/club/created-detail');
  };

  return (
    <div className="min-h-screen bg-[#333939] flex flex-col w-full max-w-[400px] mx-auto relative">
      {/* Header */}
      <div className="bg-[#333939] p-4 flex items-center">
        <button 
          onClick={() => router.push('/club/clubs')} 
          className="text-[#BFC0C0] mr-4"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <h1 className="text-[#FAF3DD] text-xl font-medium flex-1 text-center mr-6">Club</h1>
      </div>

      {/* Form Content */}
      <div className="flex-1 px-4 py-5">
        <h2 className="text-[#D9D9D9] text-base font-medium mb-2">Create your club</h2>
        <div className="h-px bg-[#505454] w-full mb-5"></div>

        {/* API Error Message */}
        {apiError && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-md">
            <p className="text-red-400 text-sm">{apiError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="flex mb-5">
            {/* Left Column - Club Icon */}
            <div className="flex flex-col items-center mr-5">
              <p className="text-[#D9D9D9] mb-2 justify-center text-sm">Club Icon</p>
              <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center mb-2 bg-[#E8E6CF]">
                <Image 
                  src={previewLogo}
                  alt="Club Icon"
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileInput}
                className="hidden"
              />
              <button 
                type="button" 
                className="text-white text-xs py-1 px-3 bg-[#4A7C59] rounded"
                onClick={handleUploadButtonClick}
              >
                Upload Image
              </button>
              
              {/* Rating Limit - only visible when "Private (by rating)" is selected */}
              {clubData.type === 'Private (by rating)' && (
                <div className="mt-3 w-full ">
                  <p className="text-[#D9D9D9] mb-1 text-center text-sm">Rating limit</p>
                  <div className="flex items-center justify-center">
                    <button 
                      type="button"
                      onClick={decrementRating}
                      className="bg-[#4C5454] w-6 h-6 flex items-center justify-center text-[#D9D9D9] rounded-l-md"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                      </svg>
                    </button>
                    <div className="bg-[#4C5454] w-12 h-6 flex items-center justify-center text-[#D9D9D9] text-sm">
                      {clubData.ratingLimit}
                    </div>
                    <button 
                      type="button"
                      onClick={incrementRating}
                      className="bg-[#4C5454] w-6 h-6 flex items-center justify-center text-[#D9D9D9] rounded-r-md"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Name, Location, Type */}
            <div className="flex-1 flex mt-4.5 flex-col">
              <div className="mb-4">
                <label htmlFor="clubName" className="block text-[#D9D9D9] mb-1 text-sm">
                  Club name <span className="text-red-500">*</span>
                </label>
                <input
                  id="clubName"
                  name="name"
                  type="text"
                  placeholder="Name"
                  value={clubData.name}
                  onChange={handleChange}
                  className={`w-full py-1 px-3 rounded ${errors.name ? 'bg-[#4C5454] border border-red-500' : 'bg-[#4C5454] border border-transparent'} text-[#D9D9D9] placeholder-[#D9D9D9] text-sm outline-none`}
                />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1">Club name is required</p>
                )}
              </div>
              
              <div className="mb-3">
                <label htmlFor="location" className="block text-[#D9D9D9] mb-1 text-sm">
                  Location <span className="text-red-500">*</span>
                </label>
                <input
                  id="location"
                  name="location"
                  type="text"
                  placeholder="India"
                  value={clubData.location}
                  onChange={handleChange}
                  className={`w-full py-1 px-3 rounded ${errors.location ? 'bg-[#4C5454] border border-red-500' : 'bg-[#4C5454] border border-transparent'} text-[#D9D9D9] placeholder-[#D9D9D9] text-sm outline-none`}
                />
                {errors.location && (
                  <p className="text-red-500 text-xs mt-1">Location is required</p>
                )}
              </div>
              
              <div className="mb-3 relative">
                <label htmlFor="clubType" className="block text-[#D9D9D9] mb-1 text-sm">Club Type</label>
                <button 
                  type="button"
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="w-full py-1 px-3 rounded bg-[#4C5454] text-[#D9D9D9] text-sm text-left relative border border-transparent"
                >
                  {clubData.type}
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-4 w-4 absolute right-2 top-1/2 transform -translate-y-1/2" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showDropdown && (
                  <div className="absolute z-10 mt-1 w-full rounded bg-[#333939] border border-[#4C5454] shadow-lg">
                    <div className="bg-[#1F2323]">
                      <button 
                        type="button" 
                        className="w-full items-center px-3 py-2 text-[#D9D9D9] text-sm hover:bg-[#4C5454]"
                        onClick={() => handleTypeSelect('Public')}
                      >
                        Public
                      </button>
                      <button 
                        type="button" 
                        className="w-full text-center px-3 py-2 text-[#D9D9D9] text-sm hover:bg-[#4C5454]"
                        onClick={() => handleTypeSelect('Private (by rating)')}
                      >
                        Private (by rating)
                      </button>
                      <button 
                        type="button" 
                        className="w-full text-center px-3 py-2 text-[#D9D9D9] text-sm hover:bg-[#4C5454]"
                        onClick={() => handleTypeSelect('Private (by location)')}
                      >
                        Private (by location)
                      </button>
                      <button 
                        type="button" 
                        className="w-full text-center px-3 py-2 text-[#D9D9D9] text-sm hover:bg-[#4C5454]"
                        onClick={() => handleTypeSelect('Private (by invite link)')}
                      >
                        Private (by invite link)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="mb-6">
            <label htmlFor="description" className="block text-[#D9D9D9] mb-1 text-sm">Description (optional)</label>
            <textarea
              id="description"
              name="description"
              value={clubData.description}
              onChange={handleChange}
              rows={5}
              className="w-full py-2 px-3 rounded bg-[#4C5454] text-[#D9D9D9] resize-none border-none outline-none"
              placeholder="Tell us about your club..."
            />
          </div>

          <div className="flex gap-4 mt-auto">
            <button 
              type="submit" 
              className={`py-2 px-6 rounded-md ${isLoading ? 'bg-[#4A7C59]/70' : 'bg-[#4A7C59]'} text-white text-sm font-medium flex items-center justify-center`}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </>
              ) : (
                'Create'
              )}
            </button>
            <button 
              type="button" 
              className="py-2 px-6 rounded-md bg-transparent text-white text-sm font-medium border border-[#4A7C59]"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* Success Overlay */}
      {showSuccess && (
        <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm bg-black/60">
          <div className="bg-[#333939] rounded-lg p-5 w-full max-w-sm mx-4">
            <h3 className="text-[#FAF3DD] text-xl font-medium text-center mb-2">Club Created Successfully!</h3>
            <p className="text-[#D9D9D9] text-sm mb-4 text-center">
              Your club has been created successfully. You can now add members by sending invitations.
            </p>
            
            <div className="bg-[#333939] rounded-full border border-dashed border-[#E9CB6B] flex items-center overflow-hidden mb-5 mx-2">
              <input
                ref={linkRef}
                type="text"
                readOnly
                value={clubLink || "https://clubmaster.app/invite/123456"}
                className="flex-1 bg-transparent text-[#D9D9D9] text-sm py-3 px-4 border-none outline-none truncate"
              />
              <button 
                onClick={handleCopyLink}
                className="p-2 pr-3 text-white"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="9" y="9" width="10" height="10" rx="2" stroke="#D9D9D9" strokeWidth="1.5"/>
                  <rect x="5" y="5" width="10" height="10" rx="2" stroke="#D9D9D9" strokeWidth="1.5"/>
                </svg>
              </button>
            </div>
            
            <button 
              onClick={handleDone}
              className="w-full py-3 rounded-md bg-[#4A7C59] text-white text-base font-medium"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 