'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import BottomNavigation from '../../components/BottomNavigation';
import { useClub } from '../../context/ClubContext';

// Define Player type
type Player = {
  rank: number;
  name: string;
  avatar: string;
  icon: string | null;
  rating: number;
};

// Define admin players with specific icons
const adminPlayers = [
  { rank: 1, name: 'Salih', avatar: '/images/salih icon.svg', icon: '/images/crown.svg', rating: 2100 },
  { rank: 2, name: 'Abhinadh', avatar: '/images/abhi icon.svg', icon: null, rating: 1800 },
  { rank: 3, name: 'Umershan', avatar: '/images/umer icon.svg', icon: null, rating: 1700 },
  { rank: 4, name: 'Asif', avatar: '/images/asif icon.svg', icon: '/images/watch icon.svg', rating: 1500 },
  { rank: 5, name: 'Junaidh', avatar: '/images/junaidh icon.svg', icon: '/images/watch icon.svg', rating: 2000 },
  { rank: 6, name: 'Basith', avatar: '/images/basith icon.svg', icon: '/images/playing icon.svg', rating: 1500 },
  { rank: 7, name: 'Akhil', avatar: '/images/dp 1.svg', icon: null, rating: 1400 }
];

// Sample regular players data
const regularPlayers = [
  { rank: 1, name: 'Salih', avatar: '/images/dp 1.svg', icon: '/images/crown.svg', rating: 2100 },
  { rank: 2, name: 'Abhinadh', avatar: '/images/dp 2.svg', icon: null, rating: 1800 },
  { rank: 3, name: 'Umershan', avatar: '/images/dp 3.svg', icon: null, rating: 1700 },
  { rank: 4, name: 'Asif', avatar: '/images/dp 4.svg', icon: '/images/watch icon.svg', rating: 1500 },
  { rank: 5, name: 'Junaidh', avatar: '/images/dp 5.svg', icon: '/images/watch icon.svg', rating: 2000 },
  { rank: 6, name: 'Basith', avatar: '/images/dp 6.svg', icon: '/images/playing icon.svg', rating: 1500 },
  { rank: 7, name: 'Akhil', avatar: '/images/dp 1.svg', icon: null, rating: 1400 }
];

