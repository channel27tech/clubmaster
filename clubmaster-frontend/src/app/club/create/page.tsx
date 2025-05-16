'use client';
import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function CreateClubPage() {
  const router = useRouter();
  const [clubData, setClubData] = useState({
    name: '',
    location: '',
    type: 'Public',
    description: '',
    ratingLimit: 100
  });
  const [errors, setErrors] = useState({
    name: false,
    location: false
  });
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setClubData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing in a field
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: false }));
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate the form
    if (!validateForm()) {
      // If validation fails, don't proceed
      return;
    }
    
    // Here you would typically send the data to your backend
    console.log('Club data submitted:', clubData);
    // Show success screen only if validation passes
    setShowSuccess(true);
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
    // Navigate to club created detail view
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

        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="flex mb-5">
            {/* Left Column - Club Icon */}
            <div className="flex flex-col items-center mr-5">
              <p className="text-[#D9D9D9] mb-2 justify-center text-sm">Club Icon</p>
              <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center mb-2 bg-[#E8E6CF]">
                <Image 
                  src="/images/club-icon.svg"
                  alt="Club Icon"
                  width={80}
                  height={80}
                  className="w-12 h-12 object-cover"
                />
              </div>
              <button 
                type="button" 
                className="text-white text-xs py-1 px-3 bg-[#4A7C59] rounded"
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
              className="py-2 px-6 rounded-md bg-[#4A7C59] text-white text-sm font-medium"
            >
              Create
            </button>
            <button 
              type="button" 
              className="py-2 px-6 rounded-md bg-transparent text-white text-sm font-medium border border-[#4A7C59]"
              onClick={handleCancel}
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
                value="https://t.me/Free_Educational_Resources/525/526"
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