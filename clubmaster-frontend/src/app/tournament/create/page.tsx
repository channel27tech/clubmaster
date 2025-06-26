'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { TournamentFormData } from '../../tournament-modals';

interface Player {
  id: number;
  name: string;
  rating: number;
  isChampion?: boolean;
  selected?: boolean;
  avatar?: string;
}

export default function CreateTournamentPage() {
  const router = useRouter();
  const [showHelp, setShowHelp] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [players, setPlayers] = React.useState<Player[]>([
    { id: 1, name: 'Salih', rating: 900, isChampion: true, avatar: '/icons/salih tournament icon.svg' },
    { id: 2, name: 'Junaid', rating: 200, avatar: '/icons/junaidh tournament icon.svg' },
    { id: 3, name: 'Akhil', rating: 1100, avatar: '/icons/akhil tournament icon.svg' }
  ]);
  const [formData, setFormData] = React.useState<TournamentFormData>({
    name: '',
    schedule: '',
    tournamentType: 'public',
    eligibility: '',
    playerSelection: 'system'
  });
  const [ratingValue, setRatingValue] = React.useState('');

  const handleSubmit = () => {
    // TODO: Implement tournament creation logic
    console.log('Creating tournament:', formData);
    router.back();
  };

  const togglePlayerSelection = (playerId: number) => {
    setPlayers(players.map(player => 
      player.id === playerId 
        ? { ...player, selected: !player.selected }
        : player
    ));
  };

  return (
    <div className="min-h-screen bg-[#333939] flex flex-col w-full max-w-[430px] mx-auto relative">
      {/* Header */}
      <div className="flex items-center p-4 bg-[#333939] relative">
        <button onClick={() => router.back()} className="absolute left-4 text-[#D9D9D9]">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <h1 className="text-[#FAF3DD] text-[22px] font-poppins font-semibold flex-1 text-center">Inter Club Tournament</h1>
      </div>

      {/* Create Tournament Section */}
      <div className="p-4">
        <div className="border-b border-[#4C5454] pb-2 mb-6">
          <h2 className="text-[#D9D9D9] text-[18px] font-poppins font-semibold">Create tournament</h2>
        </div>

        <div className="space-y-6">
          {/* Tournament Name */}
          <div className="flex items-center gap-4">
            <label className="text-[#D9D9D9] text-[16px] font-roboto font-normal min-w-[140px]">Tournament Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Name"
              className="w-[236px] h-[31px] bg-[#4C5454] rounded-lg px-4 text-[#D9D9D9] placeholder-[#808080] text-[14px] font-roboto font-normal"
            />
          </div>

          {/* Schedule */}
          <div className="flex items-center gap-4">
            <label className="text-[#D9D9D9] text-[16px] font-roboto font-normal min-w-[140px]">Schedule</label>
            <div className="relative w-[236px]">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg width="17" height="15" viewBox="0 0 17 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g clipPath="url(#clip0_3563_57544)">
                    <path d="M9.76995 9.60703C10.3877 9.60703 10.9403 9.15328 10.9403 8.50078C10.9403 7.72078 10.4194 7.34766 9.79367 7.34766C9.21444 7.34766 8.63916 7.71047 8.63916 8.48203C8.63916 9.24797 9.17589 9.60703 9.76995 9.60703Z" fill="#C8D5B9"/>
                    <path d="M3.93614 0C4.06722 0 4.19293 0.049386 4.28561 0.137294C4.3783 0.225201 4.43037 0.34443 4.43037 0.46875V0.9375H12.338V0.46875C12.338 0.34443 12.39 0.225201 12.4827 0.137294C12.5754 0.049386 12.7011 0 12.8322 0C12.9633 0 13.089 0.049386 13.1817 0.137294C13.2744 0.225201 13.3264 0.34443 13.3264 0.46875V0.9375H14.3149C14.8392 0.9375 15.342 1.13504 15.7128 1.48667C16.0835 1.83831 16.2918 2.31522 16.2918 2.8125V13.125C16.2918 13.6223 16.0835 14.0992 15.7128 14.4508C15.342 14.8025 14.8392 15 14.3149 15H2.45346C1.92916 15 1.42632 14.8025 1.05558 14.4508C0.684843 14.0992 0.476563 13.6223 0.476562 13.125V2.8125C0.476563 2.31522 0.684843 1.83831 1.05558 1.48667C1.42632 1.13504 1.92916 0.9375 2.45346 0.9375H3.44192V0.46875C3.44192 0.34443 3.49399 0.225201 3.58667 0.137294C3.67936 0.049386 3.80506 0 3.93614 0ZM13.7752 2.8125H2.99217C2.69564 2.8125 2.45346 3.0225 2.45346 3.28125V4.21875C2.45346 4.4775 2.69465 4.6875 2.99217 4.6875H13.7762C14.0727 4.6875 14.3149 4.4775 14.3149 4.21875V3.28125C14.3149 3.0225 14.0737 2.8125 13.7752 2.8125ZM9.70474 11.9906C10.9482 11.9906 11.6816 10.9903 11.6816 9.29813C11.6816 7.485 10.9097 6.79688 9.7512 6.79688C8.83589 6.79688 7.97495 7.42687 7.97495 8.49281C7.97495 9.58031 8.78944 10.1522 9.6316 10.1522C10.369 10.1522 10.8474 9.79969 10.9986 9.41156H11.0253C11.0214 10.6453 10.5696 11.4403 9.73538 11.4403C9.07905 11.4403 8.73903 11.0184 8.69751 10.6716H8.02141C8.06787 11.2716 8.60855 11.9906 9.70474 11.9906ZM6.84812 6.89531H6.22243C5.77447 7.12233 5.3411 7.37433 4.92459 7.65V8.30156C5.29526 8.06062 5.8824 7.72031 6.16806 7.57313H6.17993V11.895H6.84713L6.84812 6.89531Z" fill="#C8D5B9"/>
                  </g>
                  <defs>
                    <clipPath id="clip0_3563_57544">
                      <rect width="15.8152" height="15" fill="white" transform="translate(0.476562)"/>
                    </clipPath>
                  </defs>
                </svg>
              </div>
              <input
                type="datetime-local"
                value={formData.schedule}
                onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                className="w-[202.4px] h-[31px] bg-[#4C5454] rounded-lg pl-10 pr-4 text-[#D9D9D9] text-[14px] font-roboto font-normal [&::-webkit-calendar-picker-indicator]:opacity-0"
              />
            </div>
          </div>

          {/* Tournament Type */}
          <div className="flex items-center gap-4">
            <label className="text-[#D9D9D9] text-[16px] font-roboto font-normal min-w-[140px]">Tournament Type</label>
            <div className="relative w-[236px]">
              <select
                value={formData.tournamentType}
                onChange={(e) => setFormData({ ...formData, tournamentType: e.target.value, eligibility: '' })}
                className="w-full h-[31px] bg-[#4C5454] rounded-lg px-4 text-[#D9D9D9] appearance-none focus:outline-none text-center text-[14px] font-roboto font-normal"
              >
                <option value="private" className="bg-[#1F2323] text-center">Private</option>
                <option value="public" className="bg-[#1F2323] text-center">Public</option>
              </select>
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1.5L6 6.5L11 1.5" stroke="#D9D9D9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Eligibility - Only for Private */}
          {formData.tournamentType === 'private' && (
            <>
              <div className="flex items-center gap-4 mt-2">
                <label className="text-[#D9D9D9] text-[16px] font-roboto font-normal min-w-[140px]">Eligibility</label>
                <div className="flex-1 relative">
                  <select
                    value={formData.eligibility}
                    onChange={(e) => setFormData({ ...formData, eligibility: e.target.value })}
                    className="w-full h-9 bg-[#4C5454] rounded-lg px-4 text-[#D9D9D9] appearance-none focus:outline-none text-center text-[14px] font-roboto font-normal"
                  >
                    <option value="rating" className="bg-[#1F2323] text-center">Rating</option>
                    <option value="invite_only" className="bg-[#1F2323] text-center">Invite only</option>
                    <option value="credits" className="bg-[#1F2323] text-center">Credits</option>
                  </select>
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 1.5L6 6.5L11 1.5" stroke="#D9D9D9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </div>
              {/* Set Rating Field */}
              {formData.eligibility === 'rating' && (
                <div className="flex items-center gap-4 mt-2">
                  <label className="text-[#D9D9D9] text-[16px] font-roboto font-normal min-w-[140px]">Set Rating</label>
                  <input
                    type="text"
                    value={ratingValue}
                    onChange={e => setRatingValue(e.target.value)}
                    placeholder="Type here"
                    className="flex-1 h-9 bg-[#4C5454] rounded-lg px-4 text-[#D9D9D9] placeholder-[#808080] text-[14px] font-roboto font-normal"
                  />
                </div>
              )}
            </>
          )}

          {/* Player Selection - Always show */}
          <div className="flex items-center gap-4 mt-2">
            <label className="text-[#D9D9D9] text-[16px] font-roboto font-normal min-w-[140px]">Player Selection</label>
            <div className="flex-1 flex gap-6 items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="relative flex items-center">
                  <input
                    type="radio"
                    value="system"
                    checked={formData.playerSelection === 'system'}
                    onChange={(e) => setFormData({ ...formData, playerSelection: 'system' })}
                    className="peer sr-only"
                  />
                  <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors duration-150 ${formData.playerSelection === 'system' ? 'border-[#8FC7A2]' : 'border-[#8FC7A2]/50'}`}>
                    {formData.playerSelection === 'system' && <span className="w-3 h-3 rounded-full bg-[#8FC7A2]" />}
                  </span>
                </span>
                <span className="text-[#D9D9D9] text-[14px] font-roboto font-normal">System</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="relative flex items-center">
                  <input
                    type="radio"
                    value="manual"
                    checked={formData.playerSelection === 'manual'}
                    onChange={(e) => setFormData({ ...formData, playerSelection: 'manual' })}
                    className="peer sr-only"
                  />
                  <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors duration-150 ${formData.playerSelection === 'manual' ? 'border-[#8FC7A2]' : 'border-[#8FC7A2]/50'}`}>
                    {formData.playerSelection === 'manual' && <span className="w-3 h-3 rounded-full bg-[#8FC7A2]" />}
                  </span>
                </span>
                <span className="text-[#D9D9D9] text-[14px] font-roboto font-normal">Manual</span>
              </label>
            </div>
          </div>
          {/* Manual Player Selection Interface */}
          {formData.playerSelection === 'manual' && (
            <div className="mt-4 bg-[#1F2323] rounded-lg p-4">
              {/* Search Bar */}
              <div className="relative mb-4">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 14L10 10M11.3333 6.66667C11.3333 9.244 9.244 11.3333 6.66667 11.3333C4.08934 11.3333 2 9.244 2 6.66667C2 4.08934 4.08934 2 6.66667 2C9.244 2 11.3333 4.08934 11.3333 6.66667Z" stroke="#808080" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search.."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 bg-[#4C5454] rounded-lg pl-10 pr-4 text-[#D9D9D9] placeholder-[#808080] text-[14px] font-roboto font-normal"
                />
              </div>

              {/* Players List */}
              <div className="max-h-[200px] overflow-y-auto scrollbar-hide bg-[#333939] rounded-xl px-2 py-2">
                {players.filter(player => player.name.toLowerCase().includes(searchQuery.toLowerCase())).map((player, idx, arr) => (
                  <div key={player.id} className={`flex items-center justify-between px-2 py-1.5 ${idx !== arr.length - 1 ? 'border-b border-[#444]' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#4C5454] flex items-center justify-center text-[#D9D9D9] text-xl font-semibold overflow-hidden">
                        {player.avatar ? (
                          <img src={player.avatar} alt={player.name} className="w-full h-full object-cover rounded-full" />
                        ) : (
                          player.name.charAt(0)
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[#FAF3DD] text-[16px] font-roboto font-medium">{player.name}</span>
                          {player.isChampion && (
                            <svg width="22" height="17" viewBox="0 0 22 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M19.2068 7.33301C19.0326 7.19793 18.8209 7.11106 18.5961 7.0823C18.3712 7.05354 18.1421 7.08405 17.935 7.17036L14.0815 8.76149L11.8425 5.0135C11.7355 4.83852 11.5804 4.693 11.3931 4.59176C11.2059 4.49053 10.993 4.43719 10.7763 4.43719C10.5596 4.43719 10.3468 4.49053 10.1595 4.59176C9.97218 4.693 9.81713 4.83852 9.71011 5.0135L7.47111 8.76149L3.61759 7.17036C3.41007 7.08418 3.18073 7.05362 2.95548 7.08214C2.73023 7.11067 2.51807 7.19713 2.34298 7.33176C2.16788 7.46639 2.03684 7.64382 1.96466 7.84399C1.89248 8.04416 1.88205 8.25909 1.93454 8.46448L3.86891 16.1231C3.9059 16.2714 3.97492 16.4111 4.07179 16.5339C4.16866 16.6567 4.29136 16.7599 4.43247 16.8373C4.6235 16.9435 4.84192 16.9997 5.06457 17C5.1728 16.9998 5.28047 16.9855 5.38443 16.9576C8.91034 16.0524 12.6347 16.0524 16.1606 16.9576C16.4825 17.0362 16.8249 16.9929 17.1125 16.8373C17.2545 16.7609 17.3779 16.658 17.4749 16.535C17.5719 16.4121 17.6404 16.2718 17.6761 16.1231L19.6181 8.46448C19.67 8.25904 19.659 8.04421 19.5863 7.84427C19.5136 7.64432 19.3822 7.46724 19.2068 7.33301Z" fill="#E0B42A"/>
                              <circle cx="10.776" cy="2.53552" r="2.53552" fill="#E0B42A"/>
                              <circle cx="10.7759" cy="11.4098" r="1.90164" fill="#CDA21E"/>
                              <circle cx="19.9673" cy="6.65575" r="1.5847" fill="#E0B42A"/>
                              <circle cx="1.5847" cy="6.65575" r="1.5847" fill="#E0B42A"/>
                              <circle cx="6.02187" cy="12.3607" r="0.950821" fill="#CDA21E"/>
                              <circle cx="15.5302" cy="12.3607" r="0.950821" fill="#CDA21E"/>
                            </svg>
                          )}
                        </div>
                        <span className="text-[#8FC0A9] text-[12px] font-roboto font-normal">Rating:{player.rating}</span>
                      </div>
                    </div>
                    {!player.isChampion && (
                      <button
                        onClick={() => togglePlayerSelection(player.id)}
                        className={
                          player.selected
                            ? 'border border-[#4A7C59] text-[#FAF3DD] bg-transparent font-roboto font-medium text-[10px] rounded-lg w-[90px] h-8'
                            : 'bg-[#4A7C59] text-[#FAF3DD] font-roboto font-medium text-[10px] rounded-lg w-[90px] h-8'
                        }
                      >
                        {player.selected ? 'Unselect' : 'Select'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mt-8">
          <button
            className="bg-[#4A7C59] text-[#FAF3DD] text-[16px] font-roboto font-medium px-6 py-2 rounded-lg"
            onClick={handleSubmit}
          >
            Create
          </button>
          <button
            className="border border-[#4A7C59] text-[#FAF3DD] text-[16px] font-roboto font-medium px-6 py-2 rounded-lg"
            onClick={() => router.back()}
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Help Button */}
      <button 
        onClick={() => setShowHelp(!showHelp)}
        className="fixed bottom-4 right-4 w-8 h-8 rounded-full bg-[#4A7C59] flex items-center justify-center"
      >
        <span className="text-[#FFFFFF] text-base font-medium">?</span>
      </button>

      {/* Info Box - Only shown when help is clicked */}
      {showHelp && (
        <div className="fixed bottom-14 right-4 w-[300px] p-4 rounded-lg bg-[#4C5454] shadow-lg">
          <p className="mb-2 text-[#D9D9D9] text-[12px] font-roboto font-normal">Each tournament can join minimum 4 to maximum 15 clubs.</p>
          <p className="mb-2 text-[#D9D9D9] text-[12px] font-roboto font-normal">Each club must select 5 players for representing their club.</p>
          <p className="mb-2 text-[#D9D9D9] text-[12px] font-roboto font-normal">Each tournament can join minimum 4 to maximum 15 clubs.</p>
          <p className="mb-2 text-[#D9D9D9] text-[12px] font-roboto font-normal">Each tournament can join minimum 4 to maximum 15 clubs.</p>
          <p className="mb-2 text-[#D9D9D9] text-[12px] font-roboto font-normal">Each tournament can join minimum 4 to maximum 15 clubs.</p>
          <p className="mb-2 text-[#D9D9D9] text-[12px] font-roboto font-normal">Each tournament can join minimum 4 to maximum 15 clubs.</p>
          <p className="text-[#D9D9D9] text-[12px] font-roboto font-normal">Each tournament can join minimum 4 to maximum 15 clubs.</p>
        </div>
      )}
    </div>
  );
} 