'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Flame, Clock, TrendingUp, Zap, Hash, Compass, Film, Users } from 'lucide-react';

/**
 * Theater Sidebar
 * 
 * Layout contract (at 2048×1365):
 * - Frame: x=0, y=0, w=295, h=1365
 * - Internal padding: pt=120, px=22, pb=24
 * - Nav item height: 40px
 * - Icon box: 18px
 * - Icon-text gap: 10px
 * 
 * Structure:
 * 1. Primary nav (Home/Hot/New/Rising/Top)
 * 2. Divider
 * 3. Popular Studios
 * 4. Divider
 * 5. Explore
 */
export function TheaterSidebar() {
  const pathname = usePathname();
  
  const mainLinks = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/?sort=hot', label: 'Hot', icon: Flame },
    { href: '/?sort=new', label: 'New', icon: Clock },
    { href: '/?sort=rising', label: 'Rising', icon: TrendingUp },
    { href: '/?sort=top', label: 'Top', icon: Zap },
  ];
  
  const infoLinks = [
    { href: '/about', label: 'About', icon: Hash },
    { href: '/terms', label: 'Terms', icon: Hash },
    { href: '/privacy', label: 'Privacy', icon: Hash },
  ];
  
  const exploreLinks = [
    { href: '/studios', label: 'All Studios', icon: Hash },
    { href: '/vote', label: 'Vote', icon: Film },
  ];
  
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href.split('?')[0]);
  };
  
  return (
    <nav className="space-y-1">
      {/* Primary navigation */}
      <div className="space-y-1">
        {mainLinks.map(link => {
          const Icon = link.icon;
          const active = isActive(link.href);
          return (
            <Link 
              key={link.href} 
              href={link.href} 
              className={cn('sidebar-nav-item', active && 'active')}
            >
              <Icon className="sidebar-icon" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>
      
      {/* Divider */}
      <div className="sidebar-divider" />
      
      {/* Info */}
      <div>
        <h3 className="sidebar-section-title">Info</h3>
        <div className="space-y-1">
          {infoLinks.map(link => {
            const Icon = link.icon;
            const active = pathname === link.href;
            return (
              <Link 
                key={link.href} 
                href={link.href} 
                className={cn('sidebar-nav-item', active && 'active')}
              >
                <Icon className="sidebar-icon" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
      
      {/* Divider */}
      <div className="sidebar-divider" />
      
      {/* Explore */}
      <div>
        <h3 className="sidebar-section-title">Explore</h3>
        <div className="space-y-1">
          {exploreLinks.map(link => {
            const Icon = link.icon;
            const active = isActive(link.href);
            return (
              <Link 
                key={link.href} 
                href={link.href} 
                className={cn('sidebar-nav-item', active && 'active')}
              >
                <Icon className="sidebar-icon" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
