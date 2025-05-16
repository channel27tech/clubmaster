'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import BottomNavigation from '../../components/BottomNavigation';

// Array of profile images
const profileImages = [
  '/images/dp 1.svg',
  '/images/dp 2.svg',
  '/images/dp 3.svg',
  '/images/dp 4.svg',
  '/images/dp 5.svg'
];

const clubData = [
  {
    id: 1,
    name: 'Black Panther',
    members: 227,
    location: 'Ernakulam',
    rank: '#23',
    points: '12,345 pts',
    logo: '/images/black-panther.jpg',
    locked: false
  },
  {
    id: 2,
    name: 'Fradel and Spies',
    members: 227,
    location: 'Thrissur',
    rank: '#23',
    points: '12,345 pts',
    logo: '/images/fradel.jpg',
    locked: true
  },
  {
    id: 3,
    name: 'Check Mate',
    members: 227,
    location: 'Ernakulam',
    rank: '#53',
    points: '12,345 pts',
    logo: '/images/check-mate.jpg',
    locked: true
  },
  {
    id: 4,
    name: 'Chess Master',
    members: 227,
    location: 'Aluva',
    rank: '#33',
    points: '12,345 pts',
    logo: '/images/chess-master.jpg',
    locked: false
  },
  {
    id: 5,
    name: 'Black Panther',
    members: 227,
    location: 'Ernakulam',
    rank: '#23',
    points: '12,345 pts',
    logo: '/images/black-panther.jpg',
    locked: false
  }
];

