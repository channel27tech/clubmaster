import React from 'react';
import { Dialog } from '@headlessui/react';
import { BecomeClubmasterModal } from '.';
import { useRouter } from 'next/navigation';

interface TournamentOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBecomeClubmaster: (date: string, time: string) => void;
}

const TournamentOptionsModal: React.FC<TournamentOptionsModalProps> = ({
  isOpen,
  onClose,
  onBecomeClubmaster,
}) => {
  const router = useRouter();
  const [showBecomeClubmasterModal, setShowBecomeClubmasterModal] = React.useState(false);

  const handleBecomeClubmasterClick = () => {
    onClose(); // Close the options modal
    setShowBecomeClubmasterModal(true);
  };

  const handleInterClubTournamentClick = () => {
    onClose(); // Close the options modal
    router.push('/tournament/create');
  };

  const handleBecomeClubmasterSubmit = (date: string, time: string) => {
    setShowBecomeClubmasterModal(false);
    onBecomeClubmaster(date, time);
  };

  return (
    <>
      <Dialog
        open={isOpen}
        onClose={onClose}
        className="relative z-50"
      >
        {/* The backdrop, rendered as a fixed sibling to the panel container */}
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />

        {/* Full-screen container to center the panel */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-[366px] h-[287px] rounded-[10px] bg-[#4C5454]/90 backdrop-blur-xl py-12 px-8">
            <div className="flex flex-col justify-center h-full gap-6">
              <button
                onClick={handleInterClubTournamentClick}
                className="w-full h-[52px] bg-[#4A7C59] text-[#FAF3DD] font-medium rounded-lg"
              >
                Inter Club Tournament
              </button>
              
              <button
                onClick={handleBecomeClubmasterClick}
                className="w-full h-[52px] bg-[#4A7C59] text-[#FAF3DD] font-medium rounded-lg"
              >
                Become Clubmaster
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      <BecomeClubmasterModal
        isOpen={showBecomeClubmasterModal}
        onClose={() => setShowBecomeClubmasterModal(false)}
        onSubmit={handleBecomeClubmasterSubmit}
      />
    </>
  );
};

export default TournamentOptionsModal;