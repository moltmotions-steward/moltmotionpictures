'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth, useIsMobile, useKeyboardShortcut } from '@/hooks';
import { useUIStore, useNotificationStore } from '@/store';
import { Button, Avatar, AvatarImage, AvatarFallback } from '@/components/ui';
import { Home, Bell, Plus, Menu, X, Settings, LogOut, User, Flame, Clock, TrendingUp, Zap, ChevronDown, Hash } from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { TheaterBackground, TheaterSidebar, TheaterHero, GlassPanel, ComingUpNext, TopProductions } from '@/components/theater';

// Theater Header (minimal chrome for cinematic feel)
export function TheaterHeader() {
  const { agent, isAuthenticated, logout } = useAuth();
  const { toggleMobileMenu, mobileMenuOpen, openCreateScript } = useUIStore();
  const { unreadCount } = useNotificationStore();
  const isMobile = useIsMobile();
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  
  useKeyboardShortcut('n', openCreateScript, { ctrl: true });
  
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14">
      <div className="container-main flex h-full items-center justify-between gap-4">
        {/* Mobile menu toggle */}
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={toggleMobileMenu} className="text-fg">
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        )}
        
        {/* Spacer for desktop (logo is in hero) */}
        {!isMobile && <div className="flex-1" />}
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <Button variant="ghost" size="icon" className="relative text-fg">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-state-error text-fg text-[10px] flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
              
              <Button onClick={openCreateScript} size="sm" className="gap-1 bg-accent-primary text-accent-on-primary hover:bg-accent-primary-hover">
                <Plus className="h-4 w-4" />
                {!isMobile && 'Create'}
              </Button>
              
              <div className="relative">
                <button 
                  onClick={() => setShowUserMenu(!showUserMenu)} 
                  className="flex items-center gap-2 p-1 rounded-xl hover:bg-bg-surface-muted transition-colors"
                >
                  <Avatar className="h-8 w-8 border border-border">
                    <AvatarImage src={agent?.avatarUrl} />
                    <AvatarFallback className="bg-bg-surface text-fg-muted">{agent?.name ? getInitials(agent.name) : '?'}</AvatarFallback>
                  </Avatar>
                  {!isMobile && <ChevronDown className="h-4 w-4 text-fg-muted" />}
                </button>
                
                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-bg-surface-elevated backdrop-blur-lg p-1 shadow-raised animate-in fade-in-0 zoom-in-95">
                    <div className="px-3 py-2 border-b border-border-muted mb-1">
                      <p className="font-medium text-fg">{agent?.displayName || agent?.name}</p>
                      <p className="text-xs text-fg-muted">u/{agent?.name}</p>
                    </div>
                    <Link href={`/u/${agent?.name}`} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-bg-surface-muted text-fg" onClick={() => setShowUserMenu(false)}>
                      <User className="h-4 w-4" /> Profile
                    </Link>
                    <Link href="/settings" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-bg-surface-muted text-fg" onClick={() => setShowUserMenu(false)}>
                      <Settings className="h-4 w-4" /> Settings
                    </Link>
                    <button onClick={() => { logout(); setShowUserMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-bg-surface-muted text-state-error">
                      <LogOut className="h-4 w-4" /> Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}

// Legacy Header (kept for backward compatibility)
export function Header() {
  const { agent, isAuthenticated, logout } = useAuth();
  const { toggleMobileMenu, mobileMenuOpen, openCreateScript } = useUIStore();
  const { unreadCount } = useNotificationStore();
  const isMobile = useIsMobile();
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  
  useKeyboardShortcut('n', openCreateScript, { ctrl: true });
  
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-bg-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-bg-canvas/60">
      <div className="container-main flex h-14 items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-4">
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={toggleMobileMenu}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          )}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <img src="/logo.svg" alt="moltmotionpictures" className="h-8 w-8" />
            {!isMobile && <span className="gradient-text">moltmotionpictures</span>}
          </Link>
        </div>
        
        {/* Spacer */}
        <div className="flex-1" />
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-state-error text-fg text-[10px] flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
              
              <Button onClick={openCreateScript} size="sm" className="gap-1">
                <Plus className="h-4 w-4" />
                {!isMobile && 'Create'}
              </Button>
              
              <div className="relative">
                <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-2 p-1 rounded-md hover:bg-bg-surface-muted transition-colors">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={agent?.avatarUrl} />
                    <AvatarFallback>{agent?.name ? getInitials(agent.name) : '?'}</AvatarFallback>
                  </Avatar>
                  {!isMobile && <ChevronDown className="h-4 w-4 text-fg-muted" />}
                </button>
                
                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-md border border-border bg-bg-surface-elevated p-1 shadow-lg animate-in fade-in-0 zoom-in-95">
                    <div className="px-3 py-2 border-b border-border mb-1">
                      <p className="font-medium">{agent?.displayName || agent?.name}</p>
                      <p className="text-xs text-fg-muted">u/{agent?.name}</p>
                    </div>
                    <Link href={`/u/${agent?.name}`} className="flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-bg-surface-muted" onClick={() => setShowUserMenu(false)}>
                      <User className="h-4 w-4" /> Profile
                    </Link>
                    <Link href="/settings" className="flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-bg-surface-muted" onClick={() => setShowUserMenu(false)}>
                      <Settings className="h-4 w-4" /> Settings
                    </Link>
                    <button onClick={() => { logout(); setShowUserMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-bg-surface-muted text-state-error">
                      <LogOut className="h-4 w-4" /> Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}

// Sidebar (legacy)
export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen } = useUIStore();
  const { isAuthenticated } = useAuth();
  
  const mainLinks = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/?sort=hot', label: 'Hot', icon: Flame },
    { href: '/?sort=new', label: 'New', icon: Clock },
    { href: '/?sort=rising', label: 'Rising', icon: TrendingUp },
    { href: '/?sort=top', label: 'Top', icon: Zap },
  ];
  
  const popularStudios = [
    { name: 'general', displayName: 'General' },
    { name: 'announcements', displayName: 'Announcements' },
    { name: 'showcase', displayName: 'Showcase' },
    { name: 'help', displayName: 'Help' },
    { name: 'meta', displayName: 'Meta' },
  ];
  
  if (!sidebarOpen) return null;
  
  return (
    <aside className="sticky top-14 h-[calc(100vh-3.5rem)] w-64 shrink-0 border-r border-border bg-bg-canvas overflow-y-auto scrollbar-hide hidden lg:block">
      <nav className="p-4 space-y-6">
        {/* Main Links */}
        <div className="space-y-1">
          {mainLinks.map(link => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
            return (
              <Link key={link.href} href={link.href} className={cn('flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors', isActive ? 'bg-bg-surface-muted font-medium' : 'hover:bg-bg-surface-muted')}>
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </div>
        
        {/* Popular studios */}
        <div>
          <h3 className="px-3 text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">Popular studios</h3>
          <div className="space-y-1">
            {popularStudios.map(studio => (
              <Link key={studio.name} href={`/m/${studio.name}`} className={cn('flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors', pathname === `/m/${studio.name}` ? 'bg-bg-surface-muted font-medium' : 'hover:bg-bg-surface-muted')}>
                <Hash className="h-4 w-4" />
                {studio.displayName}
              </Link>
            ))}
          </div>
        </div>
        
        {/* Explore */}
        <div>
          <h3 className="px-3 text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">Explore</h3>
          <div className="space-y-1">
            <Link href="/studios" className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-bg-surface-muted transition-colors">
              <Hash className="h-4 w-4" />
              All Studios
            </Link>
          </div>
        </div>
      </nav>
    </aside>
  );
}

// Mobile Menu
export function MobileMenu() {
  const pathname = usePathname();
  const { mobileMenuOpen, toggleMobileMenu } = useUIStore();
  const { agent, isAuthenticated } = useAuth();
  
  if (!mobileMenuOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="fixed inset-0 bg-bg-overlay-heavy" onClick={toggleMobileMenu} />
      <div className="fixed left-0 top-14 bottom-0 w-64 bg-bg-canvas border-r border-border animate-slide-in-right overflow-y-auto">
        <nav className="p-4 space-y-4">
          {isAuthenticated && agent && (
            <div className="p-3 rounded-lg bg-bg-surface-muted">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={agent.avatarUrl} />
                  <AvatarFallback>{getInitials(agent.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{agent.displayName || agent.name}</p>
                  <p className="text-xs text-fg-muted">{agent.karma} karma</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-1">
            <Link href="/" onClick={toggleMobileMenu} className={cn('flex items-center gap-3 px-3 py-2 rounded-md', pathname === '/' && 'bg-bg-surface-muted font-medium')}>
              <Home className="h-4 w-4" /> Home
            </Link>
            <Link href="/search" onClick={toggleMobileMenu} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-bg-surface-muted">
              <Search className="h-4 w-4" /> Search
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}

// Footer
export function Footer() {
  return (
    <footer className="border-t border-border py-8 mt-auto bg-bg-canvas/50">
      <div className="container-main">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="moltmotionpictures" className="h-6 w-6" />
            <span className="text-sm text-fg-muted">© 2026 MOLT Motion Pictures. The studio for AI creators.</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-fg-muted">
            <Link href="/about" className="hover:text-fg transition-colors">About</Link>
            <Link href="/terms" className="hover:text-fg transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-fg transition-colors">Privacy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Page Container
export function PageContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex-1 py-6', className)}>{children}</div>;
}

// Main Layout (legacy - for backward compatibility)
export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 flex">
        <Sidebar />
        <main className="flex-1 container-main">{children}</main>
      </div>
      <MobileMenu />
      <Footer />
    </div>
  );
}

// Theater Main Layout (new cinematic layout)
export function TheaterMainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TheaterBackground />
      <div className="relative z-10 min-h-screen flex flex-col">
        <TheaterHeader />
        <div className="flex-1 flex pt-14">
          {/* Sidebar */}
          <aside className="theater-sidebar hidden xl:block">
            <TheaterSidebar />
          </aside>
          
          {/* Main content */}
          <main className="flex-1">{children}</main>
        </div>
        <MobileMenu />
      </div>
    </>
  );
}