export default function ClubDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userType } = useClub();
  const [activeTab, setActiveTab] = useState('players');
  const [showMenu, setShowMenu] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  
  // Share link
  const shareLink = 'https://t.me/Free_Educational_Resources/525/526';

  // Check if admin mode is active
  const isAdmin = userType === 'admin' || searchParams.get('admin') === '1';

  // Select players based on admin status
  const players = isAdmin ? adminPlayers : regularPlayers;

  // Add useEffect to control body scroll
  useEffect(() => {
    if (showMenu || showLeaveConfirm || showShareModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [showMenu, showLeaveConfirm, showShareModal]);

  // Function to handle menu item clicks
  const handleMenuClick = (action: string) => {
    setShowMenu(false);
    switch (action) {
      case 'invite':
        router.push('/club/friends');
        break;
      case 'share':
        setShowShareModal(true);
        break;
      case 'edit':
        router.push('/club/edit');
        break;
      case 'leave':
        setShowLeaveConfirm(true);
        break;
    }
  };

  // Function to copy link to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      // Show some feedback
      console.log('Link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const handleLeaveConfirm = () => {
    setShowLeaveConfirm(false);
    // Handle leave club logic here
    router.push('/club/clubs'); // Navigate back to clubs page after leaving
  };

  // Helper for country flag (mocked for now)
  const getCountryFlag = (player: Player) => {
    // You can enhance this with real country data if available
    return '🇮🇳';
  };

  return (
    <div className={`min-h-screen bg-[#333939] flex flex-col w-full max-w-[400px] mx-auto relative ${showMenu || showLeaveConfirm || showShareModal ? 'overflow-hidden' : ''}`}>
      {/* Header */}
      <div className="bg-[#333939] p-4 flex items-center justify-between">
        <button 
          onClick={() => router.back()} 
          className="text-[#BFC0C0]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <div className="flex-1 flex justify-center">
          <Image
            src="/logo.svg"
            alt="Club Master Logo"
            width={118}
            height={48}
            priority
          />
        </div>
        <button 
          className="text-[#BFC0C0]"
          onClick={() => setShowMenu(!showMenu)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
          </svg>
        </button>
      </div>

      {/* Club Info Card */}
      <div className="mx-4 rounded-lg p-3 mb-3 relative" style={{
        background: 'linear-gradient(to left, #4A7C59, #4c5454)'
      }}>
        {/* Question mark icon */}
        <div className="absolute top-4 right-4">
          <div className="w-4 h-4 rounded-full bg-[#8FC0A9] flex items-center justify-center">
            <span className="text-[#1F2323] text-sm font-medium">?</span>
          </div>
        </div>
        
        <div className="flex">
          <div className="flex-1">
            <div className="flex items-center">
              <h2 className="text-[#E9CB6B] text-lg font-semibold">Athani Club</h2>
            </div>
            <div className="flex items-center text-[#D9D9D9] text-xs">
              <span>227 members</span>
              <div className="flex items-center mx-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="#8FC0A9" viewBox="0 0 24 24" className="w-3 h-3">
                  <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </div>
              <span>Ernakulam</span>
            </div>

            {/* Stats */}
            <div className="mt-2 space-y-0.5">
              <div className="flex items-center">
                <span className="text-[#E9CB6B] mr-1 text-sm">🥇</span>
                <span className="text-[#D9D9D9] text-xs">#23</span>
              </div>
              <div className="flex items-center">
                <span className="text-[#E9CB6B] mr-1 text-sm">👉</span>
                <span className="text-[#D9D9D9] text-xs">12,345 pts</span>
              </div>
              <div className="flex items-center">
                <span className="text-[#E9CB6B] mr-1 text-sm">⭐</span>
                <span className="text-[#D9D9D9] text-xs">115</span>
              </div>
            </div>

            {/* Description with Read More */}
            <div className="mt-1">
              <p className="text-[#D9D9D9] text-[10px]">
                Athani club since 2023 have ...
                <button className="text-[#D9D9D9] underline text-[10px] ml-1">
                  Read more
                </button>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-2.5 h-2.5 inline ml-1 text-[#D9D9D9]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </p>
            </div>
          </div>

          {/* Club Logo */}
          <div className="flex items-center justify-end mr-5">
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center border-2 border-[#E9CB6B]">
              <Image 
                src="/images/athani logo.svg"
                alt="Athani Club Logo"
                width={52}
                height={52}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex mx-4 mb-2">
        <button 
          className={`flex-1 text-center py-1 text-sm ${activeTab === 'players' ? 'text-[#FAF3DD] border-b-2 border-[#E9CB6B] font-medium' : 'text-[#D9D9D9]'}`}
          onClick={() => setActiveTab('players')}
        >
          Players
        </button>
        <button 
          className={`flex-1 text-center py-1 text-sm ${activeTab === 'tournaments' ? 'text-[#FAF3DD] border-b-2 border-[#E9CB6B] font-medium' : 'text-[#D9D9D9]'}`}
          onClick={() => setActiveTab('tournaments')}
        >
          Tournaments
        </button>
      </div>

      {/* Table Header - Fixed position */}
      <div className="mx-4 my-1 mb-2">
        <div className="flex py-2 bg-[#4C5454] rounded-lg text-[#D9D9D9]">
          <div className="w-16 text-xs text-center">Rank</div>
          <div className="flex-1 text-xs pl-12">Players</div>
          <div className="w-24 text-right text-xs pr-4">Rating</div>
        </div>
      </div>

      {/* Content area - explicitly non-scrollable container */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Player List - only this section scrollable without visible scrollbar */}
        {activeTab === 'players' && (
          <div 
            className="mx-4 mb-16 overflow-y-auto"
            style={{
              height: 'calc(100vh - 430px)',
              msOverflowStyle: 'none',
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <style jsx>{`
              div::-webkit-scrollbar {
                display: none;
              }
            `}</style>
            <div className="pb-10">
              {players.map((player, index) => (
                <div 
                  key={player.rank} 
                  className={`flex items-center py-2 ${index % 2 === 0 ? 'bg-[#333939]' : 'bg-[#3A4141]'} cursor-pointer`}
                  onClick={() => {
                    setSelectedPlayer(player);
                    setShowPlayerModal(true);
                  }}
                >
                  {/* Rank column */}
                  <div className="w-16 text-[#D9D9D9] text-xs text-center">#{player.rank}</div>
                  
                  {/* Players column with fixed width for consistent layout */}
                  <div className="flex-1 flex items-center">
                    <div className="w-9 h-9 rounded-full bg-white overflow-hidden mr-3">
                      <Image src={player.avatar} alt="Player Avatar" width={36} height={36} />
                    </div>
                    <span className="text-[#D9D9D9] text-sm">{player.name}</span>
                  </div>
                  
                  {/* Icon and Rating columns */}
                  <div className="flex items-center">
                    {/* Icon with fixed width area */}
                    <div className="w-30 flex justify-center">
                      {player.icon && (
                        <div className="relative group">
                          <Image src={player.icon} alt="Player Icon" width={22} height={17} />
                          {player.icon.includes('watch') && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-[#1F2323] text-[#D9D9D9] text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                              Watching a game
                            </div>
                          )}
                          {player.icon.includes('playing') && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-[#1F2323] text-[#D9D9D9] text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                              Playing a game
                            </div>
                          )}
                          {player.icon.includes('crown') && (
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 px-2 py-1 bg-[#1F2323] text-[#D9D9D9] text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                              Club master
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Rating column */}
                    <div className="w-16 text-right text-[#D9D9D9] pr-4 text-sm">{player.rating}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tournament Tab Content */}
        {activeTab === 'tournaments' && (
          <div className="mx-4 flex items-center justify-center text-[#D9D9D9] h-[200px]">
            <p>No tournaments available</p>
          </div>
        )}
      </div>

      {/* Overlay to close menu when clicking outside */}
      {showMenu && (
        <div className="fixed left-0 right-0 bottom-0 z-50 px-4 pb-0">
          <div className="mx-auto w-[370px] h-[240px] mb-8 bg-[#1A1E1D] rounded-[10px] pt-2 pb-2 flex flex-col shadow-lg">
            <button
              className="w-full text-center px-6 py-4 text-[#D9D9D9] text-base font-medium focus:outline-none"
              onClick={() => handleMenuClick('invite')}
            >
              Invite
            </button>
            <div className="h-[1px] bg-[#3A393C] mx-6" />
            <button
              className="w-full text-center px-6 py-4 text-[#D9D9D9] text-base font-medium focus:outline-none"
              onClick={() => handleMenuClick('share')}
            >
              Share Link
            </button>
            <div className="h-[1px] bg-[#3A393C] mx-6" />
            <button
              className="w-full text-center px-6 py-4 text-[#D9D9D9] text-base font-medium focus:outline-none"
              onClick={() => handleMenuClick('edit')}
            >
              Edit Club
            </button>
            <div className="h-[1px] bg-[#3A393C] mx-6" />
            <button
              className="w-full text-center px-6 py-4 text-[#D9D9D9] text-base font-medium focus:outline-none"
              onClick={() => handleMenuClick('leave')}
            >
              Leave Club
            </button>
          </div>
        </div>
      )}

      {/* Join Button or Create Tournament Button - Fixed position above footer */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[400px] px-4 py-3 z-20">
        {isAdmin ? (
          <button 
            onClick={() => router.push('/club/tournament/create')} 
            className="w-full py-3 rounded-[10px] bg-[#4A7C59] text-[#FAF3DD] font-medium border-2 border-[#E9CB6B]"
          >
            Create Tournament
          </button>
        ) : (
          <button 
            onClick={() => router.push('/club/detail')} 
            className="w-full py-3 rounded-lg bg-[#4A7C59] text-[#FAF3DD] font-medium border border-[#E9CB6B]"
          >
            Join
          </button>
        )}
      </div>

      {/* Bottom Navigation */}
      {!showMenu && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[400px] z-10">
          <BottomNavigation />
        </div>
      )}

      {/* Player Modal */}
      {showPlayerModal && selectedPlayer && (
        <>
          {/* Blurred background */}
          <div className="fixed inset-0 z-40 backdrop-blur-[1px]" onClick={() => setShowPlayerModal(false)}></div>
          {/* Centered modal card */}
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="bg-[#4C5454] rounded-[16px] w-[320px] max-w-[90vw] px-6 py-7 flex flex-col items-center shadow-2xl relative">
              <div className="w-20 h-20 rounded-full bg-white overflow-hidden mb-4 flex items-center justify-center">
                <Image src={selectedPlayer.avatar} alt="Player Avatar" width={70} height={70} />
              </div>
              <div className="text-[#D9D9D9] text-lg font-semibold mb-1 text-center">{selectedPlayer.name}</div>
              <div className="text-[#D9D9D9] text-sm mb-4 text-center">
                ({selectedPlayer.rating || 308}) &nbsp; {getCountryFlag(selectedPlayer)}
              </div>
              <button className="w-full py-3 rounded-[10px] bg-[#4A7C59] text-[#FAF3DD] font-medium text-base mb-3">
                View Profile
              </button>
              <button className="w-full py-3 rounded-[10px] bg-[#4A7C59] text-[#FAF3DD] font-medium text-base" style={{border: '2px solid #4A7C59'}}>
                Remove From Club
              </button>
            </div>
          </div>
        </>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <>
          <div 
            className="fixed inset-0 flex items-center justify-center z-50"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
            onClick={() => setShowShareModal(false)}
          >
            <div 
              className="bg-[#333939] p-4 rounded-lg shadow-xl flex flex-col items-center justify-around"
              style={{ width: '373px', height: '146px' }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-1" style={{ color: '#FAF3DD' }}>Share</h3>
              <div className="mb-3 flex items-center bg-[#333939] rounded-full border border-dashed border-[#E9CB6B] overflow-hidden"
                style={{ width: '341px', height: '42px' }}
              >
                <input 
                  type="text" 
                  readOnly 
                  value={shareLink} 
                  className="flex-1 bg-transparent text-[#FAF3DD] text-xs py-2 px-4 border-none outline-none truncate"
                  style={{ color: '#FAF3DD' }}
                />
                <button 
                  className="p-2 flex items-center justify-center bg-[#333939] rounded-full border-none outline-none"
                  onClick={copyToClipboard}
                  title="Copy link"
                  style={{ minWidth: '36px', minHeight: '36px' }}
                >
                  <Image src="/images/copy icon.svg" alt="Copy" width={18} height={18} />
                </button>
              </div>
              <button 
                className=""
                title="Share via other apps"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: 'Club Master Club Link',
                      text: 'Check out this club on Club Master!',
                      url: shareLink,
                    })
                    .then(() => console.log('Successful share'))
                    .catch((error) => console.log('Error sharing', error));
                  } else {
                    copyToClipboard();
                  }
                }}
              >
                <Image src="/images/share icon.svg" alt="Share" width={22} height={22} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 