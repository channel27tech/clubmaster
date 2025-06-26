"use client";
import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

const TOURNAMENTS = [
  {
    id: 1,
    name: "King's Gambit Tournament",
    club: "Athani Club",
    clubsJoined: 25,
    date: "12 June 12:00 AM",
    logo: "/icons/trnmnt club icon1.svg",
    color: "#FFD600"
  },
  {
    id: 2,
    name: "Pawn to Glory Tournament",
    club: "Cochin Club",
    clubsJoined: 25,
    date: "12 June 12:00 AM",
    logo: "/icons/trnmnt club icon2.svg",
    color: "#0A2540"
  },
  {
    id: 3,
    name: "Chess Master Showdown",
    club: "Kings Club",
    clubsJoined: 25,
    date: "12 June 12:00 AM",
    logo: "/icons/trnmnt club icon3.svg",
    color: "#D32F2F"
  }
];

const LEAGUES = [
  {
    id: 1,
    name: "ClubMaster Premier League",
    club: "Athani Club",
    clubsJoined: 25,
    startDate: "Dec 20, 2025",
    logo: "/icons/league card trophy icon.svg"
  }
];

const TABS = ["Inter Club", "ClubMaster", "League", "Club Challenge"];
const STATUS_TABS = ["Upcoming", "Ongoing", "Completed"];

