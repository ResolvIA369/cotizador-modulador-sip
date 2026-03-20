'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PenTool, Calculator, Users, Settings, Download, Mail, Code2, FileSearch, type LucideProps } from 'lucide-react';
import { PROJECT_LOGO } from '@/shared/lib/constants';
import clsx from 'clsx';

interface NavItemProps {
  href: string;
  icon: React.ComponentType<LucideProps>;
  label: string;
  active: boolean;
}

const NavItem = ({ href, icon: Icon, label, active }: NavItemProps) => (
  <Link
    href={href}
    className={clsx(
      'flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 whitespace-nowrap text-sm font-semibold',
      active
        ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
        : 'text-slate-400 hover:text-white hover:bg-white/10'
    )}
  >
    <Icon size={16} />
    <span className="hidden md:inline">{label}</span>
  </Link>
);

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const currentPath = usePathname();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900 shadow-xl print:hidden">
        <div className="max-w-[1920px] mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/engineering" className="flex items-center gap-3 group shrink-0">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center overflow-hidden p-1 shadow-sm group-hover:shadow-md transition-shadow">
              <img src={PROJECT_LOGO} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-white font-black text-xs tracking-[0.15em] uppercase leading-none">
                MODULADOR <span className="text-orange-400">SIP</span>
              </span>
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                La Fabrica del Panel
              </span>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-lg">
            <NavItem href="/engineering" icon={PenTool} label="Ingenieria" active={currentPath.includes('engineering')} />
            <NavItem href="/plan-analyzer" icon={FileSearch} label="Desde Plano" active={currentPath.includes('plan-analyzer')} />
            <NavItem href="/budget" icon={Calculator} label="Presupuesto" active={currentPath.includes('budget')} />
            <NavItem href="/crm" icon={Users} label="CRM" active={currentPath.includes('crm')} />
            <NavItem href="/admin" icon={Settings} label="Admin" active={currentPath.includes('admin')} />
            <NavItem href="/export" icon={Download} label="Exportar" active={currentPath.includes('export')} />
          </nav>

          {/* User placeholder */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="text-right">
              <p className="text-slate-500 text-[10px] uppercase tracking-wider">Usuario</p>
              <p className="text-white text-xs font-semibold">Ingeniero Senior</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-orange-400">
              <Users size={16} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-2 md:p-4 lg:p-6 max-w-[1920px] mx-auto w-full overflow-x-hidden">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-3 print:hidden">
        <div className="max-w-[1920px] mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-white text-xs font-semibold uppercase tracking-wider">La Fabrica del Panel</p>
            <a
              href="https://resolvia.online"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-slate-500 hover:text-orange-400 transition-colors"
            >
              <Code2 size={12} />
              <span className="text-xs">Desarrollado por <span className="font-semibold">ResolvIA</span></span>
            </a>
            <a href="mailto:consultora.resolvia@gmail.com" className="flex items-center gap-1.5 text-slate-400 hover:text-orange-400 transition-colors">
              <Mail size={12} />
              <span className="text-xs">consultora.resolvia@gmail.com</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;
