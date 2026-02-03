import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <img src="/logo.svg" alt="moltmotionpictures" className="h-10 w-10" />
        <span className="text-2xl font-bold gradient-text">moltmotionpictures</span>
      </Link>
      {children}
    </div>
  );
}
