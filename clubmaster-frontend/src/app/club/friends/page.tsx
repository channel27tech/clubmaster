"use client";
import React, { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShareLinkModal } from '../share-link/page';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';

// Color codes
const TITLE_COLOR = "#FAF3DD";
const ACTIVE_COLOR = "#8FC0A9";
const INACTIVE_COLOR = "#E9CB6B";
const BG_COLOR = "#333939";
const CARD_COLOR = "#4C5454";
const SEARCH_BG = "#4C5454";
const TEXT_COLOR = "#D9D9D9";

// Mock data
// const friends = [
//   { name: "QueenKnight_22", active: true },
//   { name: "Abhishek", active: true },
//   { name: "Asif", active: true },
//   { name: "Basith", active: true },
//   { name: "Junaid", active: false, lastActive: "5 hrs ago" },
//   { name: "Ramees", active: false, lastActive: "10 hrs ago" },
//   { name: "Akash", active: false, lastActive: "11 hrs ago" },
//   { name: "Akhil", active: false, lastActive: "15 hrs ago" },
//   { name: "Safwan", active: false, lastActive: "1 Day ago" },
//   { name: "Safwan", active: false, lastActive: "1 Day ago" },
//   { name: "Safwan", active: false, lastActive: "1 Day ago" },
// ];

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 15,
        height: 15,
        borderRadius: "50%",
        background: active ? ACTIVE_COLOR : INACTIVE_COLOR,
        border: "2px solid #D9D9D9",
        position: "absolute",
        left:35,
        bottom: 0,
      }}
    />
  );
}

function FriendListItem({ friend, onInvite }: { friend: { id: string; displayName: string; }; onInvite: () => void }) {
  return (
    <div
      className="flex items-center gap-4 p-3 rounded-xl mb-3 relative"
      style={{ background: CARD_COLOR }}
    >
      <div className="relative flex items-center justify-center" style={{ width: 48, height: 48, background: '#D9D9D9', borderRadius: '50%' }}>
        <Image
          src="/images/frnds dp.svg"
          alt="profile"
          width={24}
          height={28}
        />
        {/* <StatusDot active={friend.active} /> */}
        {/* StatusDot removed as we don't have active status from backend yet */}
      </div>
      <div className="flex flex-col flex-1">
        <span className="text-[16px] front-roboto front-regular" style={{ color: TITLE_COLOR }}>{friend.displayName}</span>
        {/* {friend.active ? (
          <span className="text-xs" style={{ color: ACTIVE_COLOR }}>Active now</span>
        ) : (
          <span className="text-xs" style={{ color: INACTIVE_COLOR }}>{friend.lastActive}</span>
        )} */}
        {/* Active status removed as we don't have it from backend yet */}
      </div>
      <button
        className="ml-auto px-4 py-2 rounded-md bg-[#4A7C59] text-[#FAF3DD] text-sm font-medium"
        onClick={onInvite}
      >
        Invite
      </button>
    </div>
  );
}

