import TetrisLoading from '@/components/ui/tetris-loader';

export default function Loading() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#0d1117] font-mono dark">
      {/* Background Grid */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-4 text-white">
        <TetrisLoading 
          size="md" 
          speed="fast" 
          showLoadingText={true} 
          loadingText="SYS::LOADING_WORKSPACE..." 
        />
      </div>
    </div>
  );
}
