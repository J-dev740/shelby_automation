import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Order } from '../types';
import { OrderCard } from './OrderCard';
import { RefreshCw, Filter, Search, ChevronDown, CheckCircle2 } from 'lucide-react';

interface HistoryTabProps {
  onSelectOrder: (order: Order) => void;
}

const PAGE_SIZE = 20;

export function HistoryTab({ onSelectOrder }: HistoryTabProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [dateFilter, setDateFilter] = useState<string>(''); // YYYY-MM-DD
  const [searchQuery, setSearchQuery] = useState('');

  const fetchHistory = useCallback(async (isLoadMore: boolean = false) => {
    const currentPage = isLoadMore ? page + 1 : 0;
    if (!isLoadMore) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          customers ( phone_e164, display_name ),
          order_items (
            id, qty, unit_price_inr, line_total_inr, customer_note, position,
            menu_items ( name ),
            order_item_modifiers ( modifier_name, price_delta_inr )
          )
        `, { count: 'exact' });

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('state', statusFilter);
      } else {
        query = query.in('state', ['completed', 'cancelled']);
      }

      // Apply date filter
      if (dateFilter) {
        // Assume dateFilter is YYYY-MM-DD
        const startOfDay = new Date(`${dateFilter}T00:00:00.000Z`).toISOString();
        const endOfDay = new Date(`${dateFilter}T23:59:59.999Z`).toISOString();
        query = query.gte('created_at', startOfDay).lte('created_at', endOfDay);
      }

      // Apply search (order_code or phone_e164)
      if (searchQuery) {
        // A simple text search or ilike
        // Supabase standard ilike on order_code. Searching joined customer phone is harder via standard PostgREST without a custom view or RPC, so we will just search order_code for now.
        query = query.ilike('order_code', `%${searchQuery}%`);
      }

      // Pagination
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      const typedData = (data as unknown) as Order[];

      if (isLoadMore) {
        setOrders(prev => [...prev, ...typedData]);
      } else {
        setOrders(typedData);
      }

      setPage(currentPage);
      
      if (count !== null) {
         setHasMore(from + PAGE_SIZE < count);
      } else {
         setHasMore(typedData.length === PAGE_SIZE);
      }

    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [statusFilter, dateFilter, searchQuery, page]);

  // Use a ref to debounce search
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // eslint-disable-next-line
    fetchHistory(false);
    // We intentionally don't include fetchHistory in dependency array to avoid loops, we trigger it manually on filter change.
  }, [statusFilter, dateFilter]); // search query will be handled via debounced effect

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      // eslint-disable-next-line
      fetchHistory(false);
    }, 500);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchQuery]);

  return (
    <div className="w-full h-full flex flex-col bg-zinc-900/30 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-lg">
      <div className="p-4 border-b border-zinc-800/80 flex flex-col md:flex-row gap-4 items-center justify-between bg-zinc-900/50">
        <h2 className="font-bold text-white tracking-tight flex items-center gap-2 text-lg w-full md:w-auto">
          History & Archive
        </h2>
        
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 md:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Search order code..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:w-48 pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Date Picker (native for simplicity) */}
          <div className="relative">
            <input 
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="pl-3 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-300 focus:outline-none focus:border-amber-500/50 [color-scheme:dark]"
            />
          </div>

          {/* Status Dropdown */}
          <div className="relative">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'completed' | 'cancelled')}
              className="appearance-none pl-3 pr-8 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-300 focus:outline-none focus:border-amber-500/50"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
        {loading && (
          <div className="absolute inset-0 z-10 bg-zinc-950/50 backdrop-blur-sm flex items-center justify-center">
            <RefreshCw className="h-6 w-6 text-amber-500 animate-spin" />
          </div>
        )}

        {orders.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-2 py-12">
            <Filter className="h-8 w-8 text-zinc-700" />
            <p className="text-sm font-medium">No orders found matching filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {orders.map(order => (
              <OrderCard 
                key={order.id} 
                order={order} 
                onClick={() => onSelectOrder(order)} 
              />
            ))}
          </div>
        )}

        {orders.length > 0 && (
          <div className="pt-6 pb-2 flex justify-center">
            {hasMore ? (
              <button 
                onClick={() => fetchHistory(true)}
                disabled={loadingMore}
                className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loadingMore ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                Load More
              </button>
            ) : (
              <span className="text-xs text-zinc-500 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> End of history
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
