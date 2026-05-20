"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  LayoutDashboard, 
  Settings as SettingsIcon, 
  LogOut, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ChefHat, 
  ShoppingBag, 
  User, 
  Phone, 
  RefreshCw, 
  Sliders, 
  CloudRain, 
  Power, 
  MessageSquare, 
  Search, 
  Filter, 
  ArrowRight,
  ShieldAlert,
  Check,
  X,
  Play
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// Types
interface OrderItemModifier {
  modifier_name: string;
  price_delta_inr: number;
}

interface OrderItem {
  id: string;
  qty: number;
  unit_price_inr: number;
  line_total_inr: number;
  customer_note?: string;
  position: number;
  menu_items?: { name: string };
  order_item_modifiers?: OrderItemModifier[];
}

interface Order {
  id: string;
  order_code: string;
  customer_id: string;
  source: string;
  state: 'new' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  subtotal_inr: number;
  total_inr: number;
  payment_mode: string;
  payment_status: string;
  customer_note?: string;
  dynamic_eta_factor: number;
  promised_eta_min: number;
  created_at: string;
  updated_at: string;
  customers?: { phone_e164: string; display_name?: string };
  order_items?: OrderItem[];
}

interface Session {
  id: string;
  customer_id: string;
  state: string;
  last_activity_at: string;
  customers?: { phone_e164: string; display_name?: string };
}

interface SystemSettings {
  digital_lane_paused: boolean;
  rush_threshold: number;
  eta_inflation_factor: number;
  rain_protocol_active: boolean;
}

interface CurrentUser {
  email: string;
  role: string;
}

