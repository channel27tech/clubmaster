"use client";
import Image from "next/image";
import BottomNavigation from "../components/BottomNavigation";
import { useRouter } from "next/navigation";

const menuItems = [
  { icon: "/icons/more section icons/profile icon.svg", label: "Profile", route: "/profile" },
  { icon: "/icons/more section icons/friends icon.svg", label: "Friends", route: "/friends" },
  { icon: "/icons/more section icons/notification icon.svg", label: "Notifications", route: "/notifications" },
  { icon: "/icons/more section icons/settings icon.svg", label: "Settings", route: "/settings" },
  { section: "Connect" },
  { icon: "/icons/more section icons/club chlng icon.svg", label: "Club challenges", route: "/club-challenges" },
  { icon: "/icons/more section icons/leaderboard icon.svg", label: "Leaderboard", route: "/leaderboard" },
  { icon: "/icons/more section icons/league icon.svg", label: "Leagues", route: "/leagues" },
  { icon: "/icons/more section icons/watch icon in more.svg", label: "Watch", route: "/watch" },
  { section: "Account" },
  { icon: "/icons/more section icons/help icon.svg", label: "Help", route: "/help" },
];

export default function MorePage() {
  const router = useRouter();
  let bgToggle = false;

  return (
    <div className="min-h-screen flex flex-col bg-[#363d3b] relative pb-20 max-w-[430px] mx-auto">
      {/* Header with Club Master logo, matching other screens */}
      <header className="bg-[#242828] w-full">
        <div className="container mx-auto px-4 py-2 flex justify-center items-center">
          <div className="flex items-center justify-center">
            <Image 
              src="/logos/clubmaster-logo.svg" 
              alt="Club Master Logo" 
              width={118} 
              height={48} 
              priority
            />
          </div>
        </div>
      </header>

      {/* Menu List */}
      <div className="flex-1 overflow-y-auto">
        {menuItems.map((item, idx) => {
          if (item.section) {
            // Reset background toggle after section header
            bgToggle = false;
            return <SectionHeader key={item.section}>{item.section}</SectionHeader>;
          }
          // Type guard: only render MenuItem if icon and label are present
          if (typeof item.icon === 'string' && typeof item.label === 'string') {
            const bg = bgToggle ? "#3A4141" : "#333939";
            bgToggle = !bgToggle;
            return (
              <MenuItem
                key={item.label}
                icon={item.icon}
                label={item.label}
                bg={bg}
                onClick={() => item.route && router.push(item.route)}
              />
            );
          }
          return null;
        })}
      </div>

      {/* Footer Navigation */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50">
        <BottomNavigation />
      </div>
    </div>
  );
}

function MenuItem({ 
  icon, 
  label, 
  badge, 
  bg,
  onClick 
}: { 
  icon: string; 
  label: string; 
  badge?: boolean; 
  bg: string;
  onClick?: () => void;
}) {
  return (
    <button 
      className="w-full text-left"
      onClick={onClick}
    >
      <div className="flex items-center px-6 py-4 border-b border-[#444] relative bg-transparent" style={{ background: bg }}>
        <div className="relative">
          <Image src={icon} alt={label} width={28} height={28} className="mr-4" />
          {badge && (
            <span className="absolute -top-2 -right-2 flex items-center justify-center w-6 h-6 rounded-full bg-[#F05353] border-2 border-[#363d3b] text-white text-sm font-semibold" style={{fontSize: '1rem'}}>5</span>
          )}
        </div>
        <span className="text-[#E6E6E6] text-base font-medium ml-4">{label}</span>
      </div>
    </button>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#4A7C59] px-6 py-2">
      <span className="text-white font-semibold text-sm">{children}</span>
    </div>
  );
} 