export default function BetFriendsListPage() {
  const [search, setSearch] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [users, setUsers] = useState<{ id: string; displayName: string; }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading, idToken } = useAuth();

  useEffect(() => {
    if (!authLoading && user && idToken) {
      const fetchUsers = async () => {
        try {
          const response = await fetch('http://localhost:3001/users/list?excludeClubMembers=true', {
            headers: {
              'Authorization': `Bearer ${idToken}`,
            },
          });
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          setUsers(data);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };

      fetchUsers();
    } else if (!authLoading && !user) {
      setLoading(false);
      setError('User not authenticated.');
    }
  }, [authLoading, user, idToken]);

  const filtered = useMemo(
    () =>
      users.filter((user) =>
        user.displayName.toLowerCase().includes(search.toLowerCase())
      ),
    [search, users]
  );
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");

  if (mode === "play") {
    // Play-a-friend UI (matching screenshot)
    return (
      <div className="min-h-screen flex flex-col bg-[#333939] max-w-[430px] mx-auto pb-4 px-[21px]">
        {/* Header */}
        <div className="w-full flex items-center pt-4 pb-4 relative z-10">
          <button onClick={() => router.back()} className="flex items-center justify-center" style={{ width: 40, height: 40, background: 'transparent', borderRadius: 0, padding: 0, border: 'none' }}>
            <Image src="/icons/back arrow option.svg" alt="Back" width={18} height={18} />
          </button>
          <div className="flex-1 flex justify-center">
            <span className="text-[#FAF3DD] text-[22px] font-semibold">Friends</span>
          </div>
        </div>
        {/* Search Bar */}
        <div className="mb-3">
          <div className="flex items-center bg-[#444948] rounded-[10px] px-3 py-2">
            <input
              type="text"
              placeholder="Search..."
              className="flex-1 bg-transparent outline-none text-[#FAF3DD] placeholder-[#A0A0A0] text-base"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
              <path d="M19 19L14.65 14.65M16.5 9.25C16.5 13.115 13.365 16.25 9.5 16.25C5.63501 16.25 2.5 13.115 2.5 9.25C2.5 5.38501 5.63501 2.25 9.5 2.25C13.365 2.25 16.5 5.38501 16.5 9.25Z" stroke="#A0A0A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
        {/* Friends List */}
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="text-center text-[#B0B0B0] mt-8">Loading users...</div>}
          {error && <div className="text-center text-red-500 mt-8">Error: {error}</div>}
          {!loading && !error && filtered.length === 0 && (
            <div className="text-center text-[#B0B0B0] mt-8">No users found.</div>
          )}
          {!loading && !error && filtered.length > 0 && (
            filtered.map((friend) => {
              // const isActive = friend.active; // Active status removed
              return (
                <div
                  key={friend.id}
                  className="flex items-center bg-[#4C5454] rounded-[10px] px-4 py-3 mb-3 relative cursor-pointer"
                  // onClick={() => router.push(`/user_profile?user=${encodeURIComponent(friend.name)}&from=friends`)} // Use friend.displayName
                  onClick={() => router.push(`/user_profile?user=${encodeURIComponent(friend.displayName)}&from=friends`)}
                >
                  <div className="relative w-10 h-10 flex items-center justify-center mr-4">
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="20" cy="20" r="20" fill="#A0A0A0" />
                      <path d="M20 22c3.314 0 6-2.686 6-6s-2.686-6-6-6-6 2.686-6 6 2.686 6 6 6z" fill="#E6E6E6"/>
                      <path d="M10 32c0-4.418 3.582-8 8-8h4c4.418 0 8 3.582 8 8" fill="#E6E6E6"/>
                    </svg>
                    {/* <span
                      className="absolute w-3.5 h-3.5 rounded-full border-2 border-[#333939]"
                      style={{
                        background: isActive ? '#8FC0A9' : '#E9CB6B',
                        right: 0,
                        bottom: 0,
                      }}
                    /> */}
                    {/* Status dot removed */}
                  </div>
                  <div className="flex-1">
                    <div className="text-[#FAF3DD] text-base font-medium">{friend.displayName}</div>
                    {/* <div className={isActive ? "text-[#8FC0A9] text-sm" : "text-[#E9CB6B] text-sm"}>{isActive ? 'Active now' : friend.lastActive}</div> */}
                    {/* Active status text removed */}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // Default friends UI (existing)
  return (
    <div className="min-h-screen w-full" style={{ background: BG_COLOR }}>
      {/* Header */}
      <div className="sticky top-0 z-20" style={{ background: BG_COLOR }}>
        <div className="flex items-center ms-4 px-2 py-4 ">
          <button 
            onClick={() => router.back()} 
            className="text-[#BFC0C0] mr-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <h1 className="flex-1 text-center text-[26px] front-poppins front-semibold" style={{ color: TITLE_COLOR, letterSpacing: 1 }}>Friends</h1>
          <span className="w-8" /> {/* Spacer for symmetry */}
        </div>
        {/* Search Bar */}
        <div className="px-4 py-2 sticky top-[56px] z-10" style={{ background: BG_COLOR }}>
          <div className="flex items-center rounded-lg px-3" style={{ background: SEARCH_BG }}>
            <input
              className="flex-1 bg-transparent outline-none py-4 text-[#FAF3DD] placeholder-[#B0B0B0]"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ fontSize: 16 }}
            />
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" stroke="#B0B0B0" strokeWidth="2" />
              <path d="M21 21l-4.35-4.35" stroke="#B0B0B0" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>
      {/* Friends List */}
      <div className="px-4 pt-2 pb-8" style={{ maxWidth: 480, margin: "0 auto" }}>
        {loading && <div className="text-center text-[#B0B0B0] mt-8">Loading users...</div>}
        {error && <div className="text-center text-red-500 mt-8">Error: {error}</div>}
        {!loading && !error && filtered.length === 0 ? (
          <div className="text-center text-[#B0B0B0] mt-8">No users found.</div>
        ) : (!loading && !error && filtered.length > 0 && (
          filtered.map((friend) => (
            <div key={friend.id} onClick={() => router.push(`/user_profile?user=${encodeURIComponent(friend.displayName)}&from=friends`)} style={{ cursor: 'pointer' }}>
              {/* Passed dummy data for active/lastActive as it's not available from backend yet */}
              <FriendListItem friend={friend as any} onInvite={() => setShowShareModal(true)} />
            </div>
          ))
        ))}
      </div>
      {showShareModal && (
        <ShareLinkModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} />
      )}
      <style jsx global>{`
        @media (max-width: 600px) {
          .min-h-screen { min-height: 100vh; }
          .text-xl { font-size: 1.2rem; }
          .text-base { font-size: 1rem; }
        }
        @media (min-width: 601px) {
          .px-4 { padding-left: 2rem; padding-right: 2rem; }
          .pt-2 { padding-top: 1rem; }
          .pb-8 { padding-bottom: 2rem; }
        }
      `}</style>
    </div>
  );
} 