"use client";
import React, { useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

// League view types
interface LeaguePlayer {
  id: number;
  name: string;
  clubname: string;
  avatar: string;
  points: number;
}

interface LeagueClub {
  id: number;
  name: string;
  logo: string;
  points: number;
}

// League view data
const LEAGUE_PLAYERS: LeaguePlayer[] = [
  { id: 1, name: "ASHIF", clubname: "clubname", avatar: "/icons/asif match icon.svg", points: 0 },
  { id: 2, name: "SALIH", clubname: "clubname", avatar: "/icons/salih match icon.svg", points: 0 },
  { id: 3, name: "SALMAN", clubname: "clubname", avatar: "/icons/junaid match icon.svg", points: 0 },
  { id: 4, name: "JUNAID", clubname: "clubname", avatar: "/icons/junaid match icon.svg", points: 0 },
  { id: 5, name: "AKHIL", clubname: "clubname", avatar: "/icons/akhil match icon.svg", points: 0 },
  { id: 6, name: "BASITH", clubname: "clubname", avatar: "/icons/basith match icon.svg", points: 0 },
  { id: 7, name: "JACKSON", clubname: "clubname", avatar: "/icons/asif match icon.svg", points: 0 },
  { id: 8, name: "ABHISHEK", clubname: "clubname", avatar: "/icons/abhishek match icon.svg", points: 0 },
  { id: 9, name: "JHONSON", clubname: "clubname", avatar: "/icons/john match icon.svg", points: 0 },
  { id: 10, name: "NEERAJ", clubname: "clubname", avatar: "/icons/neeraj match icon.svg", points: 0 }
];

const LEAGUE_CLUBS: LeagueClub[] = [
  { id: 1, name: "ALDENAIRE FC", logo: "/icons/trnmnt club icon1.svg", points: 0 },
  { id: 2, name: "ROYAL EAGLE", logo: "/icons/trnmnt club icon2.svg", points: 0 },
  { id: 3, name: "SOLIDIER", logo: "/icons/trnmnt club icon3.svg", points: 0 },
  { id: 4, name: "SKULL COOKIE", logo: "/icons/trnmnt club icon1.svg", points: 0 },
  { id: 5, name: "PHOENIX", logo: "/icons/trnmnt club icon2.svg", points: 0 },
  { id: 6, name: "KEITHSTON", logo: "/icons/trnmnt club icon3.svg", points: 0 },
  { id: 7, name: "MICHIGAN", logo: "/icons/trnmnt club icon1.svg", points: 0 },
  { id: 8, name: "ILLINOS", logo: "/icons/trnmnt club icon2.svg", points: 0 },
  { id: 9, name: "TENNESSEE", logo: "/icons/trnmnt club icon3.svg", points: 0 },
  { id: 10, name: "BROOKLYN", logo: "/icons/trnmnt club icon1.svg", points: 0 }
];

const LEAGUE_TABS = ["Rankings", "Fixture", "Results"] as const;

const CLUBS = [
  { id: 1, name: "ALDENAIRE FC", logo: "/icons/trnmnt club icon1.svg" },
  { id: 2, name: "ROYAL EAGLE", logo: "/icons/trnmnt club icon2.svg" },
  { id: 3, name: "SOLIDIER", logo: "/icons/trnmnt club icon3.svg" },
  { id: 4, name: "SKULL COOKIE", logo: "/icons/trnmnt club icon1.svg" },
  { id: 5, name: "PHOENIX", logo: "/icons/trnmnt club icon2.svg" },
  { id: 6, name: "KEITHSTON", logo: "/icons/trnmnt club icon3.svg" },
  { id: 7, name: "MICHIGAN", logo: "/icons/trnmnt club icon1.svg" },
  { id: 8, name: "ILLINOS", logo: "/icons/trnmnt club icon2.svg" },
  { id: 9, name: "TENNESSEE", logo: "/icons/trnmnt club icon3.svg" },
  { id: 10, name: "BROOKLYN", logo: "/icons/trnmnt club icon1.svg" },
  { id: 11, name: "RAPTORS", logo: "/icons/trnmnt club icon2.svg" },
  { id: 12, name: "WARRIORS", logo: "/icons/trnmnt club icon3.svg" },
  { id: 13, name: "BULLS", logo: "/icons/trnmnt club icon1.svg" },
  { id: 14, name: "LAKERS", logo: "/icons/trnmnt club icon2.svg" },
  { id: 15, name: "CELTICS", logo: "/icons/trnmnt club icon3.svg" },
];

const fixturePlayers = [
  {
    left: { name: "Asif Rah...", avatar: "/icons/asif match icon.svg", rating: 1900 },
    right: { name: "Akhil", avatar: "/icons/akhil match icon.svg", rating: 1900 }
  },
  {
    left: { name: "Salih", avatar: "/icons/salih match icon.svg", rating: 1900 },
    right: { name: "Abhinand", avatar: "/icons/abhinand match icon.svg", rating: 1900 }
  },
  {
    left: { name: "Junaid", avatar: "/icons/junaid match icon.svg", rating: 1900 },
    right: { name: "Abhishek", avatar: "/icons/abhishek match icon.svg", rating: 1900 }
  },
  {
    left: { name: "Umershan", avatar: "/icons/umer match icon.svg", rating: 1900 },
    right: { name: "Neeraj m...", avatar: "/icons/neeraj match icon.svg", rating: 1900 }
  },
  {
    left: { name: "Basith", avatar: "/icons/basith match icon.svg", rating: 1900 },
    right: { name: "John", avatar: "/icons/john match icon.svg", rating: 1900 }
  },
];

const FIXTURES = [
  {
    id: 1,
    left: { name: "RIMBERIO QUEEN", logo: "/icons/trnmnt club icon1.svg" },
    right: { name: "ROYAL EAGLE", logo: "/icons/trnmnt club icon2.svg" },
    tournament: "King's Gambit Tournament",
    date: "Dec 25",
    time: "08:30 IST",
    players: fixturePlayers
  },
  {
    id: 2,
    left: { name: "RIMBERIO QUEEN", logo: "/icons/trnmnt club icon1.svg" },
    right: { name: "ROYAL EAGLE", logo: "/icons/trnmnt club icon2.svg" },
    tournament: "King's Gambit Tournament",
    date: "Dec 25",
    time: "08:30 IST",
    players: fixturePlayers
  },
  {
    id: 3,
    left: { name: "RIMBERIO QUEEN", logo: "/icons/trnmnt club icon1.svg" },
    right: { name: "ROYAL EAGLE", logo: "/icons/trnmnt club icon2.svg" },
    tournament: "King's Gambit Tournament",
    date: "Dec 25",
    time: "08:30 IST",
    players: fixturePlayers
  },
  {
    id: 4,
    left: { name: "RIMBERIO QUEEN", logo: "/icons/trnmnt club icon1.svg" },
    right: { name: "ROYAL EAGLE", logo: "/icons/trnmnt club icon2.svg" },
    tournament: "King's Gambit Tournament",
    date: "Dec 25",
    time: "08:30 IST",
    players: fixturePlayers
  },
  {
    id: 5,
    left: { name: "RIMBERIO QUEEN", logo: "/icons/trnmnt club icon1.svg" },
    right: { name: "ROYAL EAGLE", logo: "/icons/trnmnt club icon2.svg" },
    tournament: "King's Gambit Tournament",
    date: "Dec 25",
    time: "08:30 IST",
    players: fixturePlayers
  },
];

const RESULTS_CLUBS = [
  { id: 1, name: "Twenty7", logo: "/icons/trnmnt club icon1.svg", score: 24300, crown: true, M: 10, P: 45, W: 4, L: 5, D: 10, diff: "+10" },
  { id: 2, name: "Royal Club", logo: "/icons/trnmnt club icon2.svg", score: 18470, crown: false, M: 8, P: 35, W: 8, L: 8, D: 8, diff: "-8" },
  { id: 3, name: "King Maker", logo: "/icons/trnmnt club icon3.svg", score: 16740, crown: false, M: 7, P: 30, W: 7, L: 7, D: 7, diff: "+7" },
  { id: 4, name: "Royal Eagle", logo: "/icons/trnmnt club icon2.svg", score: 14440, crown: false, M: 12, P: 34, W: 4, L: 14, D: 14, diff: "-14" },
  { id: 5, name: "Spartans", logo: "/icons/trnmnt club icon1.svg", score: 14000, crown: false, M: 9, P: 32, W: 6, L: 8, D: 9, diff: "+5" },
  { id: 6, name: "Tigers", logo: "/icons/trnmnt club icon2.svg", score: 13500, crown: false, M: 8, P: 30, W: 5, L: 7, D: 8, diff: "-2" },
  { id: 7, name: "Panthers", logo: "/icons/trnmnt club icon3.svg", score: 13000, crown: false, M: 7, P: 28, W: 4, L: 6, D: 7, diff: "+3" },
  { id: 8, name: "Wolves", logo: "/icons/trnmnt club icon1.svg", score: 12500, crown: false, M: 6, P: 26, W: 3, L: 5, D: 6, diff: "-1" },
  { id: 9, name: "Falcons", logo: "/icons/trnmnt club icon2.svg", score: 12000, crown: false, M: 5, P: 24, W: 2, L: 4, D: 5, diff: "-4" },
  { id: 10, name: "Dragons", logo: "/icons/trnmnt club icon3.svg", score: 11500, crown: false, M: 4, P: 22, W: 1, L: 3, D: 4, diff: "-6" },
];
const RESULTS_PLAYERS = [
  { id: 1, name: "EidenJoe", avatar: "/icons/akhil match icon.svg", score: 2430, club: "clubname", crown: true, M: 10, P: 45, W: 4, L: 5, D: 10, diff: "+10" },
  { id: 2, name: "Jackson", avatar: "/icons/asif match icon.svg", score: 1847, club: "clubname", crown: false, M: 8, P: 35, W: 8, L: 8, D: 8, diff: "-8" },
  { id: 3, name: "Emma", avatar: "/icons/junaid match icon.svg", score: 1674, club: "clubname", crown: false, M: 7, P: 30, W: 7, L: 7, D: 7, diff: "+7" },
  { id: 4, name: "Salih", avatar: "/icons/salih match icon.svg", score: 1450, club: "clubname", crown: false, M: 12, P: 34, W: 4, L: 14, D: 14, diff: "-14" },
  { id: 5, name: "Abhinadh", avatar: "/icons/abhinand match icon.svg", score: 1400, club: "clubname", crown: false, M: 8, P: 35, W: 8, L: 8, D: 8, diff: "-8" },
  { id: 6, name: "Umershan", avatar: "/icons/umer match icon.svg", score: 1370, club: "clubname", crown: false, M: 7, P: 30, W: 7, L: 7, D: 7, diff: "+7" },
  { id: 7, name: "Asif", avatar: "/icons/asif match icon.svg", score: 1340, club: "clubname", crown: false, M: 12, P: 34, W: 4, L: 14, D: 14, diff: "-14" },
  { id: 8, name: "Nikhil", avatar: "/icons/akhil match icon.svg", score: 1300, club: "clubname", crown: false, M: 6, P: 28, W: 5, L: 6, D: 6, diff: "+2" },
  { id: 9, name: "Ravi", avatar: "/icons/junaid match icon.svg", score: 1280, club: "clubname", crown: false, M: 5, P: 26, W: 4, L: 5, D: 5, diff: "-1" },
  { id: 10, name: "Vishal", avatar: "/icons/umer match icon.svg", score: 1250, club: "clubname", crown: false, M: 4, P: 24, W: 3, L: 4, D: 4, diff: "-3" },
];

const TABS = ["Clubs", "Fixture", "Results"];

// Podium component for both Players and Clubs
interface PodiumItem {
  id: number;
  name: string;
  score: number;
  crown?: boolean;
  club?: string;
  rating?: number;
}
interface PodiumProps {
  podium: PodiumItem[];
  podiumAvatars: string[];
  isPlayers: boolean;
}
function Podium({ podium, podiumAvatars, isPlayers }: PodiumProps) {
  return (
    <div className="flex items-end justify-center mb-4 mt-8" style={{ gap: 0 }}>
      {podium.map((item, idx) => {
        const isCenter = idx === 1;
        const isLeft = idx === 0;
        const isRight = idx === 2;
        let podiumBg = '';
        if (isCenter) podiumBg = '/images/first player rectangle.svg';
        else if (isLeft) podiumBg = '/images/second player rectangle.svg';
        else if (isRight) podiumBg = '/images/third player rectangle.svg';
        return (
          <div key={item.id} className={`flex flex-col items-center ${isCenter ? 'z-10' : 'z-0'}`}> 
            {item.crown && (
              <svg width="36" height="28" viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-1">
                <path d="M2 10L10 18L18 2L26 18L34 10" stroke="#FFD600" strokeWidth="3" fill="none"/>
                <circle cx="18" cy="2" r="2" fill="#FFD600" />
              </svg>
            )}
            <div className="relative flex flex-col items-center justify-end bg-[#333939]" style={{ width: isCenter ? 124 : 110, height: isCenter ? 155 : isLeft ? 113 : 92 }}>
              <Image src={podiumBg} alt="Podium BG" fill style={{ objectFit: 'contain' }} />
              <div className="absolute top-0 left-0 w-full flex flex-col items-center justify-end" style={{ height: '100%' }}>
                {isCenter ? (
                  <>
                    {item.crown && (
                      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: -70, zIndex: 20 }}>
                        <Image src="/images/crown.svg" alt="Crown" width={36} height={28} />
                      </div>
                    )}
                    <div
                      className="absolute left-1/2 -translate-x-1/2"
                      style={{ top: -41, width: 82, height: 82, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
                    >
                      <Image
                        src={podiumAvatars[idx]}
                        alt={`Winner ${idx+1}`}
                        width={82}
                        height={82}
                        className="rounded-full"
                        style={{ width: 82, height: 82 }}
                      />
                    </div>
                  </>
                ) : (
                  <Image
                    src={podiumAvatars[idx]}
                    alt={`Winner ${idx+1}`}
                    width={isLeft ? 68 : 54}
                    height={isLeft ? 68 : 54}
                    className="rounded-full mt-[-24px] mb-1"
                    style={{ width: isLeft ? 68 : 54, height: isLeft ? 68 : 54 }}
                  />
                )}
                <div className="flex flex-col items-center mt-1 leading-tight justify-center h-full">
                  <span className="text-[#FAF3DD] text-[16px] font-roboto font-medium text-center whitespace-nowrap mb-1">{item.name}</span>
                  <span className={`${isCenter ? 'text-[#E9CB6B]' : 'text-[#C8D5B9]'} text-[16px] font-roboto font-medium text-center whitespace-nowrap mb-1`}>{item.score}</span>
                  {isPlayers && (
                    <span className="text-[#8FC0A9] text-[12px] font-roboto font-normal text-center whitespace-nowrap">{item.club}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Add this new interface for league fixtures
interface LeagueFixture {
  id: number;
  leftTeam: {
    name: string;
    logo: string;
  };
  rightTeam: {
    name: string;
    logo: string;
  };
  score: string;
  tournament: string;
  date: string;
  time: string;
  players: typeof fixturePlayers;
}

// Add league fixtures data
const LEAGUE_FIXTURES: LeagueFixture[] = [
  {
    id: 1,
    leftTeam: { name: "RIMBERIO QUEEN", logo: "/icons/trnmnt club icon1.svg" },
    rightTeam: { name: "ROYAL EAGLE", logo: "/icons/trnmnt club icon2.svg" },
    score: "0 : 0",
    tournament: "CLUB MASTER PREMIER LEAGUE",
    date: "Dec 25",
    time: "08:30 UTC",
    players: fixturePlayers
  },
  {
    id: 2,
    leftTeam: { name: "RIMBERIO QUEEN", logo: "/icons/trnmnt club icon1.svg" },
    rightTeam: { name: "ROYAL EAGLE", logo: "/icons/trnmnt club icon2.svg" },
    score: "0 : 0",
    tournament: "CLUB MASTER PREMIER LEAGUE",
    date: "Dec 25",
    time: "08:30 UTC",
    players: fixturePlayers
  },
  {
    id: 3,
    leftTeam: { name: "RIMBERIO QUEEN", logo: "/icons/trnmnt club icon1.svg" },
    rightTeam: { name: "ROYAL EAGLE", logo: "/icons/trnmnt club icon2.svg" },
    score: "0 : 0",
    tournament: "CLUB MASTER PREMIER LEAGUE",
    date: "Dec 25",
    time: "08:30 UTC",
    players: fixturePlayers
  },
  {
    id: 4,
    leftTeam: { name: "RIMBERIO QUEEN", logo: "/icons/trnmnt club icon1.svg" },
    rightTeam: { name: "ROYAL EAGLE", logo: "/icons/trnmnt club icon2.svg" },
    score: "0 : 0",
    tournament: "CLUB MASTER PREMIER LEAGUE",
    date: "Dec 25",
    time: "08:30 UTC",
    players: fixturePlayers
  }
];

export default function CardViewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isLeagueView = searchParams.get('type') === 'league';
  
  // League view states
  const [leagueActiveTab, setLeagueActiveTab] = useState(0);
  const [rankingType, setRankingType] = useState<'players' | 'clubs'>('players');
  
  // Tournament view states
  const [tournamentActiveTab, setTournamentActiveTab] = useState(0);
  const [expandedFixtures, setExpandedFixtures] = useState<{ [id: number]: boolean }>({});
  const [resultsType, setResultsType] = useState<'players' | 'clubs'>('players');

  // League View Component
  const LeagueView = () => (
    <div className="h-screen bg-[#333939] flex flex-col w-full max-w-[430px] mx-auto relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center p-4 bg-[#333939] relative">
        <button onClick={() => router.back()} className="absolute left-4 text-[#D9D9D9]">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <h1 className="text-[#FAF3DD] text-[22px] font-poppins font-semibold flex-1 text-center">League</h1>
      </div>

      {/* Tournament Info Card */}
      <div className="bg-[#4A7C59] rounded-xl mx-4 mt-2 p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[#FAF3DD] text-[22px] font-semibold font-poppins">King's Gambit</div>
            <div className="text-[#FAF3DD] text-[16px] font-semibold font-poppins">Tournament</div>
          </div>
          <div className="flex items-center gap-2 bg-[#1F2323] rounded-full px-3 py-1">
            <Image src="/icons/countdown icon.svg" alt="Countdown" width={17} height={17} />
            <span className="text-[#FAF3DD] text-[10px] font-bold font-roboto">12hrs</span>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <Image src="/icons/trnmnt club icon1.svg" alt="Club" width={28} height={28} className="rounded-full" />
            <div className="flex flex-col">
              <span className="text-[#FAF3DD] text-[10px] font-semibold font-roboto">by</span>
              <span className="text-[#FAF3DD] text-[10px] font-semibold font-roboto">Athani Club</span>
            </div>
          </div>
          <div className="text-[#FAF3DD] text-[10px] font-semibold font-roboto">25 Clubs Joined</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex w-full mt-6">
        {LEAGUE_TABS.map((tab, idx) => (
          <button
            key={tab}
            className={`flex-1 py-2 text-[16px] font-roboto relative
              ${leagueActiveTab === idx ? 'text-[#FAF3DD] font-medium' : 'text-[#D9D9D9] font-normal'}
            `}
            onClick={() => setLeagueActiveTab(idx)}
          >
            {tab}
            {leagueActiveTab === idx && (
              <span className="absolute left-0 right-0 mx-auto bottom-0 w-full h-1 bg-[#E9CB6B] rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 bg-[#333939] overflow-hidden">
        {leagueActiveTab === 0 && ( // Rankings Tab
          <div className="px-4 py-4 h-full flex flex-col">
            {/* Toggle between Players and Clubs */}
            <div className="flex items-center gap-4 mb-4">
              <label className="flex items-center gap-2">
                <span className="relative flex items-center">
                  <input
                    type="radio"
                    checked={rankingType === 'players'}
                    onChange={() => setRankingType('players')}
                    className="peer sr-only"
                  />
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-150 ${rankingType === 'players' ? 'border-[#8FC7A2]' : 'border-[#8FC7A2]/50'}`}>
                    {rankingType === 'players' && <span className="w-2.5 h-2.5 rounded-full bg-[#8FC7A2]" />}
                  </span>
                </span>
                <span className="text-[#D9D9D9] text-[14px] font-roboto">Players</span>
              </label>
              <label className="flex items-center gap-2">
                <span className="relative flex items-center">
                  <input
                    type="radio"
                    checked={rankingType === 'clubs'}
                    onChange={() => setRankingType('clubs')}
                    className="peer sr-only"
                  />
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-150 ${rankingType === 'clubs' ? 'border-[#8FC7A2]' : 'border-[#8FC7A2]/50'}`}>
                    {rankingType === 'clubs' && <span className="w-2.5 h-2.5 rounded-full bg-[#8FC7A2]" />}
                  </span>
                </span>
                <span className="text-[#D9D9D9] text-[14px] font-roboto">Clubs</span>
              </label>
            </div>

            {/* Rankings List */}
            <div className="flex flex-col gap-1 flex-1 overflow-y-auto hide-scrollbar">
              {rankingType === 'players' ? (
                // Players List
                LEAGUE_PLAYERS.map((player) => (
                  <div key={player.id} className="flex items-center gap-2 bg-[#4C5454] rounded-xl px-4 py-2">
                    <span className="text-[#D9D9D9] text-[16px] font-medium font-roboto w-4">{player.id}</span>
                    <div className="flex items-center gap-3 flex-1">
                      <Image src={player.avatar} alt={player.name} width={32} height={32} className="rounded-full" />
                      <div className="flex flex-col">
                        <span className="text-[#D9D9D9] text-[16px] font-medium font-roboto">{player.name}</span>
                        <span className="text-[#8FC0A9] text-[12px] font-normal font-roboto">{player.clubname}</span>
                      </div>
                    </div>
                    <span className="text-[#D9D9D9] text-[16px] font-medium font-roboto">{player.points}</span>
                  </div>
                ))
              ) : (
                // Clubs List
                LEAGUE_CLUBS.map((club) => (
                  <div key={club.id} className="flex items-center gap-2 bg-[#4C5454] rounded-xl px-4 py-2 min-h-[56px]">
                    <span className="text-[#D9D9D9] text-[16px] font-medium font-roboto w-4">{club.id}</span>
                    <div className="flex items-center gap-3 flex-1 items-center">
                      <Image src={club.logo} alt={club.name} width={32} height={32} className="rounded-full" />
                      <span className="ml-2 truncate whitespace-nowrap text-[#D9D9D9] font-medium" style={{ maxWidth: '120px' }}>{club.name}</span>
                    </div>
                    <span className="text-[#D9D9D9] text-[16px] font-medium font-roboto">{club.points}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {leagueActiveTab === 1 && ( // Fixture Tab
          <div className="px-4 py-4 h-full overflow-y-auto hide-scrollbar">
            <div className="flex flex-col gap-3">
              {LEAGUE_FIXTURES.map((fixture) => {
                const expanded = !!expandedFixtures[fixture.id];
                return (
                  <div key={fixture.id} className="rounded-xl overflow-hidden" style={{ background: 'linear-gradient(to right, #4A7C59, #4C5454)' }}>
                    {/* Top section with teams and score */}
                    <div className="relative px-6 py-4 flex items-center justify-between">
                      {/* Background Rook */}
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-15 pointer-events-none">
                        <Image src="/images/rook logo in match card.svg" alt="Rook" width={87} height={80} />
                      </div>
                      {/* Left Team */}
                      <div className="flex flex-col items-center z-10">
                        <Image 
                          src={fixture.leftTeam.logo} 
                          alt={fixture.leftTeam.name} 
                          width={32} 
                          height={32} 
                          className="rounded-full"
                        />
                        <span className="text-[#FAF3DD] text-[14px] font-medium font-roboto mt-2">
                          {fixture.leftTeam.name}
                        </span>
                      </div>
                      {/* Score - Centered absolutely */}
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[#FAF3DD] text-[22px] font-extrabold font-roboto z-20">
                        {fixture.score}
                      </div>
                      {/* Right Team */}
                      <div className="flex flex-col items-center z-10">
                        <Image 
                          src={fixture.rightTeam.logo} 
                          alt={fixture.rightTeam.name} 
                          width={32} 
                          height={32} 
                          className="rounded-full"
                        />
                        <span className="text-[#FAF3DD] text-[14px] font-medium font-roboto mt-2">
                          {fixture.rightTeam.name}
                        </span>
                      </div>
                    </div>
                    {/* Bottom section with tournament info */}
                    <div className="bg-[#232828] px-4 py-3 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[#FAF3DD] text-[14px] font-normal font-roboto">
                          {fixture.tournament}
                        </span>
                        <span className="text-[#C8D5B9] text-[12px] font-normal font-roboto">
                          {fixture.date}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-[#C8D5B9] text-[#232828] text-[12px] font-medium font-roboto px-3 py-1 rounded-md">
                          {fixture.time}
                        </span>
                        <button
                          onClick={() => setExpandedFixtures(prev => ({ ...prev, [fixture.id]: !prev[fixture.id] }))}
                          className="ml-1 flex items-center justify-center"
                          aria-label="Toggle fixture players"
                        >
                          <svg
                            className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                            width="18" height="18" fill="none" viewBox="0 0 16 16"
                          >
                            <path d="M4 6l4 4 4-4" stroke="#C8D5B9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                    {/* Player list (expand/collapse) - reuse tournament fixture expansion design */}
                    {expanded && fixture.players && fixture.players.length > 0 && (
                      <div className="bg-[#454D4D] rounded-xl p-2 flex flex-col gap-2 hide-scrollbar" style={{ maxHeight: 240, overflowY: 'auto' }}>
                        {fixture.players.map((match: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between bg-[#4C5454] rounded-lg px-4 py-2">
                            {/* Left player */}
                            <div className="flex items-center gap-2 min-w-0">
                              <Image src={match.left.avatar} alt={match.left.name} width={32} height={32} className="rounded-full" />
                              <div className="truncate">
                                <div className="text-[#D9D9D9] text-[16px] font-roboto font-normal">{match.left.name}</div>
                                <div className="text-[#8FC7A2] text-[12px] font-medium font-roboto">Rating:{match.left.rating}</div>
                              </div>
                            </div>
                            <span className="text-[#E9CB6B] font-medium text-[16px] font-roboto">vs</span>
                            {/* Right player (icon on left, text left-aligned) */}
                            <div className="flex items-center gap-2 min-w-0">
                              <Image src={match.right.avatar} alt={match.right.name} width={32} height={32} className="rounded-full" />
                              <div className="truncate text-left">
                                <div className="text-[#D9D9D9] text-[16px] font-roboto font-normal">{match.right.name}</div>
                                <div className="text-[#8FC7A2] text-[12px] font-medium font-roboto">Rating:{match.right.rating}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {leagueActiveTab === 2 && ( // Results Tab
          <div className="h-full flex flex-col overflow-hidden">
            {/* Toggle section - Fixed, match tournament style */}
            <div className="flex-shrink-0 bg-[#333939] pb-2">
              <div className="flex items-center gap-8 pl-8">
                <label className="flex items-center cursor-pointer gap-2">
                  <span className="relative w-5 h-5 flex items-center justify-center">
                    <input
                      type="radio"
                      name="leagueResultsType"
                      value="players"
                      checked={rankingType === 'players'}
                      onChange={() => setRankingType('players')}
                      className="appearance-none w-5 h-5 rounded-full border-2 border-[#8FC7A2] checked:bg-transparent checked:border-[#8FC7A2] focus:outline-none"
                    />
                    {rankingType === 'players' && (
                      <span className="absolute rounded-full bg-[#8FC7A2]" style={{ width: 10, height: 10, left: 5, top: 5 }} />
                    )}
                  </span>
                  <span className="text-[#D9D9D9] text-[14px] font-roboto font-normal">Players</span>
                </label>
                <label className="flex items-center cursor-pointer gap-2">
                  <span className="relative w-5 h-5 flex items-center justify-center">
                    <input
                      type="radio"
                      name="leagueResultsType"
                      value="clubs"
                      checked={rankingType === 'clubs'}
                      onChange={() => setRankingType('clubs')}
                      className="appearance-none w-5 h-5 rounded-full border-2 border-[#8FC7A2] checked:bg-transparent checked:border-[#8FC7A2] focus:outline-none"
                    />
                    {rankingType === 'clubs' && (
                      <span className="absolute rounded-full bg-[#8FC7A2]" style={{ width: 10, height: 10, left: 5, top: 5 }} />
                    )}
                  </span>
                  <span className="text-[#D9D9D9] text-[14px] font-roboto font-normal">Clubs</span>
                </label>
              </div>
            </div>
            {/* Podium */}
            {(() => {
              const podiumData = rankingType === 'players'
                ? [RESULTS_PLAYERS[1], RESULTS_PLAYERS[0], RESULTS_PLAYERS[2]]
                : [RESULTS_CLUBS[1], RESULTS_CLUBS[0], RESULTS_CLUBS[2]];
              const podiumAvatars = rankingType === 'players'
                ? podiumData.map(p => (p as typeof RESULTS_PLAYERS[0]).avatar)
                : podiumData.map(p => (p as typeof RESULTS_CLUBS[0]).logo);
              return <Podium podium={podiumData} podiumAvatars={podiumAvatars} isPlayers={rankingType === 'players'} />;
            })()}
            {/* Table */}
            <div className="px-2 pb-4">
              <div className="overflow-y-auto hide-scrollbar bg-[#232828] rounded-xl mt-2" style={{ maxHeight: 400 }}>
                <table className="w-full text-sm text-left text-gray-300">
                  <thead className="text-xs text-gray-400 uppercase bg-[#1F2323] sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-3 w-10 text-center">#</th>
                      <th className="px-2 py-3 w-[30%] text-left">{rankingType === 'players' ? 'Players' : 'Clubs'}</th>
                      <th className="px-2 py-3 w-10 text-center">M</th>
                      <th className="px-2 py-3 w-10 text-center">P</th>
                      <th className="px-2 py-3 w-10 text-center">W</th>
                      <th className="px-2 py-3 w-10 text-center">L</th>
                      <th className="px-2 py-3 w-10 text-center">D</th>
                      <th className="px-2 py-3 w-12 text-center">+/-</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(rankingType === 'players' ? RESULTS_PLAYERS : RESULTS_CLUBS).map((item, index) => (
                      <tr key={item.id} className={`${index % 2 === 0 ? 'bg-[#333939]' : 'bg-[#3A4141]'} border-b border-gray-700`}>
                        <td className="px-2 py-2 text-center font-medium text-[#D9D9D9]">#{index + 1}</td>
                        <td className="px-2 py-2">
                          <div className="flex items-center min-w-0">
                            <Image
                              src={rankingType === 'players' ? (item as typeof RESULTS_PLAYERS[0]).avatar : (item as typeof RESULTS_CLUBS[0]).logo}
                              alt={item.name}
                              width={28}
                              height={28}
                              className="rounded-full"
                            />
                            <span className="ml-2 truncate whitespace-nowrap text-[#D9D9D9] font-medium" style={{ maxWidth: '120px' }}>{item.name}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-center">{(item as any).M}</td>
                        <td className="px-2 py-2 text-center">{(item as any).P}</td>
                        <td className="px-2 py-2 text-center">{(item as any).W}</td>
                        <td className="px-2 py-2 text-center">{(item as any).L}</td>
                        <td className="px-2 py-2 text-center">{(item as any).D}</td>
                        <td className="px-2 py-2 text-center">{(item as any).diff}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Tournament View Component (existing code)
  const TournamentView = () => (
    <div className="flex flex-col h-screen bg-[#333939] w-full max-w-[430px] mx-auto relative">
      {/* Header - Fixed height */}
      <div className="flex-shrink-0 flex items-center p-4 bg-[#333939] relative">
        <button onClick={() => router.back()} className="absolute left-4 text-[#D9D9D9]">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <h1 className="text-[#FAF3DD] text-[22px] font-poppins font-semibold flex-1 text-center">Public Tournament</h1>
      </div>

      {/* Tournament Info Card - Fixed height */}
      <div className="flex-shrink-0 bg-[#4A7C59] rounded-xl mx-4 mt-2 p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[#FAF3DD] text-[22px] font-semibold font-poppins">King's Gambit</div>
            <div className="text-[#FAF3DD] text-[16px] font-semibold font-poppins">Tournament</div>
          </div>
          <div className="flex items-center gap-2 bg-[#1F2323] rounded-full px-3 py-1">
            <Image src="/icons/countdown icon.svg" alt="Countdown" width={17} height={17} />
            <span className="text-[#FAF3DD] text-[10px] font-bold font-roboto">12hrs</span>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <Image src="/icons/trnmnt club icon1.svg" alt="Club" width={28} height={28} className="rounded-full" />
            <div className="flex flex-col">
              <span className="text-[#FAF3DD] text-[10px] font-semibold font-roboto">by</span>
              <span className="text-[#FAF3DD] text-[10px] font-semibold font-roboto">Athani Club</span>
            </div>
          </div>
          <div className="text-[#FAF3DD] text-[10px] font-semibold font-roboto">25 Clubs Joined</div>
        </div>
      </div>

      {/* Tabs - Fixed height */}
      <div className="flex-shrink-0 flex w-full mt-6">
        {TABS.map((tab, idx) => (
          <button
            key={tab}
            className={`flex-1 py-2 text-[14px] font-normal font-roboto relative
              ${tournamentActiveTab === idx ? 'text-[#FAF3DD]' : 'text-[#D9D9D9]'}
            `}
            onClick={() => setTournamentActiveTab(idx)}
          >
            {tab}
            {tournamentActiveTab === idx && (
              <span className="absolute left-0 right-0 mx-auto bottom-0 w-full h-1 bg-[#E9CB6B] rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* Content Area - Scrollable, takes remaining height */}
      <div className="flex-1 overflow-hidden">
        {/* Clubs List */}
        {tournamentActiveTab === 0 && (
          <div className="h-full overflow-y-auto px-4 py-4 hide-scrollbar">
            <div className="flex flex-col gap-1">
              {CLUBS.map((club) => (
                <div key={club.id} className="flex items-center gap-3 bg-[#4C5454] rounded-xl px-4 py-2">
                  <span className="text-[#D9D9D9] text-[16px] font-medium font-roboto w-6 text-center">{club.id}</span>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center">
                    <Image src={club.logo} alt={club.name} width={32} height={32} />
                  </div>
                  <span className="text-[#D9D9D9] text-[16px] font-medium font-roboto ml-2">{club.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fixture List */}
        {tournamentActiveTab === 1 && (
          <div className="h-full overflow-y-auto px-4 py-4 hide-scrollbar">
            <div className="flex flex-col gap-3">
              {FIXTURES.map((fixture) => {
                const expanded = !!expandedFixtures[fixture.id];
                return (
                  <div key={fixture.id} className="relative rounded-xl overflow-hidden ml-1 mr-1 w-[calc(100%-5px)] mb-2" style={{ background: 'linear-gradient(to right, #4A7C59, #4C5454)' }}>
                    {/* Top section: keep current green/gradient background */}
                    <div className="relative h-[90px] w-full flex items-center justify-between px-4">
                      {/* Club 1 */}
                      <div className="flex flex-col items-center z-10">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center">
                          <Image src={fixture.left.logo} alt={fixture.left.name} width={32} height={32} />
                        </div>
                        <span className="text-[#FAF3DD] text-[14px] font-semibold font-roboto mt-1 text-center whitespace-nowrap">{fixture.left.name}</span>
                      </div>
                      {/* Centered Rook + VS */}
                      <div className="relative flex flex-col items-center justify-center flex-1" style={{ minWidth: 120, minHeight: 80 }}>
                        {/* Rook SVG absolutely centered */}
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-15 pointer-events-none">
                          <Image src="/images/rook logo in match card.svg" alt="Rook" width={87} height={80} />
                        </div>
                        {/* VS text in foreground */}
                        <span className="text-[#FAF3DD] text-[18px] font-semibold font-roboto z-10 relative">VS</span>
                      </div>
                      {/* Club 2 */}
                      <div className="flex flex-col items-center z-10">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center">
                          <Image src={fixture.right.logo} alt={fixture.right.name} width={32} height={32} />
                        </div>
                        <span className="text-[#FAF3DD] text-[14px] font-semibold font-roboto mt-1 text-center whitespace-nowrap">{fixture.right.name}</span>
                      </div>
                    </div>
                    {/* Bottom section: Black_Rectangle.svg as background */}
                    <div className="relative w-full h-[55px]">
                      <Image src="/images/Black_Rectangle.svg" alt="Bottom BG" fill style={{ objectFit: 'cover' }} />
                      <div className="absolute inset-0 flex items-center justify-between px-6">
                        <div className="flex flex-col justify-center">
                          <div className="text-[#FAF3DD] text-[14px] font-normal font-roboto">{fixture.tournament}</div>
                          <div className="text-[#FAF3DD] text-[12px] font-normal font-roboto">{fixture.date}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="bg-[#C8D5B9] rounded-md px-4 py-1 text-[#232828] text-[12px] font-medium font-roboto">
                            {fixture.time}
                          </button>
                          <button
                            onClick={() => setExpandedFixtures(prev => ({ ...prev, [fixture.id]: !prev[fixture.id] }))}
                            className="ml-1 flex items-center justify-center"
                            aria-label="Toggle fixture players"
                          >
                            <svg
                              className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                              width="18" height="18" fill="none" viewBox="0 0 16 16"
                            >
                              <path d="M4 6l4 4 4-4" stroke="#C8D5B9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Player list (expand/collapse) */}
                    {expanded && fixture.players && fixture.players.length > 0 && (
                      <div className="bg-[#454D4D] rounded-xl p-2 flex flex-col gap-2 hide-scrollbar" style={{ maxHeight: 240, overflowY: 'auto' }}>
                        {fixture.players.map((match: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between bg-[#4C5454] rounded-lg px-4 py-2">
                            {/* Left player */}
                            <div className="flex items-center gap-2 min-w-0">
                              <Image src={match.left.avatar} alt={match.left.name} width={32} height={32} className="rounded-full" />
                              <div className="truncate">
                                <div className="text-[#D9D9D9] text-[16px] font-roboto font-normal">{match.left.name}</div>
                                <div className="text-[#8FC7A2] text-[12px] font-medium font-roboto">Rating:{match.left.rating}</div>
                              </div>
                            </div>
                            <span className="text-[#E9CB6B] font-medium text-[16px] font-roboto">vs</span>
                            {/* Right player (icon on left, text left-aligned) */}
                            <div className="flex items-center gap-2 min-w-0">
                              <Image src={match.right.avatar} alt={match.right.name} width={32} height={32} className="rounded-full" />
                              <div className="truncate text-left">
                                <div className="text-[#D9D9D9] text-[16px] font-roboto font-normal">{match.right.name}</div>
                                <div className="text-[#8FC7A2] text-[12px] font-medium font-roboto">Rating:{match.right.rating}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Results */}
        {tournamentActiveTab === 2 && (
          <div className="h-full flex flex-col overflow-hidden">
            {/* Toggle section - Fixed */}
            <div className="flex-shrink-0 bg-[#333939] pb-2">
              <div className="flex items-center gap-8 pl-8">
                <label className="flex items-center cursor-pointer gap-2">
                  <span className="relative w-5 h-5 flex items-center justify-center">
                    <input
                      type="radio"
                      name="resultsType"
                      value="players"
                      checked={resultsType === 'players'}
                      onChange={() => setResultsType('players')}
                      className="appearance-none w-5 h-5 rounded-full border-2 border-[#8FC7A2] checked:bg-transparent checked:border-[#8FC7A2] focus:outline-none"
                    />
                    {resultsType === 'players' && (
                      <span className="absolute rounded-full bg-[#8FC7A2]" style={{ width: 10, height: 10, left: 5, top: 5 }} />
                    )}
                  </span>
                  <span className="text-[#D9D9D9] text-[14px] font-roboto font-normal">Players</span>
                </label>
                <label className="flex items-center cursor-pointer gap-2">
                  <span className="relative w-5 h-5 flex items-center justify-center">
                    <input
                      type="radio"
                      name="resultsType"
                      value="clubs"
                      checked={resultsType === 'clubs'}
                      onChange={() => setResultsType('clubs')}
                      className="appearance-none w-5 h-5 rounded-full border-2 border-[#8FC7A2] checked:bg-transparent checked:border-[#8FC7A2] focus:outline-none"
                    />
                    {resultsType === 'clubs' && (
                      <span className="absolute rounded-full bg-[#8FC7A2]" style={{ width: 10, height: 10, left: 5, top: 5 }} />
                    )}
                  </span>
                  <span className="text-[#D9D9D9] text-[14px] font-roboto font-normal">Clubs</span>
                </label>
              </div>
            </div>

            {/* Content area with fixed podium and scrollable table */}
            <div className="flex-1 flex flex-col px-4 overflow-hidden">
              {resultsType === 'clubs' ? (
                <>
                  {/* Fixed podium for clubs */}
                  <div className="flex-shrink-0 mt-4">
                    {(() => {
                      const podium = [RESULTS_CLUBS[1], RESULTS_CLUBS[0], RESULTS_CLUBS[2]];
                      const podiumAvatars = [
                        '/icons/winner club2.svg',
                        '/icons/winner club1.svg',
                        '/icons/winner club3.svg',
                      ];
                      return <Podium podium={podium} podiumAvatars={podiumAvatars} isPlayers={false} />;
                    })()}
                  </div>
                  
                  {/* Scrollable table for clubs (both axes) */}
                  <div className="overflow-y-auto hide-scrollbar bg-[#232828] rounded-xl mt-2" style={{ maxHeight: 400 }}>
                    <table className="w-full text-sm text-left text-gray-300">
                      <thead className="text-xs text-gray-400 uppercase bg-[#1F2323] sticky top-0 z-10">
                        <tr>
                          <th className="px-2 py-3 w-10 text-center">#</th>
                          <th className="px-2 py-3 w-auto text-center">Clubs</th>
                          <th className="px-2 py-3 w-10 text-center">M</th>
                          <th className="px-2 py-3 w-10 text-center">P</th>
                          <th className="px-2 py-3 w-10 text-center">W</th>
                          <th className="px-2 py-3 w-10 text-center">L</th>
                          <th className="px-2 py-3 w-10 text-center">D</th>
                          <th className="px-2 py-3 w-12 text-center">+/-</th>
                        </tr>
                      </thead>
                      <tbody>
                        {RESULTS_CLUBS.slice(0, 10).map((item, idx) => (
                          <tr key={item.id} className={`${idx % 2 === 0 ? 'bg-[#333939]' : 'bg-[#3A4141]'} border-b border-gray-700`}>
                            <td className="px-2 py-2 text-center">{idx + 1}</td>
                            <td className="px-2 py-2">
                              <div className="flex items-center">
                                <Image src={item.logo} alt={item.name} width={24} height={24} className="rounded-full" />
                                <span className="ml-2 truncate whitespace-nowrap text-[#D9D9D9] font-medium" style={{ maxWidth: '120px' }}>{item.name}</span>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-center">{item.M}</td>
                            <td className="px-2 py-2 text-center">{item.P}</td>
                            <td className="px-2 py-2 text-center">{item.W}</td>
                            <td className="px-2 py-2 text-center">{item.L}</td>
                            <td className="px-2 py-2 text-center">{item.D}</td>
                            <td className="px-2 py-2 text-center">{item.diff}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <>
                  {/* Fixed podium for players */}
                  <div className="flex-shrink-0 mt-4">
                    {(() => {
                      const podium = [RESULTS_PLAYERS[1], RESULTS_PLAYERS[0], RESULTS_PLAYERS[2]];
                      const podiumAvatars = [
                        '/images/winner2 avatar.svg',
                        '/images/winner1 avatar.svg',
                        '/images/winner3 avatar.svg',
                      ];
                      return <Podium podium={podium} podiumAvatars={podiumAvatars} isPlayers={true} />;
                    })()}
                  </div>
                  
                  {/* Scrollable table for players (both axes) */}
                  <div className="overflow-y-auto hide-scrollbar bg-[#232828] rounded-xl mt-2" style={{ maxHeight: 400 }}>
                    <table className="w-full text-sm text-left text-gray-300">
                      <thead className="text-xs text-gray-400 uppercase bg-[#1F2323] sticky top-0 z-10">
                        <tr>
                          <th className="px-2 py-3 w-10 text-center">#</th>
                          <th className="px-2 py-3 w-auto text-center">Players</th>
                          <th className="px-2 py-3 w-10 text-center">M</th>
                          <th className="px-2 py-3 w-10 text-center">P</th>
                          <th className="px-2 py-3 w-10 text-center">W</th>
                          <th className="px-2 py-3 w-10 text-center">L</th>
                          <th className="px-2 py-3 w-10 text-center">D</th>
                          <th className="px-2 py-3 w-12 text-center">+/-</th>
                        </tr>
                      </thead>
                      <tbody>
                        {RESULTS_PLAYERS.slice(0, 10).map((item, idx) => (
                          <tr key={item.id} className={`${idx % 2 === 0 ? 'bg-[#333939]' : 'bg-[#3A4141]'} border-b border-gray-700`}>
                            <td className="px-2 py-2 text-center">{idx + 1}</td>
                            <td className="px-2 py-2">
                              <div className="flex items-center">
                                <Image src={item.avatar} alt={item.name} width={24} height={24} className="rounded-full" />
                                <span className="ml-2 truncate whitespace-nowrap text-[#D9D9D9] font-medium" style={{ maxWidth: '120px' }}>{item.name}</span>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-center">{item.M}</td>
                            <td className="px-2 py-2 text-center">{item.P}</td>
                            <td className="px-2 py-2 text-center">{item.W}</td>
                            <td className="px-2 py-2 text-center">{item.L}</td>
                            <td className="px-2 py-2 text-center">{item.D}</td>
                            <td className="px-2 py-2 text-center">{item.diff}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return isLeagueView ? <LeagueView /> : <TournamentView />;
} 