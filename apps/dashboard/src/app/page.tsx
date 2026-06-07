"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, ChefHat, RefreshCw, ArrowRight, CheckCircle2, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Types
import { Order, Session, SystemSettings, CurrentUser } from '../types';

// Components
import { DashboardHeader } from '../components/DashboardHeader';
import { SettingsPanel } from '../components/SettingsPanel';
import { OrderCard } from '../components/OrderCard';
import { OrderDetailsDrawer } from '../components/OrderDetailsDrawer';
import { HandoffRow } from '../components/HandoffRow';
import { HistoryTab } from '../components/HistoryTab';
import { AudioAlert } from '../components/AudioAlert';
import { POSModal } from '../components/POSModal';

export default function Dashboard() {
  // Auth State
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(false);

  // Navigation & UI State
  const [activeTab, setActiveTab] = useState<'kanban' | 'handoff' | 'settings' | 'history'>('kanban');
  const [searchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showPOS, setShowPOS] = useState(false);

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
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
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
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
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
        const { data: staffUser } = await supabase
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
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
      setAuthError(errorMessage);
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

      const { data: settingsData, error: settingsErr } = await supabase
        .from('system_settings')
        .select('*');

      if (!settingsErr && settingsData) {
        const settingsMap: Record<string, unknown> = {};
        settingsData.forEach(item => {
          settingsMap[item.key] = typeof item.value_json === 'string' ? JSON.parse(item.value_json) : item.value_json;
        });
        setSettings(prev => ({ ...prev, ...settingsMap }));
      }

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
      // eslint-disable-next-line
      fetchData();

      const ordersSub = supabase
        .channel('custom-orders-channel')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
          const updatedOrder = payload.new as Partial<Order>;
          setOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o));
          setSelectedOrder(prev => (prev && prev.id === updatedOrder.id) ? { ...prev, ...updatedOrder } as Order : prev);
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => fetchData())
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, (payload) => {
          setOrders(prev => prev.filter(o => o.id !== payload.old.id));
        })
        .subscribe();

      const sessionsSub = supabase
        .channel('custom-sessions-channel')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions' }, (payload) => {
          const updatedSession = payload.new as Partial<Session>;
          if (updatedSession.state === 'handoff_active') {
            setHandoffSessions(prev => {
              if (prev.find(s => s.id === updatedSession.id)) {
                return prev.map(s => s.id === updatedSession.id ? { ...s, ...updatedSession } as Session : s);
              } else {
                fetchData(); 
                return prev;
              }
            });
          } else {
            setHandoffSessions(prev => prev.filter(s => s.id !== updatedSession.id));
          }
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sessions' }, () => fetchData())
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'sessions' }, (payload) => {
          setHandoffSessions(prev => prev.filter(s => s.id !== payload.old.id));
        })
        .subscribe();

      const settingsSub = supabase
        .channel('custom-settings-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, () => {
          fetchData();
        })
        .subscribe();

      const heartbeatInterval = setInterval(async () => {
        try {
          const { error } = await supabase.from('system_settings').select('key').limit(1);
          if (error) throw error;
          
          setLastHeartbeat(new Date());
          missedBeatsRef.current = 0;
          setHeartbeatStatus('online');
        } catch {
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

  const updateSetting = async (key: string, value: unknown) => {
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
      <AudioAlert newOrderCount={getKanbanOrders('new').length} />
      <DashboardHeader 
        loadingData={loadingData}
        settings={settings}
        heartbeatStatus={heartbeatStatus}
        lastHeartbeat={lastHeartbeat}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        handleLogout={handleLogout}
      />

      {/* MAIN BENTO GRID */}
      <main className="flex-1 p-2 md:p-4 overflow-hidden flex relative">
        {activeTab === 'settings' ? (
          <SettingsPanel settings={settings} updateSetting={updateSetting} currentUser={currentUser} />
        ) : activeTab === 'history' ? (
          <HistoryTab onSelectOrder={setSelectedOrder} />
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
                  <button 
                    onClick={() => setShowPOS(true)}
                    className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-400 text-white text-[10px] font-bold px-2.5 py-1 rounded-md transition-colors shadow-sm"
                  >
                    <Plus className="h-3 w-3" />
                    New Order
                  </button>
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
                   <OrderCard key={order.id} order={order} onAction={() => updateOrderStatus(order.id, 'accepted')} actionLabel="Accept" actionColor="bg-amber-500 hover:bg-amber-400 text-zinc-950" onClick={() => setSelectedOrder(order)} />
                ))}
                {getKanbanOrders('accepted').map(order => (
                   <OrderCard key={order.id} order={order} onAction={() => updateOrderStatus(order.id, 'preparing')} actionLabel="Start Prep" actionColor="bg-blue-500 hover:bg-blue-400 text-white" onClick={() => setSelectedOrder(order)} />
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
                    <OrderCard key={order.id} order={order} compact onAction={() => updateOrderStatus(order.id, 'ready')} actionLabel="Ready" actionColor="bg-purple-500 hover:bg-purple-400 text-white" onClick={() => setSelectedOrder(order)} />
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
                    <OrderCard key={order.id} order={order} compact onAction={() => updateOrderStatus(order.id, 'completed')} actionLabel="Done" actionColor="bg-emerald-500 hover:bg-emerald-400 text-zinc-950" onClick={() => setSelectedOrder(order)} />
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
      <OrderDetailsDrawer 
        selectedOrder={selectedOrder}
        setSelectedOrder={setSelectedOrder}
        updateOrderStatus={updateOrderStatus}
        markOrderPaid={markOrderPaid}
      />

      {/* POS Modal */}
      <POSModal 
        isOpen={showPOS}
        onClose={() => setShowPOS(false)}
        onOrderPlaced={() => fetchData()}
      />
    </div>
  );
}
