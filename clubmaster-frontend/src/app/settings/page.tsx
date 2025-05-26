"use client";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState({
    gameInvitations: true,
    autoQueenPromotions: false,
    notifications: true,
    sound: false
  });
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [maxRatingGap, setMaxRatingGap] = useState(200);

  function handleLogout() {
    // TODO: Implement actual logout logic
    setShowLogoutModal(false);
    alert('Logged out!');
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#333939] relative pb-20 max-w-[430px] mx-auto">
      {/* Header */}
      <header className="bg-[#333939] w-full">
        <div className="container mx-auto px-4 py-2 flex items-center justify-center relative">
          <button onClick={() => router.back()} className="absolute left-4 top-1/2 -translate-y-1/2">
            <Image 
              src="/icons/back arrow option.svg" 
              alt="Back" 
              width={24} 
              height={24}
            />
          </button>
          <h1 className="text-[#FAF3DD] text-xl font-medium text-center w-full">Settings</h1>
        </div>
      </header>

      {/* Settings Content */}
      <div className="flex-1 px-4 py-6">
        {/* General Settings */}
        <div className="mb-6">
          <h2 className="text-[#FAF3DD] text-base font-medium mb-3">General Settings</h2>
          <div className="bg-[#4C5454] rounded-lg overflow-hidden">
            <SettingItem 
              label="Game Invitations"
              value={settings.gameInvitations}
              onChange={(value) => setSettings(prev => ({ ...prev, gameInvitations: value }))}
            />
            <SettingItem 
              label="Auto Queen-Promotions"
              value={settings.autoQueenPromotions}
              onChange={(value) => setSettings(prev => ({ ...prev, autoQueenPromotions: value }))}
            />
            <SettingItem 
              label="Notifications"
              value={settings.notifications}
              onChange={(value) => setSettings(prev => ({ ...prev, notifications: value }))}
              noBorder
            />
          </div>
        </div>

        {/* Preferences */}
        <div className="mb-6">
          <h2 className="text-[#FAF3DD] text-base font-medium mb-3">Preferences</h2>
          <div className="bg-[#4C5454] rounded-lg overflow-hidden">
            <SettingItem 
              label="Sound"
              value={settings.sound}
              onChange={(value) => setSettings(prev => ({ ...prev, sound: value }))}
              noBorder
            />
          </div>
        </div>

        {/* Other */}
        <div className="mb-6">
          <h2 className="text-[#FAF3DD] text-base font-medium mb-3">Other</h2>
          <div className="bg-[#4C5454] rounded-lg overflow-hidden flex items-center px-4 py-3">
            <span className="text-[#D9D9D9] text-base flex-1">Max Rating Gap</span>
            <CustomDropdown 
              value={maxRatingGap}
              options={[200, 300, 400, 500, 600]}
              onChange={(value) => setMaxRatingGap(value)}
            />
          </div>
        </div>

        {/* Account */}
        <div className="flex flex-col items-center">
          <h2 className="text-[#FAF3DD] text-base font-medium mb-3 self-start">Account</h2>
          <div className="w-full flex justify-center">
            <div className="bg-[#1F2323] rounded-lg w-full max-w-[400px] px-4 py-4 flex justify-center">
              <button 
                className="w-full text-center text-[#D9D9D9] text-base font-medium"
                onClick={() => setShowLogoutModal(true)}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Logout Modal */}
      {showLogoutModal && (
        <LogoutModal 
          onCancel={() => setShowLogoutModal(false)} 
          onConfirm={handleLogout} 
        />
      )}
    </div>
  );
}

function SettingItem({ 
  label, 
  value, 
  onChange,
  noBorder = false 
}: { 
  label: string; 
  value: boolean; 
  onChange: (value: boolean) => void;
  noBorder?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between p-4 ${!noBorder ? '' : ''}`}>
      <span className="text-[#D9D9D9] text-base">{label}</span>
      <button 
        className={`w-12 h-6 rounded-full relative transition-colors duration-200 ease-in-out ${value ? 'bg-[#C8D5B9]' : 'bg-[#333939]'}`}
        onClick={() => onChange(!value)}
      >
        <span 
          className={`absolute top-1 w-4 h-4 rounded-full bg-[#4A7C59] transition-transform duration-200 ease-in-out shadow ${
            value ? 'left-7' : 'left-1'
          }`}
        />
      </button>
    </div>
  );
}

function CustomDropdown({ value, options, onChange }: { value: number; options: number[]; onChange: (v: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState({ left: 0, top: 0, width: 0 });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownStyle({ left: rect.left, top: rect.bottom + window.scrollY, width: rect.width });
    }
  }, [open]);

  return (
    <div ref={ref} className="relative" style={{ minWidth: 70 }}>
      <button
        ref={buttonRef}
        className="flex items-center rounded-md bg-[#C8D5B9] px-3 h-11 min-w-[70px] border-none"
        style={{ height: 30 }}
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <span className="text-[#292E2E] text-lg font-bold flex-1 text-left" style={{ fontFamily: 'inherit' }}>{value}</span>
        <span className="mx-1 h-7 w-px bg-[#E0E0E0]" />
        {/* Down Arrow SVG */}
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 8L10 13L15 8" stroke="#292E2E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && typeof window !== 'undefined' && (
        <div
          className="fixed z-50"
          style={{ left: dropdownStyle.left, top: dropdownStyle.top, width: dropdownStyle.width }}
        >
          {/* Selected value at the top */}
          <div className="rounded-t-md bg-[#C8D5B9] text-[#232726] text-lg font-bold px-3 py-2 text-center">
            {value}
          </div>
          {/* Gap between selected and options */}
          <div style={{ height: 4, background: 'transparent' }} />
          {/* Other options */}
          <div className="rounded-b-md overflow-hidden">
            {options.filter(opt => opt !== value).map((opt, idx, arr) => (
              <button
                key={opt}
                className={`w-full text-center px-3 py-2 text-[#E6E6E6] text-lg font-bold bg-[#232726] hover:bg-[#353A39] ${idx === arr.length - 1 ? 'rounded-b-md' : ''}`}
                onClick={() => { onChange(opt); setOpen(false); }}
                type="button"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LogoutModal({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black opacity-60" />
      {/* Modal */}
      <div className="relative z-10 bg-[#4C5454] rounded-lg px-8 py-8 flex flex-col items-center w-[90vw] max-w-[340px]">
        <span className="text-[#FAF3DD] text-lg font-medium mb-6 text-center">Are you sure you want to log out ?</span>
        <div className="flex w-full gap-4">
          <button
            className="flex-1 bg-[#4A7C59] text-[#FAF3DD] py-2 rounded-md font-semibold text-base"
            onClick={onConfirm}
          >
            Yes
          </button>
          <button
            className="flex-1 bg-[#4C5454] border border-[#4A7C59] text-[#FAF3DD] py-2 rounded-md font-semibold text-base"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
} 