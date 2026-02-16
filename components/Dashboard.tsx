import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { MaintenanceSystem, UserProfile } from '../types';
import AdminModal from './AdminModal';

interface Props {
  profile: UserProfile | null;
}

const Dashboard: React.FC<Props> = ({ profile }) => {
  const [systems, setSystems] = useState<MaintenanceSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [eggCount, setEggCount] = useState(0); // Voor de easter egg

  useEffect(() => {
    fetchSystems();
    // Dark mode check
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) setDarkMode(true);
  }, []);

  const fetchSystems = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('systems').select('*').order('brand');
    if (error) console.error(error);
    else setSystems(data || []);
    setLoading(false);
  };

  // Easter Egg functie: Klik 5x op het logo
  const triggerEasterEgg = () => {
    setEggCount(prev => prev + 1);
    if (eggCount >= 4) {
      alert("🚀 Onderhoud Centrale Turbo Modus Geactiveerd!");
      setEggCount(0);
    }
  };

  return (
    <div className={`${darkMode ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'} min-h-screen transition-colors duration-300`}>
      <header className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border-b sticky top-0 z-10`}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 onClick={triggerEasterEgg} className="text-xl font-black tracking-tighter cursor-pointer select-none">
              DOC <span className="text-teal-500">.</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
              {darkMode ? '🌙' : '☀️'}
            </button>
            {profile?.role === 'admin' && (
              <button onClick={() => setShowAdmin(true)} className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold text-sm">Admin</button>
            )}
            <button onClick={() => supabase.auth.signOut()} className="text-sm font-medium text-rose-500">Uitloggen</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center items-center h-64"><div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full"></div></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {systems.map((system) => (
              <div key={system.id} className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} rounded-3xl p-6 shadow-sm border hover:shadow-xl transition-all group`}>
                {system.device_image_url && (
                  <img 
                    src={system.device_image_url} 
                    onClick={() => setSelectedImage(system.device_image_url!)}
                    className="w-full h-48 object-contain mb-4 rounded-xl cursor-zoom-in group-hover:scale-105 transition-transform"
                    alt={system.model}
                  />
                )}
                <div className="mb-2 uppercase text-[10px] font-bold tracking-widest text-teal-500">{system.brand}</div>
                <h3 className="text-xl font-bold mb-4">{system.model}</h3>
                
                <div className="space-y-4 text-sm opacity-90">
                  <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg italic">
                    {system.procedure}
                  </div>
                  
                  {system.manual_url && (
                    <a href={system.manual_url} target="_blank" className="block text-center py-2 border-2 border-teal-500 text-teal-500 rounded-xl font-bold hover:bg-teal-500 hover:text-white transition">
                      Bekijk Handleiding
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Lightbox voor foto's */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
          <img src={selectedImage} className="max-w-full max-h-full rounded-lg shadow-2xl" />
          <button className="absolute top-4 right-4 text-white text-4xl">&times;</button>
        </div>
      )}

      {showAdmin && <AdminModal onClose={() => setShowAdmin(false)} />}
    </div>
  );
};

export default Dashboard;
