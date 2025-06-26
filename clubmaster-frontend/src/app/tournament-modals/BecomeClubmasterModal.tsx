import React from 'react';
import { Dialog } from '@headlessui/react';
import Image from 'next/image';

interface BecomeClubmasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (date: string, time: string) => void;
}

const BecomeClubmasterModal: React.FC<BecomeClubmasterModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [selectedDate, setSelectedDate] = React.useState('');
  const [selectedTime, setSelectedTime] = React.useState('');
  const dateInputRef = React.useRef<HTMLInputElement>(null);
  const timeInputRef = React.useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    onSubmit(selectedDate, selectedTime);
  };

  const handleDateIconClick = () => {
    dateInputRef.current?.showPicker();
  };

  const handleTimeIconClick = () => {
    timeInputRef.current?.showPicker();
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
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-[366px] rounded-[10px] bg-[#4C5454]/90 backdrop-blur-xl p-6">
          <div className="space-y-6">
            {/* Set Date */}
            <div className="space-y-4">
              <label className="text-[#D9D9D9] text-sm">Set Date</label>
              <div className="relative flex items-center">
                <button 
                  className="absolute left-3 cursor-pointer"
                  onClick={handleDateIconClick}
                  type="button"
                >
                  <Image 
                    src="/icons/tournament date icon.svg"
                    alt="Date Icon"
                    width={19}
                    height={19}
                  />
                </button>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  placeholder="dd-mm-yyyy"
                  className="w-full h-[40px] bg-[#D9D9D9] rounded-lg pl-10 pr-4 text-[#333939] [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden [&::-webkit-clear-button]:hidden"
                />
              </div>
            </div>

            {/* Set Time */}
            <div className="space-y-4">
              <label className="text-[#D9D9D9] text-sm">Set Time</label>
              <div className="relative flex items-center">
                <button 
                  className="absolute left-3 cursor-pointer"
                  onClick={handleTimeIconClick}
                  type="button"
                >
                  <Image 
                    src="/icons/tournament time icon.svg"
                    alt="Time Icon"
                    width={22}
                    height={22}
                  />
                </button>
                <input
                  ref={timeInputRef}
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  placeholder="--:--"
                  className="w-full h-[40px] bg-[#D9D9D9] rounded-lg pl-12 pr-4 text-[#333939] [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden [&::-webkit-clear-button]:hidden"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
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
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default BecomeClubmasterModal; 