export default function ClubsView() {
  const router = useRouter();
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Toggle filter menu
  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  // Set active filter
  const handleFilterSelect = (filter: string) => {
    setActiveFilter(filter);
    // Here you would add logic to actually filter the clubs
    // For now, we'll just close the filter menu
    setShowFilters(false);
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Filter clubs based on search query and active filter
  const filteredClubs = clubData.filter(club => {
    // If no search query, return all clubs
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase().trim();
    
    // Search by name
    if (club.name.toLowerCase().includes(query)) return true;
    
    // Search by location
    if (club.location.toLowerCase().includes(query)) return true;
    
    // Search by rank
    if (club.rank.toLowerCase().includes(query)) return true;
    
    return false;
  });

  return (
    <div className="min-h-screen bg-[#333939] flex flex-col w-full max-w-[400px] mx-auto relative">
      {/* Fixed top section */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[400px] z-10">
        {/* Header */}
        <div className="bg-[#333939] px-[21px] py-4 flex items-center">
          <button 
            onClick={() => router.push('/club')} 
            className="text-[#BFC0C0] mr-4"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <h1 
            className="text-[#FAF3DD] text-xl flex-1 text-center mr-6"
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: '600',
              fontSize: '22px'
            }}
          >
            Clubs view
          </h1>
        </div>

        {/* Create Club Button - with updated styling */}
        <div className="px-[21px] py-1 bg-[#333939]">
          <button 
            onClick={() => router.push('/club/create')}
            className="w-full h-[57px] bg-[#4A7C59] text-[#FAF3DD] border-2 border-[#E9CB6B]"
            style={{ 
              borderRadius: '0.75rem',
              fontFamily: 'Roboto, sans-serif',
              fontWeight: '500',
              fontSize: '18px'
            }}
          >
            Create club
          </button>
        </div>

        {/* Search Bar - with updated styling */}
        <div className="px-[21px] pb-2 pt-1 flex gap-2 bg-[#333939]">
          <div 
            className="flex items-center bg-[#4C5454] px-3 py-2 flex-1 w-[329px] h-[43px]"
            style={{ borderRadius: '0.75rem' }}
          >
            <input
              className="flex-1 bg-transparent outline-none text-[#D9D9D9] placeholder-[#D9D9D9]"
              placeholder="Search..."
              value={searchQuery}
              onChange={handleSearchChange}
              style={{
                fontFamily: 'Roboto, sans-serif',
                fontWeight: '400',
                fontSize: '14px'
              }}
            />
            {searchQuery && (
              <button 
                className="text-[#D9D9D9] mr-2"
                onClick={() => setSearchQuery('')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <button className="text-[#D9D9D9]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </button>
          </div>
          <button 
            className={`bg-[#4C5454] p-2 w-[43px] h-[43px] flex items-center justify-center ${showFilters ? 'bg-[#4A7C59]' : 'bg-[#4C5454]'}`}
            style={{ borderRadius: '0.75rem' }}
            onClick={toggleFilters}
          >
            <Image 
              src="/images/filter icon.svg"
              alt="Filter"
              width={22}
              height={19}
              className="w-6 h-6"
            />
          </button>
        </div>

        {/* Filter Options - Only shown when filter button is clicked */}
        {showFilters && (
          <div className="bg-[#1F2323] absolute right-[21px] mt-1 w-56 rounded-lg shadow-lg z-20 border border-[#505454] overflow-hidden">
            <div className="p-1">
              <button 
                onClick={() => handleFilterSelect('location')}
                className={`w-full text-center py-2.5 px-3 rounded-md text-sm ${activeFilter === 'location' ? 'bg-[#4A7C59] text-[#FAF3DD]' : 'text-[#D9D9D9] hover:bg-[#4C5454]'}`}
              >
                By location
              </button>
              <button 
                onClick={() => handleFilterSelect('points')}
                className={`w-full text-center py-2.5 px-3 rounded-md text-sm ${activeFilter === 'points' ? 'bg-[#4A7C59] text-[#FAF3DD]' : 'text-[#D9D9D9] hover:bg-[#4C5454]'}`}
              >
                By club points
              </button>
              <button 
                onClick={() => handleFilterSelect('members')}
                className={`w-full text-center py-2.5 px-3 rounded-md text-sm ${activeFilter === 'members' ? 'bg-[#4A7C59] text-[#FAF3DD]' : 'text-[#D9D9D9] hover:bg-[#4C5454]'}`}
              >
                By number of members
              </button>
              <button 
                onClick={() => handleFilterSelect('type')}
                className={`w-full text-center py-2.5 px-3 rounded-md text-sm ${activeFilter === 'type' ? 'bg-[#4A7C59] text-[#FAF3DD]' : 'text-[#D9D9D9] hover:bg-[#4C5454]'}`}
              >
                By club type
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Scrollable Club List - adjusted top padding to match the new spacing */}
      <div className="flex-1 px-[21px] pb-16 pt-44 overflow-y-auto">
        {filteredClubs.length > 0 ? (
          filteredClubs.map((club, index) => (
            <div 
              key={club.id} 
              className="bg-[#4C5454] overflow-hidden p-3 flex items-center mb-3 mt-1 cursor-pointer" 
              style={{ borderRadius: '0.75rem' }}
              onClick={() => router.push('/club/preview')}
            >
              <div className="w-[70px] h-[70px] rounded-full overflow-hidden bg-white flex-shrink-0 mr-4">
                {/* Use the profile images in the specified order, rotating if needed */}
                <Image 
                  src={profileImages[index % profileImages.length]}
                  alt={`${club.name} profile`}
                  width={70}
                  height={70}
                  className="w-full h-full object-cover"
                />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center">
                  <h3 
                    className="text-[#FAF3DD]"
                    style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontWeight: '600',
                      fontSize: '18px'
                    }}
                  >
                    {club.name}
                  </h3>
                  {club.locked && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[#8FC0A9] ml-2">
                      <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                
                <div className="flex text-xs items-center mt-1">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 mr-1 text-[#8FC0A9]">
                    <path fillRule="evenodd" d="M8.25 6.75a3.75 3.75 0 117.5 0 3.75 3.75 0 01-7.5 0zM15.75 9.75a3 3 0 116 0 3 3 0 01-6 0zM2.25 9.75a3 3 0 116 0 3 3 0 01-6 0zM6.31 15.117A6.745 6.745 0 0112 12a6.745 6.745 0 016.709 7.498.75.75 0 01-.372.568A12.696 12.696 0 0112 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 01-.372-.568 6.787 6.787 0 011.019-4.38z" clipRule="evenodd" />
                    <path d="M5.082 14.254a8.287 8.287 0 00-1.308 5.135 9.687 9.687 0 01-1.764-.44l-.115-.04a.563.563 0 01-.373-.487l-.01-.121a3.75 3.75 0 013.57-4.047zM20.226 19.389a8.287 8.287 0 00-1.308-5.135 3.75 3.75 0 013.57 4.047l-.01.121a.563.563 0 01-.373.486l-.115.04c-.567.2-1.156.349-1.764.441z" />
                  </svg>
                  <span 
                    className="text-[#D9D9D9]"
                    style={{
                      fontFamily: 'Roboto, sans-serif',
                      fontWeight: '500',
                      fontSize: '12px'
                    }}
                  >
                    {club.members} members
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 ml-3 mr-1 text-[#8FC0A9]">
                    <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                  <span 
                    className="text-[#D9D9D9]"
                    style={{
                      fontFamily: 'Roboto, sans-serif',
                      fontWeight: '500',
                      fontSize: '12px'
                    }}
                  >
                    {club.location}
                  </span>
                </div>
                
                <div className="flex mt-2 text-xs items-center">
                  {/* Achievement rank icon and rank */}
                  <Image 
                    src="/images/rank icon.svg"
                    alt="Rank"
                    width={15}
                    height={15}
                    className="mr-2"
                  />
                  <span 
                    className="text-[#D9D9D9]"
                    style={{
                      fontFamily: 'Roboto, sans-serif',
                      fontWeight: '700',
                      fontSize: '12px'
                    }}
                  >
                    {club.rank}
                  </span>
                  
                  {/* Pointing finger instead of check mark */}
                  <span className="mx-3 text-amber-400">👉</span>
                  
                  {/* Points with updated color */}
                  <span 
                    className="text-[#D9D9D9]"
                    style={{
                      fontFamily: 'Roboto, sans-serif',
                      fontWeight: '700',
                      fontSize: '12px'
                    }}
                  >
                    {club.points}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-[300px] text-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 text-[#4A7C59] mb-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <p className="text-[#FAF3DD] text-lg font-medium mb-2">No clubs found</p>
            <p className="text-[#D9D9D9] text-sm">Try a different search term or filter</p>
          </div>
        )}
      </div>

      {/* Overlay to close filter menu when clicking outside */}
      {showFilters && (
        <div 
          className="fixed inset-0 z-10" 
          onClick={() => setShowFilters(false)}
        ></div>
      )}

      {/* Fixed bottom navigation */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[400px] z-10">
        <BottomNavigation />
      </div>
    </div>
  );
} 