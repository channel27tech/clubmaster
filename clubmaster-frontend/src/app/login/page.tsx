"use client";
import Image from "next/image";
import React from "react";

const USP_CARDS = [
  {
    text: "Rule as the ClubMaster",
    img: "/images/clubmaster_usp_1.svg",
  },
  {
    text: "Compete for Tournament Glory",
    img: "/images/clubmaster_usp_2.svg",
  },
  {
    text: "Unite for your Club",
    img: "/images/clubmaster_usp_3.svg",
  },
  {
    text: "Risk it All for the Bet",
    img: "/images/clubmaster_usp_4.svg",
  },
  {
    text: "Battle for Ratings",
    img: "/images/clubmaster_usp_5.svg",
  },
];

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-between" style={{ background: "#4A7C59" }}>
      {/* Logo */}
      <div className="w-full flex justify-center mt-8 mb-6">
        <Image src="/logos/clubmaster_logo_login_page.svg" alt="ClubMaster Logo" width={118} height={48} />
      </div>
     {/* USP Cards */}
     <div className="w-full flex justify-center mb-8">
        <div className="flex gap-8 overflow-x-auto px-4 scrollbar-hide hide-scrollbar" style={{ maxWidth: 400 }}>
          {USP_CARDS.map((card, idx) => (
            <div
              key={idx}
              className="flex items-center rounded-[10px] shadow-lg min-w-[366px] max-w-[366px] h-[111px] bg-gradient-to-l from-[#3D6649] to-[#333939] p-2"
              style={{ flex: "0 0 366px" }}
            >
              <div className="flex-shrink-0  mr-4 flex items-center justify-center">
                <Image src={card.img} alt="USP" width={173.88} height={97} className="object-contain" />
              </div>
              <div className="flex-1 ml-8 text-[#FAF3DD] text-[18px] font-semibold font-poppins">
                {card.text}
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Subtitle */}
      <div className="w-full flex  items-center justify-center flex-col">
        <span className="text-[#FAF3DD] text-[20px] font-semibold font-poppins">Create Your </span>
        <span className="text-[#FAF3DD] text-[20px] font-semibold font-poppins"> Clubmaster Account</span>
      </div>
      
      {/* Main Card - Login Options */}
      <div className="w-full flex justify-center mb-8 p-[21px]">
        <div className="bg-[#1A1E1D] rounded-[10px] shadow-lg w-[366px] max-w-full h-[285px] flex flex-col items-center justify-center px-8 py-8 gap-4">
          {/* Google */}
          <button className="w-full h-[56px] bg-[#EBEBEB] rounded-[10px] flex items-center justify-center gap-2 px-4 font-poppins font-semibold text-[16px] text-[#1A1E1D] mb-2">
            <span className="w-7 h-7 flex items-center justify-center mr-2">
              <Image src="/icons/login-icons/google_icon.svg" alt="Google" width={28} height={28} />
            </span>
            Continue with Google
          </button>
          {/* Phone */}
          <button className="w-full h-[56px] bg-[#EBEBEB] rounded-[10px] flex items-center justify-center gap-2 px-4 font-poppins font-semibold text-[16px] text-[#1A1E1D] mb-2">
            <span className="w-7 h-7 flex items-center justify-center mr-2">
              <Image src="/icons/login-icons/register_icon.svg" alt="Register with Phone" width={28} height={28} />
            </span>
            Register with Phone
          </button>
          {/* Facebook */}
          <button className="w-full h-[56px] bg-[#EBEBEB] rounded-[10px] flex items-center justify-center gap-2 px-4 font-poppins font-semibold text-[16px] text-[#1A1E1D]">
            <span className="w-7 h-7 flex items-center justify-center mr-2">
              <Image src="/icons/login-icons/facebook_icon.svg" alt="Facebook" width={28} height={28} />
            </span>
            Continue with Facebook
          </button>
        </div>
      </div>
      {/* Play as Guest Button */}
      <div className="w-full flex justify-center mb-8 px-[21px]">
        <button className="w-[366px] max-w-full h-[56px] bg-[#152317] border-2 border-[#E9CB6B] rounded-[10px] text-[#D9D9D9] font-poppins font-semibold text-[16px]">Play as Guest</button>
      </div>
    </div>
  );
} 