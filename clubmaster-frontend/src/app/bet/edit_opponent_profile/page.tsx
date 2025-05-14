"use client";
import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";

const OPPONENT = {
  name: "Abhishektn27x",
  avatar: "/images/sample-opponent-avatar.png", // Replace with real image if available
};

const PROFILE_IMAGES = [
  "/bet_images/bet_profile_1.svg",
  "/bet_images/bet_profile_2.svg",
  "/bet_images/bet_profile_3.svg",
  "/bet_images/bet_profile_4.svg",
  "/bet_images/bet_profile_5.svg",
  "/bet_images/bet_profile_6.svg",
];

const NICKNAMES = [
  "Blunder Master",
  "Checkmate Victim",
  "Time Waster",
  "Chess Jester",
  "The Great Sacrifice",
  "Queen's Gambit Reject",
"Rookie Mistake",
"Castle Crusher",
"En Passant Phantom",
"Fork Whisperer",
];

export default function EditOpponentProfile() {
  const [selectedProfile, setSelectedProfile] = useState(0);
  const [selectedNickname, setSelectedNickname] = useState<null | number>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  return (
    <div className="min-h-screen w-full flex flex-col items-center  bg-[#333939]">
      {/* Header */}
      <div className="w-full sticky top-0 z-10 " style={{ background: "#333939" }}>
        <div className="flex items-center px-4 py-4">
          <Link href="/bet/match_setup_screen" className="mr-2">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
              <path d="M15 19l-7-7 7-7" stroke="#FAF3DD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className="flex-1 text-center text-[22px] font-semibold" style={{ color: "#FAF3DD", letterSpacing: 1, fontFamily: 'Roboto' }}>Edit opponent profile</h1>
          <span className="w-8" />
        </div>
      </div>

      {/* Opponent Avatar & Name */}
      <div className="flex flex-col items-center mt-2 mb-4">
        <Image
          src={OPPONENT.avatar}
          alt="Opponent Avatar"
          width={80}
          height={80}
          className="rounded-full border-4 border-[#333939] bg-[#fff]"
        />
        <span className="mt-2 text-[16px] text-[#FAF3DD] font-semibold" style={{ fontFamily: 'Roboto' }}>{OPPONENT.name}</span>
      </div>

      {/* Choose Their New Profile */}
      <div className="w-full max-w-[430px] mb-4">
        <div className="px-4 pt-4 pb-2" style={{ background: '#1F2424' }}>
          <span className="block text-[#FAF3DD] text-[16px] font-regular mb-3" style={{ fontFamily: 'Roboto' }}>Choose Their New profile</span>
        </div>
        <div className="flex gap-4 overflow-x-auto mt-5 pb-3 px-4 scrollbar-hide">
          {PROFILE_IMAGES.map((img, idx) => (
            <button
              key={img}
              onClick={() => setSelectedProfile(idx)}
              className={`flex-shrink-0 rounded-full border-4 ${selectedProfile === idx ? 'border-[#4A7C59]' : 'border-transparent'} focus:outline-none transition-all`}
              style={{ width: 64, height: 64, background: '#fff' }}
            >
              <Image src={img} alt={`Profile ${idx + 1}`} width={56} height={56} className="rounded-full" />
            </button>
          ))}
        </div>
      </div>

      {/* Choose Their New Nickname */}
      <div className="w-full max-w-[430px] mb-4 flex flex-col">
        <div className="px-4 pt-4 pb-2" style={{ background: '#1F2424'}}>
          <span className="block text-[#FAF3DD] text-[16px] font-regular mb-3" style={{ fontFamily: 'Roboto' }}>Choose Their New Nickname</span>
        </div>
        <div className="flex-1 overflow-y-auto max-h-[370px] mt-[22px] px-4 pb-4 scrollbar-hide">
          {NICKNAMES.map((nickname, idx) => (
            <button
              key={nickname}
              onClick={() => setSelectedNickname(selectedNickname === idx ? null : idx)}
              className={`w-full flex items-center justify-between mb-[4px] px-4 h-[60px] rounded-[10px] text-left font-semibold text-[#D9D9D9] bg-[#4C5454] ${selectedNickname === idx ? 'border-2 border-[#4A7C59]' : 'border-2 border-transparent'} transition-all`}
              style={{ fontFamily: 'Roboto', fontSize: 16 }}
            >
              <span className="truncate">{nickname}</span>
              <span className={`w-6 h-6 flex items-center justify-center rounded-full border-2 ${selectedNickname === idx ? 'border-[#4A7C59]' : 'border-[#7A8B7A]'}`}
                style={{ transition: 'border 0.2s' }}>
                {selectedNickname === idx && (
                  <span className="block w-3 h-3 rounded-full bg-[#4A7C59]" />
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Footer Buttons */}
      <div className="w-full max-w-[400px] flex flex-row justify-between gap-4 px-4 pb-6 mt-auto">
        <button
          className="flex-1 min-w-0 py-3 rounded-[10px] font-semibold border-2"
          style={{
            background: 'transparent',
            color: '#FAF3DD',
            borderColor: '#4A7C59',
            fontFamily: 'Roboto',
            fontSize: 16,
          }}
        >
          Cancel
        </button>
        <button
          className="flex-1 min-w-0 py-3 rounded-[10px] font-semibold border-2"
          style={{
            background: '#4A7C59',
            color: '#FAF3DD',
            borderColor: '#E9CB6B',
            fontFamily: 'Roboto',
            fontSize: 16,
          }}
          onClick={() => setShowSuccess(true)}
        >
          Save
        </button>
      </div>

      {/* Success Popup Modal */}
      {showSuccess && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.48)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            position: 'relative',
            width: 340,
            height: 200,
            background: '#4C5454',
            borderRadius: 10,
            boxShadow: '0 4px 32px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingBottom: 24,
          }}>
            {/* Profile image - overlaps top */}
            <div style={{
              position: 'absolute',
              top: -38,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 76,
              height: 76,
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
            }}>
              <Image
                src={PROFILE_IMAGES[selectedProfile]}
                alt="Updated Profile"
                width={76}
                height={76}
                style={{ borderRadius: '50%', background: '#fff' }}
              />
            </div>
            {/* Nickname and message */}
            <div style={{ marginTop: 48, width: '100%', textAlign: 'center' }}>
              <div style={{ fontWeight: "bold", color: '#FAF3DD', fontSize: 20, fontFamily: 'Roboto' }}>
                {selectedNickname !== null ? NICKNAMES[selectedNickname] : ''}
              </div>
              <div style={{ color: '#8FC0A9', fontWeight: "medium", fontSize: 16, marginTop: 4, fontFamily: 'Roboto' }}>
                Profile Successfully Updated!
              </div>
            </div>
            {/* Buttons */}
            <div style={{ display: 'flex', gap: 16, marginTop: 20 }}>
              <button
                style={{
                  width: 146,
                  height: 47,
                  background: '#4A7C59',
                  color: '#FAF3DD',
                  border: 'none',
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 16,
                  fontFamily: 'Roboto, sans-serif',
                  cursor: 'pointer',
                }}
                onClick={() => setShowSuccess(false)}
              >
                View
              </button>
              <button
                style={{
                  width: 146,
                  height: 47,
                  background: 'transparent',
                  color: '#FAF3DD',
                  border: '2px solid #4A7C59',
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 16,
                  fontFamily: 'Roboto, sans-serif',
                  cursor: 'pointer',
                }}
                onClick={() => setShowSuccess(false)}
              >
                Home
              </button>
            </div>
          </div>
        </div>
      )}
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
} 