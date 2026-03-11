'use client';
// Place at: components/sidebar-nav.tsx

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useStore } from '@/lib/store-context';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import {
  LayoutDashboard, ShoppingCart, PackageSearch, Users, BarChart2,
  ScrollText, HardHat, ClipboardCheck, Truck, Headphones,
  MessageCircleQuestion, Settings2, ShieldCheck, Store, LogOut, Building2,
  LayoutGrid, CreditCard, MonitorCheck, DollarSign, Wifi, SplitSquareVertical,
  BookOpen, Wallet,
} from 'lucide-react';

const NAVIGATION_ITEMS = [
  // ── Core ──────────────────────────────────────────────────────────────────
  { label: 'Dashboard',        href: '/dashboard',                    icon: LayoutDashboard,       roles: ['super_admin','admin','manager','cashier'] },
  { label: 'Sales',            href: '/dashboard/sales',              icon: ShoppingCart,          roles: ['super_admin','admin','manager','cashier'] },
  { label: 'Inventory',        href: '/dashboard/inventory',          icon: PackageSearch,         roles: ['super_admin','admin','manager','inventory_staff'] },
  { label: 'Customers',        href: '/dashboard/customers',          icon: Users,                 roles: ['super_admin','admin','manager','cashier'] },
  { label: 'Reports',          href: '/dashboard/reports',            icon: BarChart2,             roles: ['super_admin','admin','manager'] },
  { label: 'Receipts',         href: '/dashboard/receipts',           icon: ScrollText,            roles: ['super_admin','admin','manager','cashier'] },
  { label: 'Workers',          href: '/dashboard/worker',             icon: HardHat,               roles: ['super_admin','admin','manager'] },
  { label: 'Stock Take',       href: '/dashboard/stocktake',          icon: ClipboardCheck,        roles: ['super_admin','admin','manager','inventory_staff'] },
  { label: 'Suppliers',        href: '/dashboard/supplier',           icon: Truck,                 roles: ['super_admin','admin','manager'] },

  // ── Finance & Payments ────────────────────────────────────────────────────
  { label: 'Split Payments',   href: '/dashboard/split-payments',     icon: SplitSquareVertical,   roles: ['super_admin','admin','manager','cashier'] },
  { label: 'Cash Drawer',      href: '/dashboard/cash-drawer',        icon: Wallet,                roles: ['super_admin','admin','manager','cashier'] },
  { label: 'Audit Logs',       href: '/dashboard/audit-logs',         icon: BookOpen,              roles: ['super_admin','admin','manager'] },

  // ── Operations ────────────────────────────────────────────────────────────
  { label: 'Sessions',         href: '/dashboard/sessions',           icon: MonitorCheck,          roles: ['super_admin','admin','manager'] },
  { label: 'Sync Monitor',     href: '/dashboard/offline-mode',       icon: Wifi,                  roles: ['super_admin','admin','manager'] },

  // ── Support & Comms ───────────────────────────────────────────────────────
  { label: 'Support',          href: '/dashboard/support',            icon: Headphones,            roles: ['super_admin','admin','manager'] },

  // ── Self-service ──────────────────────────────────────────────────────────
  { label: 'Queries',          href: '/dashboard/query',              icon: MessageCircleQuestion, roles: ['cashier','inventory_staff'] },
  { label: 'My Workspace',     href: '/dashboard/worker-portal',      icon: LayoutGrid,            roles: ['cashier','inventory_staff','manager'] },

  // ── Admin only ────────────────────────────────────────────────────────────
  { label: 'Settings',         href: '/dashboard/settings',           icon: Settings2,             roles: ['super_admin'] },
  { label: 'User Management',  href: '/dashboard/users',              icon: ShieldCheck,           roles: ['super_admin'] },
];

// Groups purely for visual separators — keyed on the first item of each new group
const GROUP_SEPARATORS = new Set([
  '/dashboard/split-payments', // Finance & Payments group starts
  '/dashboard/sessions',       // Operations group starts
  '/dashboard/support',        // Support group starts
  '/dashboard/query',          // Self-service group starts
  '/dashboard/settings',       // Admin group starts
]);

// Roles that can freely switch stores
const CAN_SWITCH_STORE = ['super_admin'];

interface SidebarNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SidebarNav({ isOpen, onClose }: SidebarNavProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { currentStore, stores, loadingStores, selectStore } = useStore();

  if (!user) return null;

  const canSwitchStore = CAN_SWITCH_STORE.includes(user.role);
  const visibleItems   = NAVIGATION_ITEMS.filter(item => item.roles.includes(user.role));

  const handleLogout = async () => {
    onClose();
    await logout();
  };

  const displayName = `${user.firstName} ${user.lastName}`.trim();
  const roleLabel   = user.role.replace(/_/g, ' ');

  const roleBadgeClass =
    user.role === 'super_admin' ? 'text-purple-400' :
    user.role === 'admin'       ? 'text-blue-400'   :
    user.role === 'manager'     ? 'text-green-400'  :
    'text-sidebar-foreground/60';

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border z-50 transform transition-transform duration-300 flex flex-col md:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>

        {/* Header */}
        <div className="p-6 border-b border-sidebar-border">
          <h1 className="text-2xl font-bold text-sidebar-foreground flex items-center gap-2">
            <Store className="w-6 h-6" />
            POS System
          </h1>
        </div>

        {/* Store Selector / Indicator */}
        <div className="p-4 border-b border-sidebar-border">
          <label className="text-xs font-semibold text-sidebar-foreground/60 mb-2 block uppercase tracking-wider">
            Current Store
          </label>

          {canSwitchStore ? (
            <select
              value={currentStore?.id || ''}
              onChange={e => selectStore(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-border rounded-md focus:outline-none focus:ring-2 focus:ring-sidebar-ring"
            >
              {loadingStores && <option disabled>Loading...</option>}
              {stores.filter(s => s.isActive).map(store => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 bg-sidebar-accent rounded-md border border-sidebar-border">
              <Building2 className="w-3.5 h-3.5 text-sidebar-foreground/50 shrink-0" />
              <span className="text-sm text-sidebar-accent-foreground truncate">
                {loadingStores
                  ? 'Loading...'
                  : currentStore?.name ?? 'No branch assigned'}
              </span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-0.5">
          {visibleItems.map(item => {
            const Icon = item.icon;
            const isActive = item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);

            const isPortalLink  = item.href === '/dashboard/worker-portal';
            const needsSeparator = GROUP_SEPARATORS.has(item.href);

            return (
              <div key={item.href}>
                {needsSeparator && (
                  <div className="my-2 border-t border-sidebar-border" />
                )}
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : isPortalLink
                      ? 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border border-sidebar-border/50'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <Icon style={{ width: '1.125rem', height: '1.125rem' }} className="shrink-0" />
                  {item.label}
                  {isPortalLink && (
                    <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
                      Portal
                    </span>
                  )}
                </Link>
              </div>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-sidebar-border space-y-3">
          <div className="px-3 py-2.5 bg-sidebar-accent rounded-lg">
            <p className="text-xs text-sidebar-foreground/50 mb-0.5">Logged in as</p>
            <p className="text-sm font-semibold text-sidebar-foreground leading-tight">{displayName}</p>
            <p className={`text-xs font-medium capitalize mt-0.5 ${roleBadgeClass}`}>{roleLabel}</p>
          </div>

          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full justify-start gap-2 bg-transparent border-sidebar-border text-sidebar-foreground hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content Offset (desktop) */}
      <div className="hidden md:block w-64 shrink-0" />
    </>
  );
}