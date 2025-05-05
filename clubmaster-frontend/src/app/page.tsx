import ChessBoardWrapper from './components/ChessBoardWrapper';

export default function Home() {
  return (
    <div className="flex flex-col items-center  justify-center min-h-screen bg-[#4A7C59]">
      <div className="w-full max-w-md mx-auto">
        <ChessBoardWrapper />
      </div>
    </div>
  );
}
