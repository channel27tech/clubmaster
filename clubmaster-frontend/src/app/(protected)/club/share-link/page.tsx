'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface ShareLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareLinkModal: React.FC<ShareLinkModalProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const shareUrl = 'https://t.me/Free_Educational_Resources/525/526'; // Example URL

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      // Optionally, show a toast or confirmation message
      console.log('Link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy link: ', err);
    }
  };

  const handleNativeShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Club Master Club Link',
        text: 'Check out this club on Club Master!',
        url: shareUrl,
      })
      .then(() => console.log('Successful share'))
      .catch((error) => console.log('Error sharing', error));
    } else {
      handleCopyLink(); 
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
      onClick={onClose}
    >
      <div 
        className="bg-[#333939] p-4 rounded-lg shadow-xl flex flex-col items-center justify-around"
        style={{ width: '373px', height: '146px' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-1" style={{ color: '#FAF3DD' }}>Share</h3>
        <div className="mb-3 flex items-center bg-[#333939] rounded-full border border-dashed border-[#E9CB6B] overflow-hidden"
          style={{ width: '341px', height: '42px' }}
        >
          <input 
            type="text" 
            readOnly 
            value={shareUrl} 
            className="flex-1 bg-transparent text-[#FAF3DD] text-xs py-2 px-4 border-none outline-none truncate"
            style={{ color: '#FAF3DD' }}
          />
          <button 
            className="p-2 flex items-center justify-center bg-[#333939] rounded-full border-none outline-none"
            onClick={handleCopyLink}
            title="Copy link"
            style={{ minWidth: '36px', minHeight: '36px' }}
          >
            <Image src="/images/copy icon.svg" alt="Copy" width={18} height={18} />
          </button>
        </div>
        <button 
          className=""
          title="Share via other apps"
          onClick={handleNativeShare}
        >
          <Image src="/images/share icon.svg" alt="Share" width={22} height={22} />
        </button>
      </div>
    </div>
  );
};

export default function ShareLinkPage() {
  const router = useRouter();
  const shareUrl = 'https://t.me/Free_Educational_Resources/525/526'; // Example URL

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      // Optionally, show a toast or confirmation message
      console.log('Link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy link: ', err);
    }
  };

  // Placeholder for actual native share functionality if needed
  const handleNativeShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Club Master Club Link',
        text: 'Check out this club on Club Master!',
        url: shareUrl,
      })
      .then(() => console.log('Successful share'))
      .catch((error) => console.log('Error sharing', error));
    } else {
      console.log('Native share not supported, could fall back to other methods or just copy.');
      // As a fallback for this button, we can just trigger copy again or do nothing if copy is primary
      handleCopyLink(); 
    }
  };

  return (
    <div className="min-h-screen bg-[#333939] flex flex-col items-center w-full max-w-[400px] mx-auto relative">
      {/* Header with Back Button */}
      <div className="w-full p-4 flex items-center justify-start sticky top-0 z-20 bg-[#333939]">
        <button 
          onClick={() => router.back()} 
          className="text-[#BFC0C0]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
      </div>

      {/* Centered Modal Area */}
      <div className="flex items-center justify-center flex-1">
        <div 
          className="bg-[#333939] p-4 rounded-lg shadow-xl flex flex-col items-center justify-around"
          style={{ width: '373px', height: '146px' }}
        >
          <h3 className="text-lg font-semibold text-white mb-3">Share</h3>
          <div className="relative w-[325px] h-[40px] mb-3">
            <input 
              type="text" 
              readOnly 
              value={shareUrl} 
              className="w-full h-full bg-[#3A3D3D] text-gray-300 px-3 pr-10 rounded-md border border-[#5A5E64] text-xs focus:outline-none"
            />
            <button 
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1"
              onClick={handleCopyLink}
              title="Copy link"
            >
              <Image src="/images/copy icon.svg" alt="Copy" width={18} height={18} />
            </button>
          </div>
          <button 
            className="p-2 bg-[#3A3D3D] rounded-full border border-[#5A5E64] hover:bg-[#5A5E64] transition-colors"
            title="Share via other apps"
            onClick={handleNativeShare}
          >
            <Image src="/images/share icon.svg" alt="Share" width={22} height={22} />
          </button>
        </div>
      </div>
    </div>
  );
} 