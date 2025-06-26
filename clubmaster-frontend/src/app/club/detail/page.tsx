'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import BottomNavigation from '../../components/BottomNavigation';
import { ShareLinkModal } from '../share-link/page';
import { useAuth } from '../../../context/AuthContext';
import { useClub } from '../../context/ClubContext';
import { joinClub } from '../../../services/clubService';
import ClubInfoModal from '@/components/ClubInfoModal';

// Add Club interface for type safety
interface ClubMember {
  id: string;
  firebaseUid: string;
  displayName: string;
  photoURL: string;
  rating: number;
  role: string;
  userId: string;
}
// Add Tournament interface for type safety
interface Club {
  id: number;
  name: string;
  location?: string;
  logo?: string;
  members: ClubMember[];
  memberCount: number;
  description?: string;
  points?: number;
  credits?: number;
  rank?: number;
  ratingLimit?: number;
  type?: string;
}

export default function ClubDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { hasClub } = useClub();
  const [club, setClub] = useState<Club | null>(null);
  const [activeTab, setActiveTab] = useState('players');
  const [showMenu, setShowMenu] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<{ location?: string } | null>(null);
  const inviteToken = searchParams.get('invite');
  const [isMember, setIsMember] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [showClubInfoModal, setShowClubInfoModal] = useState(false);

  // Get club ID from query string (?id=123)
  const clubId = searchParams.get('id');

  // Show join button if user is not a member of any club and not a member of this club
  const showJoinButton = !hasClub && !isMember && club;

  // Find the current user's membership in the club
  const myMembership = Array.isArray(club?.members) ? club.members.find(m => m.firebaseUid === user?.uid) : undefined;
  const isSuperAdmin = myMembership?.role === 'super_admin';
  const isAdminOrSuperAdmin = myMembership?.role === 'admin' || myMembership?.role === 'super_admin';

  // Debug logs for role check
  console.log('user?.uid:', user?.uid);
  console.log('club?.members:', club?.members);
  console.log('myMembership:', myMembership);
  console.log('isSuperAdmin:', isSuperAdmin);

  useEffect(() => {
    if (!clubId) return;
    fetch(`http://localhost:3001/club/${clubId}`)
      .then(res => res.json())
      .then(data => {
        setClub(data);
        setMembers(data.members || []);
      });
  }, [clubId]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    };
    fetchProfile();
  }, [user]);

  // Add useEffect to control body scroll
  useEffect(() => {
    if (showMenu || showLeaveConfirm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [showMenu, showLeaveConfirm]);

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

  const handleLeaveConfirm = async () => {
    setShowLeaveConfirm(false);
    if (!user || !club) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`http://localhost:3001/club-member/club/${club.id}/leave`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.message || 'Failed to leave club.');
        return;
      }
      alert('You have left the club.');
      router.push('/club');
    } catch (err) {
      alert('Failed to leave club.');
    }
  };

  // Join handler (replace with actual join logic as needed)
  const handleJoin = async () => {
    if (!user || !clubId) return;
    // Check for private by location club and user location
    if (club?.type === 'private_by_location') {
      if (!profile?.location) {
        setApiError('Please enter your location in your profile before joining this club.');
        setTimeout(() => {
          router.push('/user_profile/edit');
        }, 1500);
        return;
      }
      if (profile.location && club.location && profile.location.trim().toLowerCase() !== club.location.trim().toLowerCase()) {
        setApiError('Your location does not match the club location.');
        setTimeout(() => {
          router.push('/user_profile/edit');
        }, 1500);
        return;
      }
      console.log('User location when joining:', profile.location);
    }
    setLoading(true);
    setApiError('');
    try {
      const token = await user.getIdToken();
      await joinClub(Number(clubId), token, inviteToken || undefined);
      // Refetch club data to update members and hide join button
      const updatedClub = await fetch(`http://localhost:3001/club/${clubId}`).then(res => res.json());
      setClub(updatedClub);
      // Optionally, update hasClub in context if needed
      // Find the joined user in the updated member list
      const joinedUser = updatedClub.members.find((member: any) => member.userId === user.uid);
      if (joinedUser) {
        console.log('User joined club:', joinedUser);
        // You can also display this info in the UI if needed
      }
      // Optionally, show a success message
    } catch (error: any) {
      setApiError(error?.response?.data?.message || 'Failed to join club');
    } finally {
      setLoading(false);
    }
  };

  // Remove duplicate members by firebaseUid
  const uniqueMembers = Array.isArray(club?.members)
    ? Array.from(new Map(club.members.map(m => [m.firebaseUid, m])).values())
    : [];

  // Check if user is already a member (fetch from API)
  useEffect(() => {
    if (!user || !members.length) return;
    setIsMember(members.some(member => member.firebaseUid === user.uid));
  }, [user, members]);

  // Refactor handleGenerateInvite to immediately open WhatsApp with the generated link
  const handleGenerateInvite = async () => {
    const res = await fetch('http://localhost:3001/club-invite/create', {
      method: 'POST',
      body: JSON.stringify({ clubId }),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user && await user.getIdToken()}` }
    });
    const { token: inviteToken } = await res.json();
    const link = `${window.location.origin}/club/detail?id=${clubId}&invite=${inviteToken}`;
    // Immediately open WhatsApp with the generated link
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(link)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Handle join with invite
  const handleJoinWithInvite = async () => {
    setJoinError('');
    setLoading(true);
    try {
      const res = await fetch('/api/club-member/join', {
        method: 'POST',
        body: JSON.stringify({ clubId, inviteToken }),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user && await user.getIdToken()}` }
      });
      if (!res.ok) throw new Error(await res.text());
      setIsMember(true);
      // Optionally, refresh club data
    } catch (err: any) {
      setJoinError(err.message || 'Failed to join club');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen bg-[#333939] flex flex-col w-full max-w-[400px] mx-auto relative ${showMenu || showLeaveConfirm ? 'overflow-hidden' : ''}`}>
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
        {/* Only render admin controls after user and club members are loaded */}
        {user && Array.isArray(club?.members) && club.members.length > 0 &&  (
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

      {/* Club Info Card */}
      <div className="mx-4 rounded-lg p-3 mb-3 relative" style={{
        background: 'linear-gradient(to left, #4A7C59, #4c5454)'
      }}>
        {/* Question mark icon */}
        <div className="absolute top-4 right-4">
          <div className="w-4 h-4 rounded-full bg-[#8FC0A9] flex items-center justify-center cursor-pointer" onClick={() => setShowClubInfoModal(true)}>
            <span className="text-[#1F2323] text-sm font-medium">?</span>
          </div>
        </div>
        
        <div className="flex">
          <div className="flex-1">
            <div className="flex items-center">
              <h2 className="text-[#E9CB6B] text-lg font-semibold">{club?.name}</h2>
            </div>
            {/* {club?.ratingLimit && (
              <div className="flex items-center mt-1">
                <span className="text-[#8FC0A9] text-xs">Rating Limit: {club.ratingLimit}</span>
              </div>
            )} */}
            <div className="flex items-center text-[#D9D9D9] text-xs">
              <span>{club?.members.length} members</span>
              <div className="flex items-center mx-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="#8FC0A9" viewBox="0 0 24 24" className="w-3 h-3">
                  <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </div>
              <span>{club?.location}</span>
            </div>

            {/* Stats */}
            <div className="mt-2 space-y-0.5">
              <div className="flex items-center">
                <span className="text-[#E9CB6B] mr-1 text-sm">🥇</span>
                <span className="text-[#D9D9D9] text-xs">#{club?.rank}</span>
              </div>
              <div className="flex items-center">
                <span className="text-[#E9CB6B] mr-1 text-sm">👉</span>
                <span className="text-[#D9D9D9] text-xs">{club?.points} pts</span>
              </div>
              
              <div className="flex items-center">
                <span className="text-[#E9CB6B] mr-1 text-sm">⭐</span>
                <span className="text-[#D9D9D9] text-xs">{club?.credits}</span>
              </div>
            </div>

            {/* Description with Read More */}
            <div className="mt-1">
              <p className="text-[#D9D9D9] text-[10px]">
                {club?.description}
              </p>
            </div>
          </div>

          {/* Club Logo */}
          <div className="flex items-center justify-end mr-5">
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center border-2 border-[#E9CB6B]">
              <Image 
                src={club?.logo && club.logo.startsWith('/uploads/')
                  ? `http://localhost:3001${club.logo}`
                  : (club?.logo || '/images/club-icon.svg')}
                alt="Club Logo"
                width={52}
                height={52}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#505454] mx-4 mb-2">
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
            className="mx-4 mb-16 overflow-y-auto h-[calc(100vh-350px)]"
            style={{
              msOverflowStyle: 'none',  /* IE and Edge */
              scrollbarWidth: 'none',   /* Firefox */
              WebkitOverflowScrolling: 'touch', /* Enable smooth scrolling on iOS */
            }}
          >
            <style jsx>{`
              div::-webkit-scrollbar {
                display: none;  /* Chrome, Safari and Opera */
              }
            `}</style>
            <div className="pb-10">
              {uniqueMembers.map((member, idx) => (
                <div key={member.firebaseUid} className="flex items-center py-2 bg-transparent">
                  <div className="w-16 text-[#D9D9D9] text-xs text-center">#{idx + 1}</div>
                  <div className="flex-1 flex items-center">
                    <div className="w-9 h-9 rounded-full bg-white overflow-hidden mr-3">
                      <Image src={member.photoURL || "/images/default-avatar.svg"} alt="Player Avatar" width={36} height={36} />
                    </div>
                    <span className="text-[#D9D9D9] text-sm">{member.displayName}</span>
                    {member.role === 'super_admin' && <span className="ml-2 text-[#E9CB6B] text-xs">(Super Admin)</span>}
                    {member.role === 'admin' && <span className="ml-2 text-[#8FC0A9] text-xs">(Admin)</span>}
                  </div>
                  <div className="w-16 text-right text-[#D9D9D9] pr-4 text-sm">{member.rating || 0}</div>
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
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowMenu(false)}
        ></div>
      )}

      {/* Bottom Sheet Menu */}
   
{showMenu && (
  <div className="fixed bottom-14 left-1/2 -translate-x-1/2 w-[388px]  bg-[#1F2323] rounded-[10px] z-50 overflow-hidden">
    <div className="flex flex-col h-full">
      {isAdminOrSuperAdmin ? (
        <>
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
            onClick={() => {
              setShowMenu(false);
              router.push(`/club/create?editMode=true&clubId=${club?.id}`);
            }}
            className="w-full text-center py-4 text-[#D9D9D9] text-base border-b border-[#3A393C]"
          >
            Edit Club
          </button>
          {/* Only super admin can see delete club */}
          {isSuperAdmin && (
            <button
              onClick={() => handleMenuClick('delete')}
              className="w-full text-center py-4 text-[#D9D9D9] text-base border-b border-[#3A393C]"
            >
              Delete Club
            </button>
          )}
          <button
            onClick={() => handleMenuClick('leave')}
            className="w-full text-center py-4 text-[#D9D9D9] text-base"
          >
            Leave Club
          </button>
        </>
      ) : (
        <button
          onClick={() => handleMenuClick('leave')}
          className="w-full text-center py-4 text-[#D9D9D9] text-base"
        >
          Leave Club
        </button>
      )}
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

      {/* Join Button fixed at the bottom */}
      {showJoinButton && (
  <div className="fixed bottom-18 left-1/2 -translate-x-1/2 w-full max-w-[400px] z-10 px-4">
    {apiError && <div className="text-red-400 text-center mb-2">{apiError}</div>}
    <button 
      onClick={handleJoin} 
      className="w-full py-3 rounded-lg bg-[#4A7C59] text-[#FAF3DD] font-medium border border-[#E9CB6B]"
      disabled={loading}
    >
      {loading ? 'Joining...' : 'Join'}
    </button>
  </div>
)}
      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[400px] z-10">
        <BottomNavigation />
      </div>

      {/* Super Admin: Share Link UI (inside detail page) */}
      {isSuperAdmin && (
        <div className="mt-4 p-4 bg-[#4C5454] rounded-lg">
          <button onClick={handleGenerateInvite} className="w-full py-2 rounded bg-[#4A7C59] text-[#FAF3DD] font-medium border border-[#E9CB6B] mb-2">
            Share Link
          </button>
          {/* When clicked, WhatsApp will open with the generated invite link */}
        </div>
      )}

      {/* Invited User: Join Club Button */}
      {!isMember && inviteToken && (
        <div className="mt-4 p-4 bg-[#4C5454] rounded-lg">
          <button onClick={handleJoinWithInvite} disabled={loading} className="w-full py-2 rounded bg-[#4A7C59] text-[#FAF3DD] font-medium border border-[#E9CB6B]">
            {loading ? 'Joining...' : 'Join Club'}
          </button>
          {joinError && <div className="text-red-400 text-center mt-2">{joinError}</div>}
        </div>
      )}

      {isMember && <div>Welcome to the club!</div>}

      {/* Club Info Modal */}
      <ClubInfoModal isOpen={showClubInfoModal} onClose={() => setShowClubInfoModal(false)} />
    </div>
  );
} 