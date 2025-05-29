"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";

const friends = [
  { name: "QueenKnight_22", status: "Active now" },
  { name: "Abhishek", status: "Active now" },
  { name: "Asif", status: "Active now" },
  { name: "Basith", status: "Active now" },
  { name: "Junaid", status: "5 hrs ago" },
  { name: "Ramees", status: "10 hrs ago" },
  { name: "Akash", status: "11 hrs ago" },
  { name: "Akhil", status: "15 hrs ago" },
  { name: "Safwan", status: "1 Day ago" },
  { name: "Safwan", status: "1 Day ago" },
  { name: "Safwan", status: "1 Day ago" },
  { name: "Safwan", status: "1 Day ago" },
];

export default function PlayFriendPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen flex flex-col bg-[#333939] max-w-[430px] mx-auto pb-4">
      {/* Header */}
      <div className="w-full flex items-center px-4 pt-4 pb-4 relative z-10" style={{ maxWidth: 430 }}>
        <button onClick={() => router.back()} className="mr-2">
          <svg width="25" height="25" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.5 16L8.5 11L13.5 6" stroke="#FAF3DD" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="flex-1 flex justify-center">
          <span className="text-[#FAF3DD] text-[22px] font-semibold">Friends</span>
        </div>
      </div>
      {/* Search Bar */}
      <div className="px-4 mb-3">
        <div className="flex items-center bg-[#444948] rounded-md px-3 py-2">
          <input
            type="text"
            placeholder="Search..."
            className="flex-1 bg-transparent outline-none text-[#FAF3DD] placeholder-[#A0A0A0] text-base"
          />
          <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
            <path d="M19 19L14.65 14.65M16.5 9.25C16.5 13.115 13.365 16.25 9.5 16.25C5.63501 16.25 2.5 13.115 2.5 9.25C2.5 5.38501 5.63501 2.25 9.5 2.25C13.365 2.25 16.5 5.38501 16.5 9.25Z" stroke="#A0A0A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
      {/* Friends List */}
      <div className="flex-1 overflow-y-auto px-2">
        {friends.map((friend, idx) => (
          <div key={idx} className="flex items-center bg-[#444948] rounded-md px-4 py-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-[#A0A0A0] flex items-center justify-center mr-4">
              <svg width="28" height="28" fill="none" viewBox="0 0 28 28">
                <circle cx="14" cy="14" r="14" fill="#A0A0A0" />
                <path d="M14 14C16.2091 14 18 12.2091 18 10C18 7.79086 16.2091 6 14 6C11.7909 6 10 7.79086 10 10C10 12.2091 11.7909 14 14 14Z" fill="#E6E6E6"/>
                <path d="M7 22C7 18.6863 9.68629 16 13 16H15C18.3137 16 21 18.6863 21 22" fill="#E6E6E6"/>
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-[#FAF3DD] text-base font-medium">{friend.name}</div>
              <div className="text-[#A0A0A0] text-sm">{friend.status}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 