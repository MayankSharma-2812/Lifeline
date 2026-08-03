/**
 * @module Header.tsx
 * @description Persistent top navigation bar displaying branding, user profile summary, and global controls (theme, logout).
 */
import React from 'react';
import { Droplets, Sun, Moon, LogOut, UserCheck } from 'lucide-react';
import { User } from '../types';

export interface HeaderProps {
  user: User | null;
  dark: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
  onNavigateHome?: () => void;
}

/**
 * Renders the primary application header.
 * Adapts conditionally based on the user's authentication state and chosen color theme.
 *
 * @param props - Configuration properties containing the user context and interaction callbacks.
 * @returns The fixed header component.
 */
export const Header: React.FC<HeaderProps> = ({
  user,
  dark,
  onToggleTheme,
  onLogout,
  onNavigateHome,
}) => {
  return (
    <header className="bg-white/90 dark:bg-[#161e38]/90 backdrop-blur-md text-primary dark:text-rose-400 font-headline-md text-headline-md docked full-width top-0 border-b border-outline-variant dark:border-[#2e3a59] flat no shadows flex justify-between items-center px-4 md:px-10 h-16 w-full fixed top-0 z-50 transition-colors duration-200">
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={onNavigateHome}
      >
        <div className="w-9 h-9 rounded-xl bg-primary-container/10 dark:bg-rose-500/20 flex items-center justify-center text-primary dark:text-rose-400">
          <Droplets className="w-5 h-5 fill-current" />
        </div>
        <span className="font-headline-md text-headline-md font-bold text-primary dark:text-rose-400 tracking-tight">
          LifeLine
        </span>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        {user && (
          <div className="flex items-center gap-2 bg-surface-container-low dark:bg-[#1c2541] px-3 py-1.5 rounded-full border border-outline-variant dark:border-[#2e3a59] text-xs font-semibold text-on-surface dark:text-slate-200">
            <UserCheck className="w-3.5 h-3.5 text-primary dark:text-rose-400" />
            <span className="capitalize">{user.role}</span>
            <span className="text-secondary dark:text-slate-500">•</span>
            <span className="truncate max-w-[120px]">{user.name}</span>
          </div>
        )}

        <button
          onClick={onToggleTheme}
          title="Toggle Theme"
          className="p-2 rounded-full hover:bg-surface-container-low dark:hover:bg-[#1c2541] text-secondary dark:text-amber-400 transition-colors duration-200"
        >
          {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {user && (
          <button
            onClick={onLogout}
            title="Logout"
            className="flex items-center gap-1 p-2 rounded-full hover:bg-error-container/20 dark:hover:bg-rose-950/40 text-error dark:text-rose-400 transition-colors duration-200"
          >
            <LogOut className="w-5 h-5" />
          </button>
        )}
      </div>
    </header>
  );
};
