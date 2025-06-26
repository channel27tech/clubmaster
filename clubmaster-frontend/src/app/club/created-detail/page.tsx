'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import BottomNavigation from '../../components/BottomNavigation';
import { useAuth } from '../../../context/AuthContext';
import { ShareLinkModal } from '../share-link/page';
import { TournamentOptionsModal } from '../../tournament-modals';

// Define club type
interface ClubData {
  id: number;
  name: string;
  location: string;
  description?: string;
  logo: string;
  type: string;
  points: number;
  credits: number;
  superAdminId: number;
  rank?: number;
}

interface ClubMember {
  id: string;
  firebaseUid: string;
  displayName: string;
  photoURL: string;
  rating: number;
  role: string;
  userId: string;
}

export default function ClubCreatedDetailPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [club, setClub] = useState<ClubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('players');
  const [authChecked, setAuthChecked] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);  
  const [members, setMembers] = useState<any[]>([]);
  const [showTournamentModal, setShowTournamentModal] = useState(false);

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    if (user !== null) setAuthChecked(true);
  }, [user]);

  useEffect(() => {
    console.log('createdClub:', club);
    console.log('user:', user);
    if (!authChecked) return;
    if (!club && user) {
      const fetchClub = async () => {
        setLoading(true);
        try {
          const token = await user.getIdToken();
          console.log('Firebase token:', token);
          const res = await fetch('http://localhost:3001/club-member/my', {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          console.log('Fetch response:', res);
          if (!res.ok) throw new Error('Failed to fetch club');
          const data = await res.json();
          if (data && data.club) {
            setClub(data.club);
          } else {
            router.replace('/club/clubs');
          }
        } catch (err) {
          console.error('Error fetching club:', err);
          router.replace('/club/clubs');
        } finally {
          setLoading(false);
        }
      };
      fetchClub();
    } else if (!club && authChecked && !user) {
      router.replace('/club/clubs');
    }
  }, [club, user, authChecked, router]);
  
  useEffect(() => {
    if (!club) return;
    fetch(`${backendUrl}/club/${club.id}`)
      .then(res => res.json())
      .then(data => {
        setMembers(data.members || []);
      });
  }, [club]);

  // Debug logs for role check
  console.log('user?.uid:', user?.uid);
  console.log('members:', members);
  const myMembership = members.find(m => m.firebaseUid === user?.uid);
  console.log('myMembership:', myMembership);
  const isSuperAdmin = myMembership?.role === 'super_admin';
  console.log('isSuperAdmin:', isSuperAdmin);

  // Remove duplicate members by firebaseUid
  const uniqueMembers = Array.from(new Map(members.map(m => [m.firebaseUid, m])).values());

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#333939] flex items-center justify-center">
        <p className="text-[#D9D9D9]">Checking authentication...</p>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#333939] flex items-center justify-center">
        <p className="text-[#D9D9D9]">Loading club data...</p>
      </div>
    );
  }
  
  if (!club) {
    return null;
  }
  
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
      case 'leave':
        setShowLeaveConfirm(true);
        break;
    }
  };

  const handleLeaveConfirm = () => {
    setShowLeaveConfirm(false);
    // Handle leave club logic here
    router.push('/club/clubs'); // Navigate back to clubs page after leaving
  };

  const handleBecomeClubmaster = async (date: string, time: string) => {
    setShowTournamentModal(false);
    // TODO: Implement become clubmaster logic
    console.log('Become Clubmaster clicked', { date, time });
  };

  return (
    <div className="min-h-screen bg-[#333939] flex flex-col w-full max-w-[430px] mx-auto relative">
      {/* Header */}
      <div className="bg-[#333939] p-4 flex items-center justify-between">
        <button 
          onClick={() => router.push('/club')} 
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
        {/* Only render admin controls after user and members are loaded */}
        {user && members.length > 0 && isSuperAdmin && (
          <button 
            className="text-[#BFC0C0]"
            onClick={() => setShowMenu(!showMenu)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
            </svg>
          </button>
        )}
      </div>

      {/* Club Info Card - Now with real club data */}
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
              <h2 className="text-[#E9CB6B] text-lg font-semibold">{club.name}</h2>
            </div>
            <div className="flex items-center text-[#D9D9D9] text-xs">
              <span>{members.length} members</span>
              <div className="flex items-center mx-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="#8FC0A9" viewBox="0 0 24 24" className="w-3 h-3">
                  <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </div>
              <span>{club.location}</span>
            </div>

            {/* Stats */}
            <div className="mt-2 space-y-0.5">
              <div className="flex items-center">
                <span className="text-[#E9CB6B] mr-1 text-sm">🥇</span>
                <span className="text-[#D9D9D9] text-xs">New Club</span>
              </div>
              <div className="flex items-center">
                <span className="text-[#E9CB6B] mr-1 text-sm">👉</span>
                <span className="text-[#D9D9D9] text-xs">{club.points || 0} pts</span>
              </div>
              <div className="flex items-center">
                <span className="text-[#E9CB6B] mr-1 text-sm">⭐</span>
                <span className="text-[#D9D9D9] text-xs">{club.credits || 0}</span>
              </div>
            </div>

            {/* Description with Read More */}
            <div className="mt-1">
              <p className="text-[#D9D9D9] text-[10px]">
                {club.description ? (
                  <>
                    {club.description.substring(0, 50)}
                    {club.description.length > 50 && (
                      <>
                        ...
                <button className="text-[#D9D9D9] underline text-[10px] ml-1">
                  Read more
                </button>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-2.5 h-2.5 inline ml-1 text-[#D9D9D9]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                      </>
                    )}
                  </>
                ) : (
                  'No description available'
                )}
              </p>
            </div>
          </div>

          {/* Club Logo */}
          <div className="flex items-center justify-end mr-5">
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center border-2 border-[#E9CB6B]">
              <Image 
                src={club?.logo?.startsWith('http') ? club.logo : `${backendUrl}${club?.logo || '/uploads/default-logo.png'}`}
                alt={`${club.name} Logo`}
                width={52}
                height={52}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-[#505454] mx-4 mb-2">
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

      {/* Table Header */}
      <div className="mx-4 my-1 mb-2">
        <div className="flex py-2 bg-[#4C5454] rounded-lg text-[#D9D9D9]">
          <div className="w-16 text-xs text-center">Rank</div>
          <div className="flex-1 text-xs pl-12">Players</div>
          <div className="w-24 text-right text-xs pr-4">Rating</div>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="pt-2 pb-[24px] overflow-y-auto flex-1 mb-[76px]">
        {/* Player List */}
        {activeTab === 'players' && (
          <div className="mx-4 mb-4">
            {uniqueMembers.map((member, idx) => (
              <div key={member.firebaseUid} className="flex items-center py-2 bg-transparent">
                <div className="w-16 text-[#D9D9D9] text-xs text-center">#{idx + 1}</div>
                <div className="flex-1 flex items-center">
                  <div className="w-9 h-9 rounded-full bg-white overflow-hidden mr-3">
                    <Image src={member.photoURL || "/images/default-avatar.svg"} alt="Player Avatar" width={36} height={36} />
                  </div>
                  <span className="text-[#D9D9D9] text-sm">{member.displayName}</span>
                  {member.role === 'super_admin' && <span className="ml-2 text-[#E9CB6B] text-xs">(Admin)</span>}
                </div>
                <div className="w-16 text-right text-[#D9D9D9] pr-4 text-sm">{member.rating || 0}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tournament Tab Content */}
        {activeTab === 'tournaments' && (
          <div className="mx-4 flex items-center justify-center text-[#D9D9D9] h-[200px]">
            <p>No tournaments available</p>
          </div>
        )}
      </div>

      {/* Create Tournament Button */}
      {isSuperAdmin && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 py-3">
          <button 
            onClick={() => setShowTournamentModal(true)}
            className="w-full py-3 rounded-lg bg-[#4A7C59] text-[#FAF3DD] font-medium border border-[#E9CB6B]"
          >
            Create Tournament
          </button>
        </div>
      )}
      {/* Overlay to close menu when clicking outside */}
      {showMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowMenu(false)}
        ></div>
      )}

      {/* Bottom Sheet Menu */}
      {showMenu && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[388px] h-[179px] bg-[#1F2323] rounded-[10px] z-50 overflow-hidden">
          <div className="flex flex-col h-full">
            <button
              onClick={() => handleMenuClick('invite')}
              className="w-full text-center py-4 text-[#D9D9D9] text-base border-b border-[#3A393C]"
            >
              Invite
            </button>
            <button
              onClick={() => handleMenuClick('share')}
              className="w-full text-center py-4 text-[#D9D9D9] text-base border-b border-[#3A393C]"
            >
              Share Link
            </button>
            <button
              onClick={() => handleMenuClick('leave')}
              className="w-full text-center py-4 text-[#D9D9D9] text-base"
            >
              Leave Club
            </button>
          </div>
        </div>
      )}

      {/* Leave Confirmation Dialog */}
      {showLeaveConfirm && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setShowLeaveConfirm(false)}
          />
          <div className="fixed top-[350px] left-1/2 -translate-x-1/2 w-[331px] h-[123px] bg-[#333939] rounded-[10px] p-4 z-50">
            <p className="text-center text-[#D9D9D9] text-base font-semibold" style={{ fontFamily: 'Poppins' }}>Do You want to Leave ?</p>
            <div className="flex gap-4 mt-4">
              <button
                onClick={handleLeaveConfirm}
                className="flex-1 py-2 bg-[#4A7C59] text-[#D9D9D9] rounded-[10px]"
              >
                Yes
              </button>
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 py-2 bg-transparent text-[#D9D9D9] rounded-[10px] border border-[#4A7C59]"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      {/* Share Link Modal */}
      {showShareModal && (
        <ShareLinkModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} />
      )}

      {/* Tournament Options Modal */}
      <TournamentOptionsModal
        isOpen={showTournamentModal}
        onClose={() => setShowTournamentModal(false)}
        onBecomeClubmaster={handleBecomeClubmaster}
      />

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[400px] z-10">
        <BottomNavigation />
      </div>
    </div>
  );
} 