'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import BottomNavigation from '../../components/BottomNavigation';
import { useAuth } from '../../../context/AuthContext';
import { ShareLinkModal } from '../share-link/page';
import { deleteClub } from '@/services/clubService';
import ClubInfoModal from '@/components/ClubInfoModal';

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
  rank: number;
}

interface ClubMember {
  id: string;
  firebaseUid: string;
  displayName: string;
  photoURL: string;
  rating: number;
  role: string;
  userId: string;
  avatarUrl: string;
}

// Add modal component for super admin transfer
interface SuperAdminTransferModalProps {
  members: ClubMember[];
  currentSuperAdmin: ClubMember;
  onSelect: (member: ClubMember) => void;
  onClose: () => void;
}

interface ClubMemberListModalProps {
  members: ClubMember[];
  onSelect: (member: ClubMember) => void;
  onClose: () => void;
}

// Add a fallback image component
function MemberAvatar({ member, size = 40 }: { member: ClubMember; size?: number }) {
  const [error, setError] = useState(false);
  
  if (!member.photoURL || error) {
    return (
      <div 
        className="flex items-center justify-center bg-[#4A7C59] rounded-full"
        style={{ width: size, height: size }}
      >
        <span className="text-[#FAF3DD] text-lg font-medium">
          {member.displayName.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={member.photoURL}
      alt={member.displayName}
      width={size}
      height={size}
      className="rounded-full"
      onError={() => setError(true)}
    />
  );
}

function ClubMemberListModal({ members, onSelect, onClose }: ClubMemberListModalProps) {
  const [search, setSearch] = useState('');
  const filtered = members.filter(m => m.displayName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed left-1/2 z-50 flex flex-col items-center"
      style={{ top: 'calc(50% + 75px)', transform: 'translate(-50%, 0)', background: '#333939', borderRadius: 16, width: 320, boxShadow: '0 4px 32px rgba(0,0,0,0.2)', padding: '16px' }}>
      <div className="w-full bg-[#2A2F2F] rounded-lg mb-2">
        <div className="flex items-center px-3 py-2.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M11 19a8 8 0 100-16 8 8 0 000 16zm7-1l-4.35-4.35" stroke="#8FC0A9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <input
            className="bg-transparent outline-none text-[#FAF3DD] ml-2 w-full placeholder-[#8FC0A9] text-base"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div 
        className="w-full overflow-y-auto" 
        style={{
          maxHeight: '240px',
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: '#4A7C59 #2A2F2F',
        }}
      >
        <style jsx global>{`
          /* For Webkit browsers like Chrome/Safari */
          ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }

          ::-webkit-scrollbar-track {
            background: #2A2F2F;
            border-radius: 3px;
          }

          ::-webkit-scrollbar-thumb {
            background-color: #4A7C59;
            border-radius: 3px;
            border: 2px solid #333939;
          }

          ::-webkit-scrollbar-thumb:hover {
            background-color: #3D6A4A;
          }

          /* For Firefox */
          * {
            scrollbar-width: thin;
            scrollbar-color: #4A7C59 #2A2F2F;
          }
        `}</style>
        <div className="space-y-1">
          {filtered.map(member => (
            <div key={member.id} className="flex items-center justify-between px-3 py-2 hover:bg-[#2A2F2F] rounded-lg">
              <div className="flex items-center gap-2">
                <MemberAvatar member={member} size={36} />
                <div>
                  <div className="text-[#FAF3DD] text-base font-medium">{member.displayName}</div>
                  <div className="text-[#808785] text-sm -mt-0.5">Rating: {member.rating}</div>
                </div>
              </div>
              <button
                onClick={() => onSelect(member)}
                className="px-4 py-1.5 bg-[#4A7C59] text-[#FAF3DD] rounded-lg text-sm font-medium hover:bg-[#3D6A4A]"
              >
                Select
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SuperAdminTransferModal({ members, currentSuperAdmin, onSelect, onClose }: SuperAdminTransferModalProps) {
  const [selected, setSelected] = useState<ClubMember | null>(currentSuperAdmin);
  const [showMembersList, setShowMembersList] = useState(false);
  const [hasSelected, setHasSelected] = useState(false);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 z-50 flex flex-col items-center"
        style={{ transform: 'translate(-50%, -80%)', background: '#333939', borderRadius: 16, width: 320, boxShadow: '0 4px 32px rgba(0,0,0,0.2)', padding: '20px 16px' }}>
        <div className="text-[#FAF3DD] text-xl font-semibold mb-4">Make anyone as Superadmin</div>
        {selected && (
          <>
            <div className="mb-3">
              <MemberAvatar member={selected} size={72} />
            </div>
            <div className="text-[#FAF3DD] text-lg font-medium mb-4">{selected.displayName}</div>
            <button
              className="w-full h-[48px] bg-[#4A7C59] text-[#FAF3DD] rounded-2xl text-base font-medium flex items-center justify-center relative hover:bg-[#3D6A4A]"
              onClick={() => {
                if (hasSelected) {
                  onSelect(selected);
                } else {
                  setShowMembersList(!showMembersList);
                }
              }}
            >
              <span>{hasSelected ? 'Done' : 'Select'}</span>
              {!hasSelected && (
                <Image
                  src="/icons/dropdown_icon.svg"
                  alt="dropdown"
                  width={16}
                  height={16}
                  className="absolute right-4 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMembersList(!showMembersList);
                  }}
                />
              )}
            </button>
          </>
        )}
      </div>
      {showMembersList && (
        <ClubMemberListModal
          members={members.filter(m => m.id !== currentSuperAdmin.id)}
          onSelect={(member) => {
            setSelected(member);
            setShowMembersList(false);
            setHasSelected(true);
          }}
          onClose={() => setShowMembersList(false)}
        />
      )}
    </>
  );
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
  const [selectedMember, setSelectedMember] = useState<ClubMember | null>(null);
  const [showMemberPopup, setShowMemberPopup] = useState(false);
  const [showSuperAdminTransferModal, setShowSuperAdminTransferModal] = useState(false);
  const [currentSuperAdmin, setCurrentSuperAdmin] = useState<ClubMember | null>(null);
  const [showClubInfoModal, setShowClubInfoModal] = useState(false);

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
  const isSuperAdmin = myMembership?.role === 'super_admin';
  const isAdminOrSuperAdmin = myMembership?.role === 'admin' || myMembership?.role === 'super_admin';
  console.log('isSuperAdmin:', isSuperAdmin);

  // Remove duplicate members by firebaseUid
  const uniqueMembers = Array.from(new Map(members.map(m => [m.firebaseUid, m])).values());

  // Add this function to handle super admin transfer
  const handleSuperAdminTransfer = async (member: ClubMember) => {
    try {
      const response = await fetch(`${backendUrl}/club-member/club/${club?.id}/transfer-super-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user?.getIdToken()}`
        },
        body: JSON.stringify({ toUserId: member.id })
      });
      if (!response.ok) {
        throw new Error('Failed to transfer super admin role');
      }
      if (club) {
        const updatedMembers = members.map(m => ({
          ...m,
          role: m.id === member.id ? 'super_admin' : m.role === 'super_admin' ? 'member' : m.role
        }));
        setMembers(updatedMembers);
        setCurrentSuperAdmin(member);
      }
      setShowSuperAdminTransferModal(false);
      alert('Super admin transferred successfully!');
      router.push(`/club/created-detail?clubId=${club?.id}`);
    } catch (error) {
      console.error('Error transferring super admin role:', error);
      alert('Failed to transfer super admin role. Please try again.');
    }
  };

  // Update the useEffect to set current super admin
  useEffect(() => {
    if (members.length > 0) {
      const superAdmin = members.find(m => m.role === 'super_admin');
      if (superAdmin) {
        setCurrentSuperAdmin(superAdmin);
      }
    }
  }, [members]);

  // Before rendering the member list, sort so super admin is first
  const sortedMembers = [...members].sort((a, b) => {
    if (a.role === 'super_admin') return -1;
    if (b.role === 'super_admin') return 1;
    // Optionally, add more sorting logic here (e.g., by rating)
    return 0;
  });

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
        if (isSuperAdmin && uniqueMembers.length > 1) {
          setShowSuperAdminTransferModal(true);
        } else {
          setShowLeaveConfirm(true);
        }
        break;
    }
  };

  //leave club
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

  const handleDeleteClub = async () => {
    if (!user || !club) return;
    if (!window.confirm('Are you sure you want to delete this club?')) return;
    try {
      const token = await user.getIdToken();
      await deleteClub(club.id, token);
      alert('Club deleted successfully.');
      router.push('/club'); // or '/club/clubs'
    } catch (err: any) {
      if (err && typeof err === 'object' && 'response' in err && err.response?.data?.message) {
        alert(err.response.data.message);
      } else {
        alert('Failed to delete club.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#333939] flex flex-col w-full max-w-[400px] mx-auto relative">
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
        {user && members.length > 0 && (
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
          <div className="w-4 h-4 rounded-full bg-[#8FC0A9] flex items-center justify-center cursor-pointer" onClick={() => setShowClubInfoModal(true)}>
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
                <span className="text-[#D9D9D9] text-xs">#{club.rank}</span>
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
            {sortedMembers.map((member, idx) => (
              <div
                key={member.firebaseUid}
                className="flex items-center py-2 bg-transparent cursor-pointer"
                onClick={() => {
                  if (isSuperAdmin && member.role !== 'super_admin') {
                    setSelectedMember(member);
                    setShowMemberPopup(true);
                  }
                }}
              >
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
        )}

        {/* Tournament Tab Content */}
        {activeTab === 'tournaments' && (
          <div className="mx-4 flex items-center justify-center text-[#D9D9D9] h-[200px]">
            <p>No tournaments available</p>
          </div>
        )}
      </div>

      {/* Create Tournament Button */}
      {isAdminOrSuperAdmin && (
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[400px] px-4 py-3 bg-[#333939]">
        <button 
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

{showMenu && (
  <div className="fixed bottom-14 left-1/2 -translate-x-1/2 w-[388px]  bg-[#1F2323] rounded-[10px] z-50 overflow-hidden">
    <div className="flex flex-col h-full">
      {isSuperAdmin ? (
        <>
          <button
            onClick={() => handleMenuClick('invite')}
            className="w-full text-center py-4 text-[#D9D9D9] text-base border-b border-[#3A393C]"
          >
            Invite
          </button>
          {members && (
            <button
              onClick={handleDeleteClub}
              className="w-full text-center py-4 text-[#D9D9D9] text-base border-b border-[#3A393C]"
            >
              Delete Club
            </button>
          )}
          {/* Invite Link Section */}
          <button
            onClick={async () => {
              // Generate invite and open WhatsApp directly
              if (!user) {
                alert('User not authenticated');
                return;
              }
              try {
                const res = await fetch('http://localhost:3001/club-invite/create', {
                  method: 'POST',
                  body: JSON.stringify({ clubId: club?.id }),
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` }
                });
                if (!res.ok) {
                  alert('Failed to generate invite link');
                  return;
                }
                const { token: inviteToken } = await res.json();
                const link = `${window.location.origin}/club/detail?id=${club?.id}&invite=${inviteToken}`;
                const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(link)}`;
                window.open(whatsappUrl, '_blank');
              } catch (err) {
                alert('Failed to generate invite link');
              }
            }}
            className="w-full text-center py-4 text-[#D9D9D9] text-base border-b border-[#3A393C]"
          >
            Share Link
          </button>
          <button
            onClick={() => {
              setShowMenu(false);
              router.push(`/club/create?editMode=true&clubId=${club.id}`);
            }}
            className="w-full text-center py-4 text-[#D9D9D9] text-base border-b border-[#3A393C]"
          >
            Edit Club
          </button>
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

      
      {isSuperAdmin && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[400px] px-4 py-3 bg-[#333939]">
          <button
            
            className="w-full py-3 rounded-lg bg-[#4A7C59] text-[#FAF3DD] font-medium border border-[#E9CB6B]"
          >
           Create Tournament 
          </button>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[400px] z-10">
        <BottomNavigation />
      </div>

      {/* Member Profile Popup */}
      {showMemberPopup && selectedMember && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(34,38,38,0.84)' }}
            onClick={() => setShowMemberPopup(false)}
          />
          {/* Popup */}
          <div
            className="fixed top-1/2 left-1/2 z-50 flex flex-col items-center"
            style={{
              transform: 'translate(-50%, -50%)',
              background: '#4C5454',
              borderRadius: 16,
              width: 320,
              padding: 24,
              boxShadow: '0 4px 32px rgba(0,0,0,0.2)',
            }}
          >
            <div className="w-24 h-24 rounded-full bg-white overflow-hidden mb-4 flex items-center justify-center">
              <Image src={selectedMember.photoURL || "/images/default-avatar.svg"} alt="Player Avatar" width={96} height={96} />
            </div>
            <div className="text-[#FAF3DD] text-lg font-semibold mb-1 text-center">{selectedMember.displayName}</div>
            <div className="text-[#FAF3DD] text-base mb-4 text-center">({selectedMember.rating || 0})</div>
            <div className="flex flex-col gap-3 w-full items-center">
              <button
                style={{ height: 54, width: 272, background: '#4A7C59', borderRadius: 12 }}
                className="text-[#FAF3DD] text-base font-medium mb-1"
                onClick={() => {
                  // TODO: Implement view profile logic
                  setShowMemberPopup(false);
                }}
              >
                View Profile
              </button>
              <button
                style={{ height: 54, width: 272, background: '#4A7C59', borderRadius: 12 }}
                className="text-[#FAF3DD] text-base font-medium"
                onClick={async () => {
                  if (!user || !club) return;
                  console.log('Selected member:', selectedMember);
                  const memberUserId = selectedMember.userId || selectedMember.id;
                  if (!memberUserId) {
                    alert('User ID is missing for this member.');
                    return;
                  }
                  try {
                    const token = await user.getIdToken();
                    const res = await fetch(`${backendUrl}/club-member/club/${club.id}/remove/${memberUserId}`, {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${token}` },
                    });
                    if (!res.ok) {
                      const data = await res.json();
                      alert(data.message || 'Failed to remove member.');
                      return;
                    }
                    setShowMemberPopup(false);
                    // Refresh members list
                    fetch(`${backendUrl}/club/${club.id}`)
                      .then(res => res.json())
                      .then(data => {
                        setMembers(data.members || []);
                      });
                  } catch (err) {
                    alert('Failed to remove member.');
                  }
                }}
              >
                Remove From Club
              </button>
              {isSuperAdmin && selectedMember.role !== 'admin' && selectedMember.role !== 'super_admin' && (
                <button
                  style={{ height: 54, width: 272, background: '#4A7C59', borderRadius: 12 }}
                  className="text-[#FAF3DD] text-base font-medium mb-1"
                  onClick={async () => {
                    if (!user || !club) return;
                    const memberUserId = selectedMember.userId || selectedMember.id;
                    if (!memberUserId) {
                      alert('User ID is missing for this member.');
                      return;
                    }
                    try {
                      const token = await user.getIdToken();
                      const res = await fetch(`${backendUrl}/club-member/club/${club.id}/role`, {
                        method: 'PATCH',
                        headers: {
                          'Authorization': `Bearer ${token}`,
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          memberId: memberUserId,
                          newRole: 'admin',
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok) {
                        alert(data.message || 'Failed to promote member.');
                        return;
                      }
                      alert('Member promoted to admin!');
                      setShowMemberPopup(false);
                      // Refresh members list
                      fetch(`${backendUrl}/club/${club.id}`)
                        .then(res => res.json())
                        .then(data => {
                          setMembers(data.members || []);
                        });
                    } catch (err) {
                      alert('Failed to promote member.');
                    }
                  }}
                >
                  Make Admin
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Super Admin Transfer Modal */}
      {showSuperAdminTransferModal && (
        <SuperAdminTransferModal
          members={uniqueMembers.filter(m => m.role !== 'super_admin')}
          currentSuperAdmin={currentSuperAdmin || uniqueMembers[0]}
          onSelect={handleSuperAdminTransfer}
          onClose={() => setShowSuperAdminTransferModal(false)}
        />
      )}

      {/* Club Info Modal */}
      <ClubInfoModal isOpen={showClubInfoModal} onClose={() => setShowClubInfoModal(false)} />
    </div>
  );
} 