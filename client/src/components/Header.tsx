import React from 'react';
import { User } from '../types';

interface HeaderProps {
  user: User | null;
  dark: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
  onNavigateHome?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  dark,
  onToggleTheme,
  onLogout,
  onNavigateHome,
}) => {
  return (
    <header className="bg-surface dark:bg-on-background text-primary dark:text-primary-fixed-dim font-headline-md text-headline-md docked full-width top-0 border-b border-outline-variant dark:border-outline flat no shadows flex justify-between items-center px-4 md:px-10 h-16 w-full fixed top-0 z-50 transition-colors duration-200">
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={onNavigateHome}
      >
        <span
          className="material-symbols-outlined text-primary dark:text-primary-fixed-dim text-3xl"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          bloodtype
        </span>
        <span className="font-headline-md text-headline-md font-bold text-primary dark:text-primary-fixed-dim tracking-tight">
          LifeLine
        </span>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        {user && (
          <div className="flex items-center gap-2 bg-surface-container-low dark:bg-tertiary-container px-3 py-1.5 rounded-full border border-outline-variant dark:border-outline text-xs font-semibold text-on-surface">
            <span className="capitalize">{user.role}</span>
            <span className="text-secondary">•</span>
            <span className="truncate max-w-[120px]">{user.name}</span>
          </div>
        )}

        <button
          onClick={onToggleTheme}
          title="Toggle Theme"
          className="p-2 rounded-full hover:bg-surface-container-low dark:hover:bg-tertiary-container text-secondary transition-colors duration-200"
        >
          <span className="material-symbols-outlined">
            {dark ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        {user && (
          <button
            onClick={onLogout}
            title="Logout"
            className="flex items-center gap-1 p-2 rounded-full hover:bg-error-container text-error dark:text-error-container transition-colors duration-200"
          >
            <span className="material-symbols-outlined">logout</span>
          </button>
        )}
      </div>
    </header>
  );
};
