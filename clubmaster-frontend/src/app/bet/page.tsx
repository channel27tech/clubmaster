"use client";
import React, { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";

// Color codes
const TITLE_COLOR = "#FAF3DD";
const ACTIVE_COLOR = "#8FC0A9";
const INACTIVE_COLOR = "#E9CB6B";
const BG_COLOR = "#333939";
const CARD_COLOR = "#4C5454";
const SEARCH_BG = "#4C5454";
const TEXT_COLOR = "#D9D9D9";

// Mock data
const friends = [
  { name: "QueenKnight_22", active: true },
  { name: "Abhishek", active: true },
  { name: "Asif", active: true },
  { name: "Basith", active: true },
  { name: "Junaid", active: false, lastActive: "5 hrs ago" },
  { name: "Ramees", active: false, lastActive: "10 hrs ago" },
  { name: "Akash", active: false, lastActive: "11 hrs ago" },
  { name: "Akhil", active: false, lastActive: "15 hrs ago" },
  { name: "Safwan", active: false, lastActive: "1 Day ago" },
  { name: "Safwan", active: false, lastActive: "1 Day ago" },
  { name: "Safwan", active: false, lastActive: "1 Day ago" },
];

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

function FriendListItem({ friend }: { friend: typeof friends[0] }) {
  return (
    <div
      className="flex items-center gap-4 p-3 rounded-xl mb-3 relative"
      style={{ background: CARD_COLOR }}
    >
      <div className="relative" style={{ width: 48, height: 48 }}>
        <Image
          src="/images/bg.png"
          alt="profile"
          width={48}
          height={48}
          className="rounded-full"
        />
        <StatusDot active={friend.active} />
      </div>
      <div className="flex flex-col">
        <span className="text-[16px] front-roboto front-regular" style={{ color: TITLE_COLOR }}>{friend.name}</span>
        {friend.active ? (
          <span className="text-xs" style={{ color: ACTIVE_COLOR }}>Active now</span>
        ) : (
          <span className="text-xs" style={{ color: INACTIVE_COLOR }}>{friend.lastActive}</span>
        )}
      </div>
    </div>
  );
}

export default function BetFriendsListPage() {
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () =>
      friends.filter((f) =>
        f.name.toLowerCase().includes(search.toLowerCase())
      ),
    [search]
  );
 
  return (
    <div className="min-h-screen w-full" style={{ background: BG_COLOR }}>
      {/* Header */}
      <div className="sticky top-0 z-20" style={{ background: BG_COLOR }}>
        <div className="flex items-center ms-4 px-2 py-4 ">
          <Link href="/" className="mr-2">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" stroke="#D9D9D9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
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
      <Link href="/bet/match_setup_screen" className="mr-2">
        {filtered.length === 0 ? (
          <div className="text-center text-[#B0B0B0] mt-8">No friends found.</div>
        ) : (
          filtered.map((friend, idx) => (
            <FriendListItem friend={friend} key={friend.name + idx} />
          ))
        )}
        </Link>
      </div>
      
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