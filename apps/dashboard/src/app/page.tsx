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
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, state: newState } : null);
      }
    } catch (err) {
      console.error('Failed to update order status:', err);
      alert('Failed to update order status');
    }
  };

  const markOrderPaid = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ payment_status: 'paid', payment_mode: 'cash', updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;
      
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, payment_status: 'paid', payment_mode: 'cash', updated_at: new Date().toISOString() } : o));
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, payment_status: 'paid', payment_mode: 'cash' } : null);
      }
    } catch (err) {
      console.error('Failed to mark order paid:', err);
      alert('Failed to mark order paid');
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

          {process.env.NODE_ENV !== 'production' && (
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
          )}
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
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-amber-500 selection:text-zinc-950 overflow-hidden">
      {/* TOP BAR */}
      <header className="h-16 border-b border-zinc-800/80 px-4 md:px-6 flex items-center justify-between backdrop-blur-md bg-zinc-950/80 z-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 to-amber-300 shadow-sm shadow-amber-500/20">
            <ChefHat className="h-5 w-5 text-zinc-950" />
          </div>
          <div>
            <h1 className="font-bold text-white tracking-tight leading-none text-lg">Shelby OS</h1>
            <span className="text-[9px] font-medium uppercase tracking-wider text-amber-400">Kitchen Dashboard</span>
          </div>
        </div>
        
        {/* Status & Quick Controls */}
        <div className="flex items-center gap-3 md:gap-4">
          {loadingData && <RefreshCw className="h-4 w-4 text-amber-500 animate-spin" />}
          {settings.digital_lane_paused && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold animate-pulse">
              <Power className="h-3.5 w-3.5" />
              <span>Kill Switch On</span>
            </div>
          )}
          <div className="hidden md:flex items-center gap-2 px-3 border-l border-zinc-800">
            <div className={`h-2 w-2 rounded-full ${heartbeatStatus === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="text-xs text-zinc-400 font-mono">{lastHeartbeat.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <button onClick={() => setActiveTab(activeTab === 'settings' ? 'kanban' : 'settings')} className={`p-1.5 rounded-lg transition-colors border ${activeTab === 'settings' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'border-transparent text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
            <SettingsIcon className="h-4 w-4" />
          </button>
          <button onClick={handleLogout} className="p-1.5 border border-transparent text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* MAIN BENTO GRID */}
      <main className="flex-1 p-2 md:p-4 overflow-hidden flex relative">
        {activeTab === 'settings' ? (
          <SettingsPanel settings={settings} updateSetting={updateSetting} currentUser={currentUser} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4 w-full h-full max-h-full">
            {/* ACTION CENTER (col-span-8) */}
            <section className="lg:col-span-8 flex flex-col bg-zinc-900/30 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-lg">
              <div className="p-3 md:p-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/50">
                <h2 className="font-bold text-white tracking-tight flex items-center gap-2 text-sm md:text-base">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Action Center
                </h2>
                <div className="flex gap-2">
                  {handoffSessions.length > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md animate-pulse">
                      {handoffSessions.length} Handoffs
                    </span>
                  )}
                  <span className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] font-bold px-2 py-0.5 rounded-md">
                    {getKanbanOrders('new').length + getKanbanOrders('accepted').length} New
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2 md:space-y-3">
                {handoffSessions.map(session => (
                   <HandoffRow key={session.id} session={session} onResolve={() => resolveHandoff(session.id)} />
                ))}
                {getKanbanOrders('new').map(order => (
                   <OrderRow key={order.id} order={order} onAction={() => updateOrderStatus(order.id, 'accepted')} actionLabel="Accept" actionColor="bg-amber-500 hover:bg-amber-400 text-zinc-950" onClick={() => setSelectedOrder(order)} />
                ))}
                {getKanbanOrders('accepted').map(order => (
                   <OrderRow key={order.id} order={order} onAction={() => updateOrderStatus(order.id, 'preparing')} actionLabel="Start Prep" actionColor="bg-blue-500 hover:bg-blue-400 text-white" onClick={() => setSelectedOrder(order)} />
                ))}
                {handoffSessions.length === 0 && getKanbanOrders('new').length === 0 && getKanbanOrders('accepted').length === 0 && (
                   <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-2 py-12">
                     <CheckCircle2 className="h-8 w-8 text-zinc-700" />
                     <p className="text-sm font-medium">No pending actions. All caught up!</p>
                   </div>
                )}
              </div>
            </section>

            {/* TRACKING STACK (col-span-4) */}
            <section className="lg:col-span-4 flex flex-col gap-3 md:gap-4 h-full">
              {/* Preparing */}
              <div className="flex-1 flex flex-col bg-zinc-900/30 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-lg min-h-[250px]">
                <div className="p-3 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/50">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <ChefHat className="h-4 w-4 text-purple-500" /> Preparing
                  </h3>
                  <span className="text-xs text-zinc-400 font-mono bg-zinc-800 px-2 py-0.5 rounded-md">{getKanbanOrders('preparing').length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 md:p-3 space-y-2">
                  {getKanbanOrders('preparing').map(order => (
                    <OrderRow key={order.id} order={order} compact onAction={() => updateOrderStatus(order.id, 'ready')} actionLabel="Ready" actionColor="bg-purple-500 hover:bg-purple-400 text-white" onClick={() => setSelectedOrder(order)} />
                  ))}
                  {getKanbanOrders('preparing').length === 0 && (
                    <p className="text-center text-xs text-zinc-600 py-6">Empty</p>
                  )}
                </div>
              </div>

              {/* Ready */}
              <div className="flex-1 flex flex-col bg-zinc-900/30 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-lg min-h-[250px]">
                <div className="p-3 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/50">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Ready
                  </h3>
                  <span className="text-xs text-zinc-400 font-mono bg-zinc-800 px-2 py-0.5 rounded-md">{getKanbanOrders('ready').length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 md:p-3 space-y-2">
                  {getKanbanOrders('ready').map(order => (
                    <OrderRow key={order.id} order={order} compact onAction={() => updateOrderStatus(order.id, 'completed')} actionLabel="Done" actionColor="bg-emerald-500 hover:bg-emerald-400 text-zinc-950" onClick={() => setSelectedOrder(order)} />
                  ))}
                  {getKanbanOrders('ready').length === 0 && (
                    <p className="text-center text-xs text-zinc-600 py-6">Empty</p>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* SLIDE-OVER DRAWER FOR ORDER DETAILS */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end md:justify-end justify-center items-end md:items-stretch">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" 
            onClick={() => setSelectedOrder(null)} 
          />
          
          {/* Drawer Panel */}
          <div className="relative w-full md:w-[450px] h-[90vh] md:h-full bg-zinc-950 border-t md:border-t-0 md:border-l border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-bottom md:slide-in-from-right duration-300 rounded-t-3xl md:rounded-none">
            
            {/* Drawer Header */}
            <div className="p-5 md:p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/30 flex-shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-white tracking-tight">Order {selectedOrder.order_code}</h3>
                  {selectedOrder.payment_status !== 'paid' && (
                    <span className="bg-red-500/10 border border-red-500/20 text-red-400 font-semibold text-[10px] px-2 py-0.5 rounded-md uppercase">Unpaid</span>
                  )}
                </div>
                <p className="text-sm text-zinc-400 flex items-center gap-2">
                  <User className="h-3.5 w-3.5" />
                  {selectedOrder.customers?.display_name || selectedOrder.customers?.phone_e164}
                </p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 rounded-full transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6">
              {/* Order Items */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Items</h4>
                {selectedOrder.order_items?.map((item, idx) => (
                  <div key={item.id || idx} className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-start justify-between font-medium text-white text-sm">
                      <div className="flex gap-2">
                        <span className="font-bold text-amber-500">{item.qty}x</span>
                        <span>{item.menu_items?.name}</span>
                      </div>
                      <span className="font-mono text-zinc-400">₹{item.line_total_inr}</span>
                    </div>

                    {item.order_item_modifiers && item.order_item_modifiers.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pl-6">
                        {item.order_item_modifiers.map((mod, midx) => (
                          <span key={midx} className="bg-zinc-800 text-zinc-300 text-[10px] px-2 py-0.5 rounded border border-zinc-700">
                            {mod.modifier_name} {mod.price_delta_inr > 0 ? `(+₹${mod.price_delta_inr})` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {item.customer_note && (
                      <div className="ml-6 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg text-[11px] text-amber-300 italic">
                        "{item.customer_note}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Receipt Summary */}
              <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 space-y-2">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Subtotal</span>
                  <span className="font-mono">₹{selectedOrder.subtotal_inr}</span>
                </div>
                <div className="flex justify-between text-xs text-zinc-400 items-center">
                  <span>Payment ({selectedOrder.payment_mode})</span>
                  <div className="flex items-center gap-2">
                    <span className={selectedOrder.payment_status === 'paid' ? 'text-emerald-400' : 'text-red-400'}>
                      {selectedOrder.payment_status.toUpperCase()}
                    </span>
                    {selectedOrder.payment_status !== 'paid' && (
                      <button onClick={() => markOrderPaid(selectedOrder.id)} className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-white px-2 py-1 rounded border border-zinc-700">
                        Mark Paid
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-zinc-800/80">
                  <span>Total</span>
                  <span className="font-mono text-amber-400">₹{selectedOrder.total_inr}</span>
                </div>
              </div>
            </div>

            {/* Drawer Footer (Fixed Primary Action) */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex-shrink-0">
               {selectedOrder.state === 'new' && (
                 <DrawerActionButton label="Accept Order" color="bg-amber-500 hover:bg-amber-400 text-zinc-950" onClick={() => updateOrderStatus(selectedOrder.id, 'accepted')} />
               )}
               {selectedOrder.state === 'accepted' && (
                 <DrawerActionButton label="Start Preparing" color="bg-blue-500 hover:bg-blue-400 text-white" onClick={() => updateOrderStatus(selectedOrder.id, 'preparing')} />
               )}
               {selectedOrder.state === 'preparing' && (
                 <DrawerActionButton label="Mark Ready for Pickup" color="bg-purple-500 hover:bg-purple-400 text-white" onClick={() => updateOrderStatus(selectedOrder.id, 'ready')} />
               )}
               {selectedOrder.state === 'ready' && (
                 <DrawerActionButton label="Complete Order" color="bg-emerald-500 hover:bg-emerald-400 text-zinc-950" onClick={() => updateOrderStatus(selectedOrder.id, 'completed')} />
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// COMPONENTS
// ---------------------------------------------------------------------------

function DrawerActionButton({ label, color, onClick }: { label: string, color: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full py-4 rounded-xl font-bold text-sm md:text-base shadow-lg transition-transform active:scale-[0.98] ${color}`}
    >
      {label}
    </button>
  );
}

function OrderRow({ order, compact = false, onAction, actionLabel, actionColor, onClick }: any) {
  return (
    <div 
      onClick={onClick}
      className="group bg-zinc-950/50 border border-zinc-800/60 hover:border-amber-500/50 rounded-xl p-3 md:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 cursor-pointer transition-all hover:bg-zinc-900/50"
    >
      <div className="flex-1 min-w-0 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="font-mono font-bold text-zinc-200 text-xs md:text-sm">{order.order_code}</span>
          {order.payment_status !== 'paid' && (
            <span className="bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] px-1.5 py-0.5 rounded uppercase font-bold">Unpaid</span>
          )}
        </div>
        
        {!compact && (
          <div className="flex-1 min-w-0">
            <p className="text-xs md:text-sm font-medium text-white truncate">{order.customers?.display_name || order.customers?.phone_e164}</p>
            <p className="text-[10px] md:text-xs text-zinc-400 truncate">
              {order.order_items?.map((i:any) => `${i.qty}x ${i.menu_items?.name}`).join(', ')}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between md:justify-end gap-3 flex-shrink-0">
        <div className="text-right hidden md:block">
           <p className="text-xs font-mono text-zinc-400">{order.promised_eta_min}m ETA</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onAction(); }}
          className={`px-4 md:px-5 py-2 md:py-2.5 rounded-lg font-bold text-xs shadow-md transition-transform active:scale-95 ${actionColor}`}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

function HandoffRow({ session, onResolve }: any) {
  return (
    <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 md:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-all">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 flex-shrink-0">
          <User className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-red-100 truncate">{session.customers?.display_name || session.customers?.phone_e164}</p>
          <p className="text-xs text-red-400/80">Needs Staff Assistance</p>
        </div>
      </div>
      <button
        onClick={onResolve}
        className="px-4 py-2 rounded-lg font-bold text-xs bg-red-500 hover:bg-red-400 text-white transition-all flex items-center justify-center gap-1.5"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        Resolve
      </button>
    </div>
  );
}

function SettingsPanel({ settings, updateSetting, currentUser }: any) {
  return (
    <div className="w-full max-w-3xl mx-auto p-4 md:p-8 overflow-y-auto">
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6 md:p-8 space-y-8 backdrop-blur-sm shadow-xl">
        <div className="border-b border-zinc-800 pb-4">
          <h2 className="text-xl font-bold text-white">System Settings</h2>
          <p className="text-sm text-zinc-400">Configure parameters and overrides.</p>
        </div>
        
        <div className="space-y-6">
          <SettingToggle 
            icon={<Power className="h-5 w-5" />} title="Kill Switch (Pause Orders)" 
            desc="Stops accepting new digital orders."
            active={settings.digital_lane_paused} color="bg-red-500" 
            onToggle={() => updateSetting('digital_lane_paused', !settings.digital_lane_paused)} 
            disabled={currentUser?.role !== 'admin'} 
          />
          <SettingToggle 
            icon={<CloudRain className="h-5 w-5" />} title="Rain Protocol" 
            desc="Adapts menu and increases buffers automatically."
            active={settings.rain_protocol_active} color="bg-blue-500" 
            onToggle={() => updateSetting('rain_protocol_active', !settings.rain_protocol_active)} 
            disabled={currentUser?.role !== 'admin'} 
          />
        </div>
      </div>
    </div>
  );
}

function SettingToggle({ icon, title, desc, active, color, onToggle, disabled }: any) {
  return (
    <div className="flex items-center justify-between p-4 md:p-5 rounded-2xl bg-zinc-950/50 border border-zinc-800/80">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${active ? color+'/20 text-'+color.split('-')[1]+'-400' : 'bg-zinc-800 text-zinc-400'}`}>
           {icon}
        </div>
        <div>
          <h4 className="font-bold text-white text-sm md:text-base">{title}</h4>
          <p className="text-[10px] md:text-xs text-zinc-400">{desc}</p>
        </div>
      </div>
      <button
        onClick={onToggle}
        disabled={disabled}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${active ? color : 'bg-zinc-700'} ${disabled ? 'opacity-50' : ''}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${active ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}
