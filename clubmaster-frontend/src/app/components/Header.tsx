import React from 'react';
import Image from 'next/image';

const Header = () => {
  return (
    <header className="bg-[#2B3131] w-full">
      <div className="container mx-auto px-4 py-2 flex justify-center items-center">
        <div className="flex items-center justify-center">
          {/* New SVG logo loaded as an Image component */}
          <Image 
            src="/logo.svg" 
            alt="Club Master Logo" 
            width={118} 
            height={48} 
            priority
          />
        </div>
      </div>
    </header>
  );
};

export default Header; 