export default function TournamentViewPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [activeStatus, setActiveStatus] = useState(0);
  const [myClubOnly, setMyClubOnly] = useState(false);
  const [type, setType] = useState("public");
  const router = useRouter();
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(2024);
  const filterBtnRef = useRef(null);
  const yearOptions = [2022, 2023, 2024, 2025];
  const [leagueFilterOpen, setLeagueFilterOpen] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState('Season 1 (2022-23)');
  const leagueSeasons = [
    'Season 1 (2021-22)',
    'Season 2 (2022-23)',
    'Season 3 (2023-24)',
    'Season 4 (2024-25)'
  ];

  // Close dropdown on outside click
  useEffect(() => {
    if (!yearDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (filterBtnRef.current && !(filterBtnRef.current as Node).contains(e.target as Node)) {
        setYearDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [yearDropdownOpen]);

  // Render tournament or league cards based on active tab
  const renderCards = () => {
    if (activeTab === 2) { // League tab
      return (
        <div className="flex flex-col gap-4 px-4 pb-4">
          {LEAGUES.map(league => (
            <div key={league.id} className="bg-[#4C5454] rounded-xl p-4 flex flex-col gap-2 shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 flex items-center justify-center">
                  <Image src={league.logo} alt="Trophy" width={40} height={40} />
                </div>
                <div className="flex-1">
                  <div className="text-[#FAF3DD] text-[16px] font-poppins font-semibold">{league.name}</div>
                  <div className="text-[#D9D9D9] text-[12px] font-roboto font-normal">{league.club}</div>
                  <div className="text-[#D9D9D9] text-[12px] font-roboto font-normal">{league.clubsJoined} Clubs Joined</div>
                </div>
              </div>
              <div className="w-full h-px bg-[#1F2323] my-1" />
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-2 text-[#D9D9D9] text-[12px] font-roboto font-normal">
                  <Image src="/icons/tournament date icon.svg" alt="Date" width={19} height={19} />
                  Starts on {league.startDate}
                </div>
                <button className="bg-[#4A7C59] text-[#FAF3DD] rounded-lg px-6 py-1 text-[16px] font-roboto font-medium" onClick={() => router.push('/tournament/card-view?type=league')}>View</button>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Return regular tournament cards for other tabs
    return (
      <div className="flex flex-col gap-4 px-4 pb-4">
        {TOURNAMENTS.map(t => (
          <div key={t.id} className="bg-[#4C5454] rounded-xl p-4 flex flex-col gap-2 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: t.color }}>
                <Image src={t.logo} alt={t.name} width={40} height={40} />
              </div>
              <div className="flex-1">
                <div className="text-[#D9D9D9] text-[16px] font-poppins font-semibold">{t.name}</div>
                <div className="text-[#D9D9D9] text-[12px] font-roboto font-normal">{t.club}</div>
                <div className="text-[#D9D9D9] text-[12px] font-roboto font-normal">{t.clubsJoined} Clubs Joined</div>
              </div>
            </div>
            <div className="w-full h-px bg-[#1F2323] my-1" />
            <div className="flex items-center justify-between mt-1">
              <div className="flex items-center gap-2 text-[#D9D9D9] text-[14px] font-roboto font-normal">
                <Image src="/icons/tournament date icon.svg" alt="Date" width={19} height={19} />
                {t.date}
              </div>
              <button className="bg-[#4A7C59] text-[#FAF3DD] rounded-lg px-6 py-1 text-[16px] font-roboto font-medium" onClick={() => router.push('/tournament/card-view')}>View</button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#333939] flex flex-col w-full max-w-[430px] mx-auto relative pb-20">
      {/* Header */}
      <div className="flex items-center p-4 bg-[#333939] relative">
        <button onClick={() => router.back()} className="absolute left-4 text-[#D9D9D9]">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <h1 className="text-[#FAF3DD] text-[22px] font-poppins font-semibold flex-1 text-center">Tournaments</h1>
      </div>

      {/* Tabs */}
      <div className="w-full bg-[#333939]">
        <div className="flex w-full min-w-0 overflow-hidden">
          {TABS.map((tab, idx) => (
            <button
              key={tab}
              className={`flex-1 py-3 text-[14px] font-roboto font-normal whitespace-nowrap transition-colors duration-150
                ${activeTab === idx
                  ? 'text-[#FAF3DD]'
                  : 'text-[#D9D9D9]'}
              `}
              style={{ position: 'relative' }}
              onClick={() => setActiveTab(idx)}
            >
              {tab}
              {activeTab === idx && (
                <span className="absolute left-0 right-0 mx-auto bottom-0 w-full h-1 bg-[#FAF3DD] rounded-t-full" />
              )}
            </button>
          ))}
        </div>
        {/* Status Tabs on Green Bar */}
        <div className="w-full bg-[#4A7C59] flex">
          {STATUS_TABS.map((status, idx) => (
            <button
              key={status}
              className={`flex-1 py-2 text-[12px] font-roboto font-semibold relative
                ${activeStatus === idx
                  ? 'text-[#E9CB6B]'
                  : 'text-[#D9D9D9]'}
              `}
              style={{ position: 'relative' }}
              onClick={() => setActiveStatus(idx)}
            >
              {status}
              {activeStatus === idx && (
                <span className="absolute left-0 right-0 mx-auto bottom-0 w-full h-1 bg-[#E9CB6B] rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Filters Section - My Club and Filter Icon */}
      <div className="flex items-center gap-3 px-4 py-4 relative">
        <div className="flex-1 flex items-center bg-[#454D4D] rounded-xl px-4 py-2">
          <span className="text-[#D9D9D9] text-[14px] font-roboto font-normal flex-1">My Club</span>
          <button
            type="button"
            aria-pressed={myClubOnly}
            onClick={() => setMyClubOnly(v => !v)}
            className="ml-2 focus:outline-none relative flex items-center"
            style={{ minWidth: '44px', minHeight: '24px', width: 44, height: 24, padding: 0 }}
          >
            <span
              className={`absolute left-0 top-0 w-full h-full rounded-full transition-colors duration-200 ${myClubOnly ? 'bg-[#C8D5B9]' : 'bg-[#333939]'}`}
              style={{ boxSizing: 'border-box', border: '2px solid transparent' }}
            />
            <span
              className={`z-10 transition-transform duration-200 shadow rounded-full bg-[#4A7C59]`}
              style={{
                width: 22,
                height: 22,
                transform: myClubOnly ? 'translateX(20px)' : 'translateX(2px)',
                transition: 'transform 0.2s',
                boxSizing: 'border-box',
                display: 'inline-block',
              }}
            />
            <span className="sr-only">Toggle My Club</span>
          </button>
        </div>
        {activeTab === 2 ? (
          <div className="relative">
            <button onClick={() => setLeagueFilterOpen((open) => !open)} className="ml-2 bg-[#454D4D] rounded-xl p-3 flex items-center justify-center">
              <Image src="/images/filter icon.svg" alt="Filter" width={22} height={22} />
            </button>
            {leagueFilterOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg z-50">
                <div className="flex flex-col">
                  {leagueSeasons.map((season, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setSelectedSeason(season); setLeagueFilterOpen(false); }}
                      className={`text-center px-4 py-2 text-[14px] font-roboto font-normal ${selectedSeason === season ? 'bg-[#C8D5B9] text-[#222626]' : 'bg-[#232828] text-[#C8D5B9]'} ${idx === 0 ? 'rounded-t-lg' : ''} ${idx === leagueSeasons.length - 1 ? 'rounded-b-lg' : ''}`}
                    >
                      {season}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="relative" ref={filterBtnRef}>
            <button
              className={`bg-[#454D4D] rounded-xl p-3 flex items-center justify-center transition-colors ${yearDropdownOpen ? 'bg-[#333939]' : ''}`}
              onClick={() => setYearDropdownOpen((v) => !v)}
              aria-label="Filter by year"
              type="button"
            >
              <Image src="/images/filter icon.svg" alt="Filter" width={22} height={22} />
            </button>
            {yearDropdownOpen && (
              <div className="absolute right-0 mt-2 w-24 bg-[#222626] rounded-lg shadow-lg z-50 border border-[#393E3E] flex flex-col items-center">
                {yearOptions.map((year) => (
                  <button
                    key={year}
                    className={`w-full text-center px-4 py-2 font-roboto text-[14px] transition-colors
                      ${selectedYear === year ? 'bg-[#C8D5B9] text-[#222626] font-semibold' : 'bg-[#222626] text-[#D9D9D9] font-normal'}
                    `}
                    onClick={() => { setSelectedYear(year); setYearDropdownOpen(false); }}
                  >
                    {year}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {/* Type Row */}
      {!myClubOnly && activeTab !== 2 && (
        <div className="flex items-center ml-6 gap-6 mb-4">
          <span className="text-[#FAF3DD] text-[14px] font-roboto font-normal">Type :</span>
          <label className="flex items-center gap-2">
            <span className="relative flex items-center">
              <input type="radio" checked={type === 'public'} onChange={() => setType('public')} className="peer sr-only" />
              <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors duration-150 ${type === 'public' ? 'border-[#8FC7A2]' : 'border-[#8FC7A2]/50'}`}>
                {type === 'public' && <span className="w-3 h-3 rounded-full bg-[#8FC7A2]" />}
              </span>
            </span>
            <span className="text-[#FAF3DD] text-[14px] font-roboto font-normal">Public</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="relative flex items-center">
              <input type="radio" checked={type === 'private'} onChange={() => setType('private')} className="peer sr-only" />
              <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors duration-150 ${type === 'private' ? 'border-[#8FC7A2]' : 'border-[#8FC7A2]/50'}`}>
                {type === 'private' && <span className="w-3 h-3 rounded-full bg-[#8FC7A2]" />}
              </span>
            </span>
            <span className="text-[#FAF3DD] text-[14px] font-roboto font-normal">Private</span>
          </label>
        </div>
      )}

      {/* Cards Section */}
      {renderCards()}
    </div>
  );
} 