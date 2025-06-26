import React from 'react';

interface ClubInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ClubInfoModal: React.FC<ClubInfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'rgba(34, 38, 38, 0.84)', // #222626 with 84% opacity
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="relative w-[90vw] max-w-md rounded-lg shadow-lg"
        style={{ background: '#4C5454', color: '#d9d9d9' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-3 rounded-t-lg"
          style={{ background: '#4A7C59' }}
        >
          <h2 className="text-lg font-semibold tracking-wide w-full text-center">Club Information</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-[#d9d9d9] hover:text-white text-xl font-bold focus:outline-none"
          >
            ×
          </button>
        </div>
        {/* Content */}
        <div className="px-6 py-5">
          <p className="mb-4 text-sm">
            Win the game to increase your club's credit while deducting the credit from the losing club.
          </p>
          <div className="mb-2 font-semibold">What You Can Do:</div>
          <ul className="list-disc list-inside mb-4 text-sm space-y-1">
            <li>Set Rating Deduction Limits: Admins can select rating deduction values from predefined limits (200, 300, 400, or 500 points).</li>
            <li>Define Match Stakes: Players compete in matches where the loser's club rating is deducted by the set value, and the winner earns a normal rating increase.</li>
          </ul>
          <div className="mb-2 font-semibold">Duration:</div>
          <p className="mb-4 text-sm">
            The rating adjustments take effect immediately upon the completion of the match.
          </p>
          <div className="mb-2 font-semibold">Conditions:</div>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li>If You Win: The winner's rating increases normally.</li>
            <li>If You Lose: Your club rating is reduced by the specified deduction rate.</li>
            <li>If the Game is a Draw: No rating changes occur for either club.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ClubInfoModal; 