"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import BottomNavigation from "../../components/BottomNavigation";

export default function EditProfilePage() {
  const router = useRouter();
  return (
    <div className="min-h-screen flex flex-col bg-[#333939] max-w-[430px] mx-auto pb-20 relative">
      {/* Header with logo and back arrow */}
      <div className="flex flex-col items-center pt-4 pb-2 relative">
        <button onClick={() => router.back()} className="absolute left-4 top-1/2 -translate-y-1/2">
          <Image src="/icons/back arrow option.svg" alt="Back" width={24} height={24} />
        </button>
        <Image src="/logos/clubmaster-logo.svg" alt="Club Master Logo" width={120} height={40} />
      </div>
      {/* Green Profile header with border */}
      <div className="flex justify-center px-4">
        <div className="w-full max-w-[380px] bg-[#4A7C59] rounded-[10px] py-2 text-center text-lg font-semibold text-[#FAF3DD] mb-6 border" style={{ borderColor: '#E9CB6B' }}>Profile</div>
      </div>
      {/* Profile fields */}
      <div className="flex-1 w-full max-w-[380px] mx-auto flex flex-col gap-2">
        {/* Profile Picture */}
        <div className="flex items-center justify-between px-2 py-2">
          <span className="text-[#D9D9D9] text-base">Profile Picture</span>
          <Image src="/images/abhi icon.svg" alt="Profile" width={44} height={44} className="rounded-full" />
        </div>
        {/* Username */}
        <div className="flex items-center justify-between px-2 py-2">
          <span className="text-[#D9D9D9] text-base">Username</span>
          <span className="text-[#FAF3DD] text-base font-medium">abhishektn27</span>
        </div>
        {/* First Name */}
        <div className="flex items-center justify-between px-2 py-2">
          <span className="text-[#D9D9D9] text-base">First Name</span>
          <span className="text-[#FAF3DD] text-base font-medium">abhishek</span>
        </div>
        {/* Last Name */}
        <div className="flex items-center justify-between px-2 py-2">
          <span className="text-[#D9D9D9] text-base">Last Name</span>
          <span className="text-[#FAF3DD] text-base font-medium">tn</span>
        </div>
        {/* Country */}
        <div className="flex items-center justify-between px-2 py-2">
          <span className="text-[#D9D9D9] text-base">Country</span>
          <span className="flex items-center gap-2">
            <Image src="/images/china flag.svg" alt="China" width={28} height={20} />
          </span>
        </div>
        {/* Location */}
        <div className="flex items-center justify-between px-2 py-2">
          <span className="text-[#D9D9D9] text-base">Location</span>
          <span className="text-[#FAF3DD] text-base font-medium">Thrissur</span>
        </div>
      </div>
      {/* Save Button */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-[380px] px-4 z-20">
        <button className="w-full text-[#D9D9D9] text-lg font-semibold py-3 border rounded-[10px]" style={{ background: '#152317', borderColor: '#E9CB6B' }}>Save</button>
      </div>
      {/* Footer Navigation */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-30">
        <BottomNavigation />
      </div>
    </div>
  );
} 