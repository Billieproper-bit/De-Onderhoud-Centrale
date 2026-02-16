import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { MaintenanceSystem, UserProfile } from '../types';
import AdminModal from './AdminModal.tsx';

interface Props {
  profile: UserProfile | null;
}

const Dashboard: React.FC<Props> = ({ profile }) => {
  const [systems, setSystems] = useState<MaintenanceSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [filter, setFilter] = useState({ category: '', brand: '', search: '' });

  useEffect(() => {
    fetchSystems();
    if (profile?.role === 'admin') {
      fetchPendingCount();
    }
  }, [profile]);

  const fetchSystems = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('systems').select('*').order('brand');
    if (error) console.error(error);
    else setSystems(data || []);
    setLoading(false);
  };

  const fetchPendingCount = async () => {
    const { count, error } = await supabase
      .from('user_roles')
      .select('*', { count: 'exact', head: true })
      .eq('is_approved', false);
    
    if (!error && count !== null) setPendingCount(count);
  };

  const filteredSystems = systems.filter(s => {
    const matchesCategory = !filter.category || s.systemtype === filter.category;
    const matchesBrand = !filter.brand || s.brand === filter.brand;
    const matchesSearch = !filter.search || 
      s.model.toLowerCase().includes(filter.search.toLowerCase()) || 
      s.brand.toLowerCase().includes(filter.search.toLowerCase());
    return matchesCategory && matchesBrand && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <div className="bg-teal-600 p-2 rounded-xl text-white shadow-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path></svg>
             </div>
             <div>
                <h1 className="text-xl font-black text-slate-900">Onderhoud Centrale</h1>
                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Beveiligd Netwerk</p>
             </div>
          </div>

          <div className="flex items-center gap-3">
            {profile?.role === 'admin' && (
              <button 
                onClick={() => setShowAdmin(true)}
                className="relative bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
              >
                Gebruikersbeheer
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                    {pendingCount}
                  </span>
                )}
              </button>
            )}
            <button onClick={() => supabase.auth.signOut()} className="text-xs font-bold text-rose-600 px-3 py-2 hover:bg-rose-50 rounded-lg transition">Uitloggen</button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full">
        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-teal-600"></div></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSystems.map(system => (
              <div key={system.id} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl transition-all">
                <span className="text-[9px] font-black text-teal-600 uppercase tracking-widest">{system.brand}</span>
                <h3 className="text-lg font-bold text-slate-900 mb-4">{system.model}</h3>
                <div className="space-y-3">
                   <p className="text-xs text-slate-500 italic">"{system.procedure}"</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showAdmin && <AdminModal onClose={() => { setShowAdmin(false); fetchPendingCount(); }} />}
    </div>
  );
};

export default Dashboard;
