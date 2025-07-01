import { RouteGuard } from '@/components/RouteGuard';
import { SocketProvider } from '@/context/SocketContext';
import { BetProvider } from '@/context/BetContext';
import GlobalNotifications from '@/app/components/GlobalNotifications';
// Add other protected providers here if needed, e.g., ClubProvider

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard>
      <SocketProvider>
        <BetProvider>
          {children}
          <GlobalNotifications />
        </BetProvider>
      </SocketProvider>
    </RouteGuard>
  );
} 