export default function Dashboard() {
  // Auth State
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(false);

  // Navigation & UI State
  const [activeTab, setActiveTab] = useState<'kanban' | 'handoff' | 'settings'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Data State
  const [orders, setOrders] = useState<Order[]>([]);
  const [handoffSessions, setHandoffSessions] = useState<Session[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({
    digital_lane_paused: false,
    rush_threshold: 15,
    eta_inflation_factor: 1.5,
    rain_protocol_active: false
  });
  const [loadingData, setLoadingData] = useState(false);

  // Heartbeat State
  const [heartbeatStatus, setHeartbeatStatus] = useState<'online' | 'warning' | 'offline'>('online');
  const [lastHeartbeat, setLastHeartbeat] = useState<Date>(new Date());
  const missedBeatsRef = useRef(0);

  // ---------------------------------------------------------------------------
  // AUTHENTICATION
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Check active Supabase session
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Fetch role from staff_users
        const { data: staffUser } = await supabase
          .from('staff_users')
          .select('role')
          .eq('email', session.user.email)
          .single();
        
        setCurrentUser({ 
          email: session.user.email || '', 
          role: staffUser?.role || 'staff' 
        });
      } else {
        // Check local storage for mock dev session
        const mockUser = localStorage.getItem('shelby_mock_user');
        if (mockUser) {
          setCurrentUser(JSON.parse(mockUser));
        }
      }
    };
    checkUser();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setLoadingAuth(true);

    try {
      // 1. Try standard Supabase Auth signIn
      let { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      // 2. If user doesn't exist in auth.users (common in local docker seed), auto signup
      if (signInError && signInError.message.includes('Invalid login credentials')) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password
        });
        if (!signUpError && signUpData?.user) {
          authData = { user: signUpData.user as any, session: signUpData.session as any };
          signInError = null;
        }
      }

      if (!signInError && authData?.session?.user) {
        const { data: staffUser } = await supabase
          .from('staff_users')
          .select('role')
          .eq('email', email)
          .single();

        const userObj = { email, role: staffUser?.role || 'staff' };
        setCurrentUser(userObj);
        localStorage.setItem('shelby_mock_user', JSON.stringify(userObj));
      } else {
        // 3. Fallback for local development if Supabase Auth is entirely unconfigured/failing
        const { data: staffUser, error: staffErr } = await supabase
          .from('staff_users')
          .select('*')
          .eq('email', email)
          .single();

        if (staffUser) {
          const userObj = { email: staffUser.email, role: staffUser.role };
          setCurrentUser(userObj);
          localStorage.setItem('shelby_mock_user', JSON.stringify(userObj));
        } else {
          setAuthError('Invalid credentials. Use admin@shelby.local or barista@shelby.local');
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('shelby_mock_user');
    setCurrentUser(null);
  };

  // ---------------------------------------------------------------------------
  // DATA FETCHING & REALTIME SUBSCRIPTIONS
  // ---------------------------------------------------------------------------
  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setLoadingData(true);

    try {
      // 1. Fetch Orders
      const { data: ordersData, error: ordersErr } = await supabase
        .from('orders')
        .select(`
          *,
          customers ( phone_e164, display_name ),
          order_items (
            id, qty, unit_price_inr, line_total_inr, customer_note, position,
            menu_items ( name ),
            order_item_modifiers ( modifier_name, price_delta_inr )
          )
        `)
        .order('created_at', { ascending: false });

      if (!ordersErr && ordersData) {
        setOrders(ordersData as unknown as Order[]);
      }

      // 2. Fetch Handoff Sessions
      const { data: sessionsData, error: sessionsErr } = await supabase
        .from('sessions')
        .select(`
          id, state, last_activity_at, customer_id,
          customers ( phone_e164, display_name )
        `)
        .eq('state', 'handoff_active');

      if (!sessionsErr && sessionsData) {
        setHandoffSessions(sessionsData as unknown as Session[]);
      }

      // 3. Fetch System Settings
      const { data: settingsData, error: settingsErr } = await supabase
        .from('system_settings')
        .select('*');

      if (!settingsErr && settingsData) {
        const settingsMap: any = {};
        settingsData.forEach(item => {
          settingsMap[item.key] = typeof item.value_json === 'string' ? JSON.parse(item.value_json) : item.value_json;
        });
        setSettings(prev => ({ ...prev, ...settingsMap }));
      }

      // Update Heartbeat
      setLastHeartbeat(new Date());
      missedBeatsRef.current = 0;
      setHeartbeatStatus('online');
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoadingData(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchData();

      // Set up Realtime Subscriptions
      const ordersSub = supabase
        .channel('custom-orders-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
          fetchData();
        })
        .subscribe();

      const sessionsSub = supabase
        .channel('custom-sessions-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => {
          fetchData();
        })
        .subscribe();

      const settingsSub = supabase
        .channel('custom-settings-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, () => {
          fetchData();
        })
        .subscribe();

      // Heartbeat Ping Interval (every 10 seconds)
      const heartbeatInterval = setInterval(async () => {
        try {
          const { error } = await supabase.from('system_settings').select('key').limit(1);
          if (error) throw error;
          
          setLastHeartbeat(new Date());
          missedBeatsRef.current = 0;
          setHeartbeatStatus('online');
        } catch (err) {
          missedBeatsRef.current += 1;
          if (missedBeatsRef.current >= 3) {
            setHeartbeatStatus('offline');
          } else if (missedBeatsRef.current >= 1) {
            setHeartbeatStatus('warning');
          }
        }
      }, 10000);

      return () => {
        supabase.removeChannel(ordersSub);
        supabase.removeChannel(sessionsSub);
        supabase.removeChannel(settingsSub);
        clearInterval(heartbeatInterval);
      };
    }
  }, [currentUser, fetchData]);

  // ---------------------------------------------------------------------------
  // ACTIONS & HANDLERS
  // ---------------------------------------------------------------------------
  const updateOrderStatus = async (orderId: string, newState: Order['state']) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ state: newState, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;

      // Optimistic update
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, state: newState, updated_at: new Date().toISOString() } : o));
    } catch (err) {
      console.error('Failed to update order status:', err);
      alert('Failed to update order status');
    }
  };

  const updateSetting = async (key: string, value: any) => {
    if (currentUser?.role !== 'admin') {
      alert('Unauthorized: Only Administrators can modify system settings.');
      return;
    }

    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ value_json: JSON.stringify(value), updated_at: new Date().toISOString() })
        .eq('key', key);

      if (error) {
        // If row doesn't exist, insert it
        const { error: insertErr } = await supabase
          .from('system_settings')
          .insert({ key, value_json: JSON.stringify(value), updated_at: new Date().toISOString() });
        
        if (insertErr) throw insertErr;
      }

      setSettings(prev => ({ ...prev, [key]: value }));
    } catch (err) {
      console.error(`Failed to update setting ${key}:`, err);
      alert(`Failed to update setting ${key}`);
    }
  };

  const resolveHandoff = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('sessions')
        .update({ state: 'idle', last_activity_at: new Date().toISOString() })
        .eq('id', sessionId);

      if (error) throw error;

      setHandoffSessions(prev => prev.filter(s => s.id !== sessionId));
    } catch (err) {
      console.error('Failed to resolve handoff:', err);
      alert('Failed to resolve handoff');
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER: LOGIN SCREEN
  // ---------------------------------------------------------------------------
  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-12 sm:px-6 lg:px-8 text-zinc-100 font-sans selection:bg-amber-500 selection:text-zinc-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/20 via-zinc-950 to-zinc-950 z-0" />
        
        <div className="relative w-full max-w-md space-y-8 rounded-3xl bg-zinc-900/60 p-10 backdrop-blur-xl border border-zinc-800/80 shadow-2xl z-10">
          <div className="text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 shadow-lg shadow-amber-500/30 mb-4">
              <ChefHat className="h-8 w-8 text-zinc-950" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Shelby Phygital OS</h2>
            <p className="mt-2 text-sm text-zinc-400">Enter your staff credentials to access the terminal</p>
          </div>

          {authError && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 flex items-center gap-3 animate-shake">
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-zinc-400 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  className="w-full rounded-xl bg-zinc-800/50 border border-zinc-700 px-4 py-3 text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
                  placeholder="admin@shelby.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-zinc-400 mb-1">Password</label>
                <input
                  type="password"
                  required
                  className="w-full rounded-xl bg-zinc-800/50 border border-zinc-700 px-4 py-3 text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loadingAuth}
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 py-3.5 px-4 text-center font-semibold text-zinc-950 shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500/50 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loadingAuth ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span>Access Terminal</span>
                  <ArrowRight className="h-5 w-5" />
                </>
              )}
            </button>
          </form>

          <div className="pt-6 border-t border-zinc-800 text-center">
            <p className="text-xs text-zinc-500 mb-2">Demo Environment Credentials:</p>
            <div className="flex justify-center gap-4 text-xs">
              <button 
                onClick={() => { setEmail('admin@shelby.local'); setPassword('password123'); }}
                className="text-amber-400/80 hover:text-amber-300 underline font-mono"
              >
                admin@shelby.local
              </button>
              <span className="text-zinc-700">•</span>
              <button 
                onClick={() => { setEmail('barista@shelby.local'); setPassword('password123'); }}
                className="text-amber-400/80 hover:text-amber-300 underline font-mono"
              >
                barista@shelby.local
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Filter Orders for Kanban
  const filteredOrders = orders.filter(o => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.order_code.toLowerCase().includes(q) ||
      o.customers?.phone_e164.toLowerCase().includes(q) ||
      o.customers?.display_name?.toLowerCase().includes(q)
    );
  });

  const getKanbanOrders = (state: Order['state']) => filteredOrders.filter(o => o.state === state);

  // ---------------------------------------------------------------------------
  // RENDER: MAIN DASHBOARD
  // ---------------------------------------------------------------------------
  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-amber-500 selection:text-zinc-950">
      {/* SIDEBAR */}
      <aside className="w-64 bg-zinc-900/80 border-r border-zinc-800/80 flex flex-col justify-between backdrop-blur-xl z-20 flex-shrink-0">
        <div className="p-6 space-y-8">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 shadow-md shadow-amber-500/20">
              <ChefHat className="h-6 w-6 text-zinc-950" />
            </div>
            <div>
              <h1 className="font-bold text-white tracking-tight leading-none">Shelby OS</h1>
              <span className="text-[10px] font-medium uppercase tracking-wider text-amber-400">Phygital Kitchen</span>
            </div>
          </div>

          {/* Nav */}
          <nav className="space-y-2">
            <button
              onClick={() => setActiveTab('kanban')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                activeTab === 'kanban' 
                  ? 'bg-gradient-to-r from-amber-500/10 to-amber-500/5 text-amber-400 border border-amber-500/20 shadow-sm' 
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
            >
              <LayoutDashboard className="h-5 w-5" />
              <span>Kanban Board</span>
              {orders.filter(o => o.state === 'new').length > 0 && (
                <span className="ml-auto bg-amber-500 text-zinc-950 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                  {orders.filter(o => o.state === 'new').length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('handoff')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                activeTab === 'handoff' 
                  ? 'bg-gradient-to-r from-amber-500/10 to-amber-500/5 text-amber-400 border border-amber-500/20 shadow-sm' 
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
            >
              <MessageSquare className="h-5 w-5" />
              <span>Active Handoffs</span>
              {handoffSessions.length > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-bounce">
                  {handoffSessions.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                activeTab === 'settings' 
                  ? 'bg-gradient-to-r from-amber-500/10 to-amber-500/5 text-amber-400 border border-amber-500/20 shadow-sm' 
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              }`}
            >
              <SettingsIcon className="h-5 w-5" />
              <span>System Settings</span>
              {currentUser?.role === 'admin' && (
                <span className="ml-auto bg-zinc-800 text-zinc-400 border border-zinc-700 text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded">
                  Admin
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* User / Footer */}
        <div className="p-6 border-t border-zinc-800/80 space-y-4 bg-zinc-900/40">
          <div className="flex items-center justify-between">
            {/* Heartbeat Status */}
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${
                heartbeatStatus === 'online' ? 'bg-emerald-500 animate-pulse' :
                heartbeatStatus === 'warning' ? 'bg-amber-500 animate-ping' : 'bg-red-500'
              }`} />
              <span className="text-xs font-medium text-zinc-400 capitalize">
                {heartbeatStatus}
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">
              {lastHeartbeat.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <div className="h-9 w-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-amber-400 font-bold text-sm uppercase">
              {currentUser.email.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{currentUser.email}</p>
              <p className="text-xs text-zinc-400 capitalize">{currentUser.role} Role</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-zinc-950/50">
        {/* TOP BAR */}
        <header className="h-20 border-b border-zinc-800/80 px-8 flex items-center justify-between backdrop-blur-md sticky top-0 z-10 bg-zinc-950/80">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-white tracking-tight capitalize">
              {activeTab === 'kanban' ? 'Live Kitchen Kanban' : activeTab === 'handoff' ? 'Staff Handoff Queue' : 'System Parameters'}
            </h2>
            {loadingData && (
              <RefreshCw className="h-5 w-5 text-amber-500 animate-spin" />
            )}
          </div>

          {/* Quick Controls / Status Alerts */}
          <div className="flex items-center gap-4">
            {settings.digital_lane_paused && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold animate-pulse">
                <Power className="h-4 w-4" />
                <span>Digital Lane Paused (Kill Switch Active)</span>
              </div>
            )}
            {settings.rain_protocol_active && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
                <CloudRain className="h-4 w-4" />
                <span>Rain Protocol Active</span>
              </div>
            )}

            {/* Search Bar for Kanban */}
            {activeTab === 'kanban' && (
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search orders, phone..."
                  className="w-full rounded-full bg-zinc-900 border border-zinc-800 pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            )}
          </div>
        </header>

        {/* TAB 1: KANBAN BOARD */}
        {activeTab === 'kanban' && (
          <div className="p-8 flex-1 flex flex-col min-h-0">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 flex-1 items-start">
              {/* COLUMN 1: PENDING (new) */}
              <div className="flex flex-col rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-4 max-h-full overflow-y-auto backdrop-blur-sm shadow-lg">
                <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-amber-500" />
                    <h3 className="font-bold text-white text-base tracking-tight">Pending</h3>
                  </div>
                  <span className="bg-zinc-800 text-zinc-300 text-xs font-bold px-2.5 py-1 rounded-full">
                    {getKanbanOrders('new').length}
                  </span>
                </div>
                <div className="space-y-4 flex-1">
                  {getKanbanOrders('new').map(order => (
                    <OrderCard 
                      key={order.id} 
                      order={order} 
                      onAction={() => updateOrderStatus(order.id, 'accepted')} 
                      actionLabel="Accept Order"
                      actionColor="from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
                      onClick={() => setSelectedOrder(order)}
                    />
                  ))}
                  {getKanbanOrders('new').length === 0 && (
                    <p className="text-center text-xs text-zinc-500 py-8 font-medium">No pending orders</p>
                  )}
                </div>
              </div>

              {/* COLUMN 2: ACCEPTED */}
              <div className="flex flex-col rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-4 max-h-full overflow-y-auto backdrop-blur-sm shadow-lg">
                <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                    <h3 className="font-bold text-white text-base tracking-tight">Accepted</h3>
                  </div>
                  <span className="bg-zinc-800 text-zinc-300 text-xs font-bold px-2.5 py-1 rounded-full">
                    {getKanbanOrders('accepted').length}
                  </span>
                </div>
                <div className="space-y-4 flex-1">
                  {getKanbanOrders('accepted').map(order => (
                    <OrderCard 
                      key={order.id} 
                      order={order} 
                      onAction={() => updateOrderStatus(order.id, 'preparing')} 
                      actionLabel="Start Preparing"
                      actionColor="from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400"
                      onClick={() => setSelectedOrder(order)}
                    />
                  ))}
                  {getKanbanOrders('accepted').length === 0 && (
                    <p className="text-center text-xs text-zinc-500 py-8 font-medium">No accepted orders</p>
                  )}
                </div>
              </div>

              {/* COLUMN 3: PREPARING */}
              <div className="flex flex-col rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-4 max-h-full overflow-y-auto backdrop-blur-sm shadow-lg">
                <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-purple-500" />
                    <h3 className="font-bold text-white text-base tracking-tight">Preparing</h3>
                  </div>
                  <span className="bg-zinc-800 text-zinc-300 text-xs font-bold px-2.5 py-1 rounded-full">
                    {getKanbanOrders('preparing').length}
                  </span>
                </div>
                <div className="space-y-4 flex-1">
                  {getKanbanOrders('preparing').map(order => (
                    <OrderCard 
                      key={order.id} 
                      order={order} 
                      onAction={() => updateOrderStatus(order.id, 'ready')} 
                      actionLabel="Mark Ready"
                      actionColor="from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400"
                      onClick={() => setSelectedOrder(order)}
                    />
                  ))}
                  {getKanbanOrders('preparing').length === 0 && (
                    <p className="text-center text-xs text-zinc-500 py-8 font-medium">No orders in preparation</p>
                  )}
                </div>
              </div>

              {/* COLUMN 4: READY */}
              <div className="flex flex-col rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-4 max-h-full overflow-y-auto backdrop-blur-sm shadow-lg">
                <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-emerald-500" />
                    <h3 className="font-bold text-white text-base tracking-tight">Ready for Pickup</h3>
                  </div>
                  <span className="bg-zinc-800 text-zinc-300 text-xs font-bold px-2.5 py-1 rounded-full">
                    {getKanbanOrders('ready').length}
                  </span>
                </div>
                <div className="space-y-4 flex-1">
                  {getKanbanOrders('ready').map(order => (
                    <OrderCard 
                      key={order.id} 
                      order={order} 
                      onAction={() => updateOrderStatus(order.id, 'completed')} 
                      actionLabel="Complete Order"
                      actionColor="from-zinc-700 to-zinc-600 hover:from-zinc-600 hover:to-zinc-500"
                      onClick={() => setSelectedOrder(order)}
                    />
                  ))}
                  {getKanbanOrders('ready').length === 0 && (
                    <p className="text-center text-xs text-zinc-500 py-8 font-medium">No orders waiting pickup</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ACTIVE HANDOFFS */}
        {activeTab === 'handoff' && (
          <div className="p-8 max-w-5xl mx-auto w-full space-y-6">
            <div className="flex items-center justify-between bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl backdrop-blur-sm shadow-lg">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Customer Handoff Requests</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  Customers who clicked &quot;Talk to Staff&quot;. The automated bot is paused for these sessions.
                </p>
              </div>
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-xl text-red-400 font-semibold text-sm">
                <AlertTriangle className="h-5 w-5" />
                <span>{handoffSessions.length} Active Requests</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {handoffSessions.map(session => (
                <div key={session.id} className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl space-y-6 backdrop-blur-sm shadow-lg hover:border-zinc-700 transition-all flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                          <User className="h-6 w-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-base">
                            {session.customers?.display_name || session.customers?.phone_e164}
                          </h4>
                          <p className="text-xs text-zinc-400 font-mono">{session.customers?.phone_e164}</p>
                        </div>
                      </div>
                      <span className="bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Waiting</span>
                      </span>
                    </div>

                    <div className="bg-zinc-950/50 rounded-xl p-4 border border-zinc-800/80 space-y-2">
                      <div className="flex justify-between text-xs text-zinc-400">
                        <span>Last Activity:</span>
                        <span className="font-mono text-white">
                          {new Date(session.last_activity_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-zinc-400">
                        <span>Session State:</span>
                        <span className="font-mono text-amber-400 font-semibold">{session.state}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-4 border-t border-zinc-800">
                    <a
                      href={`https://wa.me/${session.customers?.phone_e164.replace('+', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 py-3 px-4 text-center font-semibold text-white text-sm transition-all flex items-center justify-center gap-2 border border-zinc-700"
                    >
                      <Phone className="h-4 w-4 text-emerald-400" />
                      <span>Open WhatsApp</span>
                    </a>
                    <button
                      onClick={() => resolveHandoff(session.id)}
                      className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 py-3 px-4 text-center font-semibold text-zinc-950 text-sm shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-300 transition-all flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Resolve & Resume Bot</span>
                    </button>
                  </div>
                </div>
              ))}

              {handoffSessions.length === 0 && (
                <div className="col-span-full bg-zinc-900/30 border border-zinc-800/80 p-12 rounded-2xl text-center space-y-4">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
                  <div>
                    <h4 className="text-lg font-bold text-white">All Clear!</h4>
                    <p className="text-sm text-zinc-500 mt-1">No active customer handoff requests pending.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SYSTEM SETTINGS */}
        {activeTab === 'settings' && (
          <div className="p-8 max-w-4xl mx-auto w-full space-y-8">
            <div className="bg-zinc-900/60 border border-zinc-800 p-8 rounded-3xl backdrop-blur-sm shadow-lg space-y-8">
              <div className="flex items-center justify-between pb-6 border-b border-zinc-800">
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Kitchen Operating Parameters</h3>
                  <p className="text-sm text-zinc-400 mt-1">Configure real-time automation thresholds and emergency overrides.</p>
                </div>
                {currentUser?.role !== 'admin' && (
                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl text-amber-400 text-xs font-semibold">
                    <ShieldAlert className="h-4 w-4" />
                    <span>View Only (Admin Required)</span>
                  </div>
                )}
              </div>

              <div className="space-y-8">
                {/* Kill Switch */}
                <div className="flex items-center justify-between p-6 rounded-2xl bg-zinc-950/50 border border-zinc-800/80 hover:border-zinc-700 transition-all">
                  <div className="space-y-1 max-w-md">
                    <div className="flex items-center gap-2.5">
                      <Power className={`h-5 w-5 ${settings.digital_lane_paused ? 'text-red-500 animate-pulse' : 'text-zinc-500'}`} />
                      <h4 className="font-bold text-white text-base">Digital Lane Paused (Kill Switch)</h4>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Instantly stops accepting new WhatsApp orders. Customers are prompted to order directly at the walk-up window.
                    </p>
                  </div>
                  <button
                    onClick={() => updateSetting('digital_lane_paused', !settings.digital_lane_paused)}
                    disabled={currentUser?.role !== 'admin'}
                    className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none ${
                      settings.digital_lane_paused ? 'bg-red-500' : 'bg-zinc-700'
                    } ${currentUser?.role !== 'admin' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                      settings.digital_lane_paused ? 'translate-x-9' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {/* Rain Protocol */}
                <div className="flex items-center justify-between p-6 rounded-2xl bg-zinc-950/50 border border-zinc-800/80 hover:border-zinc-700 transition-all">
                  <div className="space-y-1 max-w-md">
                    <div className="flex items-center gap-2.5">
                      <CloudRain className={`h-5 w-5 ${settings.rain_protocol_active ? 'text-blue-500' : 'text-zinc-500'}`} />
                      <h4 className="font-bold text-white text-base">Rain Protocol Active</h4>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Adapts menu items and packaging for heavy rain conditions. Automatically adjusts promised ETA buffers.
                    </p>
                  </div>
                  <button
                    onClick={() => updateSetting('rain_protocol_active', !settings.rain_protocol_active)}
                    disabled={currentUser?.role !== 'admin'}
                    className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none ${
                      settings.rain_protocol_active ? 'bg-blue-500' : 'bg-zinc-700'
                    } ${currentUser?.role !== 'admin' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                      settings.rain_protocol_active ? 'translate-x-9' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {/* Rush Threshold */}
                <div className="p-6 rounded-2xl bg-zinc-950/50 border border-zinc-800/80 space-y-4 hover:border-zinc-700 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <Sliders className="h-5 w-5 text-amber-500" />
                        <h4 className="font-bold text-white text-base">Kitchen Rush Threshold</h4>
                      </div>
                      <p className="text-xs text-zinc-400">Number of pending items before dynamic ETA inflation triggers automatically.</p>
                    </div>
                    <span className="font-mono text-2xl font-bold text-amber-400">{settings.rush_threshold} items</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    step="5"
                    disabled={currentUser?.role !== 'admin'}
                    value={settings.rush_threshold}
                    onChange={(e) => updateSetting('rush_threshold', parseInt(e.target.value))}
                    className="w-full accent-amber-500 bg-zinc-800 rounded-lg appearance-none h-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                    <span>5 items (Low Buffer)</span>
                    <span>25 items (Normal)</span>
                    <span>50 items (High Capacity)</span>
                  </div>
                </div>

                {/* ETA Inflation Factor */}
                <div className="p-6 rounded-2xl bg-zinc-950/50 border border-zinc-800/80 space-y-4 hover:border-zinc-700 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <Clock className="h-5 w-5 text-amber-500" />
                        <h4 className="font-bold text-white text-base">ETA Inflation Multiplier</h4>
                      </div>
                      <p className="text-xs text-zinc-400">Multiplier applied to base prep time during rush hours.</p>
                    </div>
                    <span className="font-mono text-2xl font-bold text-amber-400">{settings.eta_inflation_factor}x</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="3.0"
                    step="0.1"
                    disabled={currentUser?.role !== 'admin'}
                    value={settings.eta_inflation_factor}
                    onChange={(e) => updateSetting('eta_inflation_factor', parseFloat(e.target.value))}
                    className="w-full accent-amber-500 bg-zinc-800 rounded-lg appearance-none h-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                    <span>1.0x (No Inflation)</span>
                    <span>2.0x (Double Time)</span>
                    <span>3.0x (Maximum Buffer)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ORDER DETAIL MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-lg w-full space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute right-6 top-6 p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-all"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-2 border-b border-zinc-800 pb-6">
              <div className="flex items-center gap-3">
                <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono font-bold text-sm px-3 py-1 rounded-xl">
                  {selectedOrder.order_code}
                </span>
                <span className="text-xs text-zinc-400 font-mono">
                  {new Date(selectedOrder.created_at).toLocaleString()}
                </span>
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">
                {selectedOrder.customers?.display_name || selectedOrder.customers?.phone_e164}
              </h3>
              <p className="text-sm text-zinc-400 font-mono flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-zinc-500" />
                <span>{selectedOrder.customers?.phone_e164}</span>
              </p>
            </div>

            {/* Items List */}
            <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Order Items</h4>
              {selectedOrder.order_items?.map((item, idx) => (
                <div key={item.id || idx} className="bg-zinc-950/50 border border-zinc-800/80 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between font-semibold text-white text-base">
                    <span>{item.qty}x {item.menu_items?.name}</span>
                    <span className="font-mono text-amber-400">₹{item.line_total_inr}</span>
                  </div>

                  {item.order_item_modifiers && item.order_item_modifiers.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800/60">
                      {item.order_item_modifiers.map((mod, midx) => (
                        <span key={midx} className="bg-zinc-800 text-zinc-300 text-xs px-2.5 py-1 rounded-lg border border-zinc-700 flex items-center gap-1.5 font-medium">
                          <span>{mod.modifier_name}</span>
                          {mod.price_delta_inr > 0 && (
                            <span className="text-amber-400 font-mono">+₹{mod.price_delta_inr}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}

                  {item.customer_note && (
                    <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl italic mt-2">
                      &quot;{item.customer_note}&quot;
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Summary / Total */}
            <div className="bg-zinc-950 rounded-2xl p-6 border border-zinc-800 space-y-3">
              <div className="flex justify-between text-sm text-zinc-400 font-medium">
                <span>Subtotal</span>
                <span className="font-mono text-white">₹{selectedOrder.subtotal_inr}</span>
              </div>
              <div className="flex justify-between text-sm text-zinc-400 font-medium">
                <span>Payment Status ({selectedOrder.payment_mode})</span>
                <span className={`font-semibold uppercase tracking-wider text-xs px-2.5 py-1 rounded-full border ${
                  selectedOrder.payment_status === 'paid' 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                }`}>
                  {selectedOrder.payment_status}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-white pt-3 border-t border-zinc-800">
                <span>Grand Total</span>
                <span className="font-mono text-xl text-amber-400">₹{selectedOrder.total_inr}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KANBAN ORDER CARD COMPONENT
// ---------------------------------------------------------------------------
function OrderCard({ 
  order, 
  onAction, 
  actionLabel, 
  actionColor,
  onClick
}: { 
  order: Order; 
  onAction: () => void; 
  actionLabel: string; 
  actionColor: string;
  onClick: () => void;
}) {
  return (
    <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-5 space-y-4 shadow-md hover:border-amber-500/50 hover:shadow-amber-500/5 transition-all group relative flex flex-col justify-between">
      <div className="space-y-3 cursor-pointer" onClick={onClick}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="bg-zinc-800 group-hover:bg-amber-500/10 group-hover:text-amber-400 group-hover:border-amber-500/20 border border-zinc-700 text-zinc-200 font-mono font-bold text-xs px-2.5 py-1 rounded-xl transition-all">
            {order.order_code}
          </span>
          <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-lg">
            <Clock className="h-3 w-3 text-amber-500" />
            <span>{order.promised_eta_min}m ETA</span>
          </div>
        </div>

        {/* Customer */}
        <div>
          <h4 className="font-bold text-white text-sm group-hover:text-amber-400 transition-colors truncate">
            {order.customers?.display_name || order.customers?.phone_e164}
          </h4>
          <p className="text-[11px] text-zinc-500 font-mono truncate">{order.customers?.phone_e164}</p>
        </div>

        {/* Items Summary */}
        <div className="space-y-1.5 pt-2 border-t border-zinc-800/60">
          {order.order_items?.map((item, idx) => (
            <div key={item.id || idx} className="text-xs text-zinc-300 font-medium flex items-center justify-between">
              <span className="truncate pr-2">
                <span className="font-bold text-amber-400">{item.qty}x</span> {item.menu_items?.name}
              </span>
              <span className="font-mono text-zinc-500 text-[11px]">₹{item.line_total_inr}</span>
            </div>
          ))}
        </div>

        {/* Customer Note Badge */}
        {order.customer_note && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-[11px] text-amber-300 italic line-clamp-2">
            &quot;{order.customer_note}&quot;
          </div>
        )}
      </div>

      {/* Footer / Action */}
      <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Total</span>
          <span className="font-mono font-bold text-white text-sm">₹{order.total_inr}</span>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onAction(); }}
          className={`rounded-xl bg-gradient-to-r ${actionColor} py-2 px-3 text-center font-semibold text-white text-xs shadow-md active:scale-95 transition-all flex items-center gap-1.5 ml-auto`}
        >
          <span>{actionLabel}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
