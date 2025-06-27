import React from 'react';
import { Dialog } from '@headlessui/react';
import { TournamentFormData } from '.';

interface InterClubTournamentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TournamentFormData) => void;
}

const InterClubTournamentModal: React.FC<InterClubTournamentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = React.useState<TournamentFormData>({
    name: '',
    schedule: '',
    tournamentType: '',
    playerSelection: 'system',
    eligibility: '',
  });
  const [showHelp, setShowHelp] = React.useState(false);

  const handleSubmit = () => {
    onSubmit(formData);
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="relative z-50"
    >
      {/* The backdrop, rendered as a fixed sibling to the panel container */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />

      {/* Full-screen container to center the panel */}
      <div className="fixed inset-0 flex items-center justify-center">
        <Dialog.Panel className="w-full max-w-[430px] h-[932px] max-h-full rounded-[10px] bg-[#333939] text-[#FAF3DD] relative flex flex-col mx-auto my-auto">
          {/* Header */}
          <div className="flex items-center p-4 border-b border-[#4C5454]">
            <button onClick={onClose} className="text-[#BFC0C0]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
            </button>
            <h2 className="flex-1 text-center text-lg font-medium">Inter Club Tournament</h2>
          </div>

          {/* Form Content */}
          <div className="p-6">
            <h3 className="text-sm mb-4">Create tournament</h3>
            
            <div className="space-y-4">
              {/* Tournament Name */}
              <div className="space-y-1">
                <label className="text-sm text-[#BFC0C0]">Tournament Name</label>
                <input
                  type="text"
                  placeholder="Name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full h-[40px] rounded-lg bg-[#4C5454] px-4 text-[#FAF3DD] placeholder-[#BFC0C0]/50"
                />
              </div>

              {/* Schedule */}
              <div className="space-y-1">
                <label className="text-sm text-[#BFC0C0]">Schedule</label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    value={formData.schedule}
                    onChange={(e) => setFormData(prev => ({ ...prev, schedule: e.target.value }))}
                    className="w-full h-[40px] rounded-lg bg-[#4C5454] px-4 text-[#FAF3DD]"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-[#BFC0C0]">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Tournament Type */}
              <div className="space-y-1">
                <label className="text-sm text-[#BFC0C0]">Tournament Type</label>
                <select
                  value={formData.tournamentType}
                  onChange={(e) => setFormData(prev => ({ ...prev, tournamentType: e.target.value }))}
                  className="w-full h-[40px] rounded-lg bg-[#4C5454] px-4 text-[#FAF3DD] appearance-none"
                >
                  <option value="">Select</option>
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </select>
              </div>

              {/* Eligibility */}
              <div className="space-y-1">
                <label className="text-sm text-[#BFC0C0]">Eligibility</label>
                <select
                  value={formData.eligibility}
                  onChange={(e) => setFormData(prev => ({ ...prev, eligibility: e.target.value }))}
                  className="w-full h-[40px] rounded-lg bg-[#4C5454] px-4 text-[#FAF3DD] appearance-none"
                >
                  <option value="">Select</option>
                  <option value="rating">Rating</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Set Rating - only show if eligibility is 'rating' */}
              {formData.eligibility === 'rating' && (
                <div className="space-y-1">
                  <label className="text-sm text-[#BFC0C0]">Set Rating</label>
                  <input
                    type="text"
                    placeholder="Type here"
                    className="w-full h-[40px] rounded-lg bg-[#4C5454] px-4 text-[#FAF3DD] placeholder-[#BFC0C0]/50"
                  />
                </div>
              )}

              {/* Player Selection */}
              <div className="space-y-2">
                <label className="text-sm text-[#BFC0C0]">Player Selection</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={formData.playerSelection === 'system'}
                      onChange={() => setFormData(prev => ({ ...prev, playerSelection: 'system' }))}
                      className="w-4 h-4 accent-[#4A7C59]"
                    />
                    <span className="text-sm">By System</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={formData.playerSelection === 'manual'}
                      onChange={() => setFormData(prev => ({ ...prev, playerSelection: 'manual' }))}
                      className="w-4 h-4 accent-[#4A7C59]"
                    />
                    <span className="text-sm">Manually</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 mt-6">
              <button
                onClick={handleSubmit}
                className="flex-1 h-[40px] bg-[#4A7C59] text-[#FAF3DD] font-medium rounded-lg"
              >
                Create
              </button>
              <button
                onClick={onClose}
                className="flex-1 h-[40px] bg-transparent text-[#FAF3DD] font-medium rounded-lg border border-[#4A7C59]"
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Help Button */}
          <button 
            onClick={() => setShowHelp(!showHelp)}
            className="absolute bottom-4 right-4 w-6 h-6 rounded-full bg-[#8FC0A9] flex items-center justify-center"
          >
            <span className="text-[#1F2323] text-sm font-medium">?</span>
          </button>

          {/* Info Box - Only shown when help is clicked */}
          {showHelp && (
            <div className="absolute bottom-14 right-4 w-[300px] p-4 rounded-lg bg-[#4C5454] text-[#BFC0C0] text-sm shadow-lg">
              <p className="mb-2">Each tournament can join minimum 4 to maximum 15 clubs.</p>
              <p className="mb-2">Each club must select 5 players for representing their club.</p>
              <p className="mb-2">Each tournament can join minimum 4 to maximum 15 clubs.</p>
              <p className="mb-2">Each tournament can join minimum 4 to maximum 15 clubs.</p>
              <p className="mb-2">Each tournament can join minimum 4 to maximum 15 clubs.</p>
              <p className="mb-2">Each tournament can join minimum 4 to maximum 15 clubs.</p>
              <p>Each tournament can join minimum 4 to maximum 15 clubs.</p>
            </div>
          )}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default InterClubTournamentModal; 