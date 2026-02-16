
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { UserProfile } from '../types';

interface Props {
  onClose: () => void;
}

const AdminModal: React.FC<Props> = ({ onClose }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .order('is_approved', { ascending: true }) 
      .order('created_at', { ascending: false });
    
    if (error) console.error("Fout bij ophalen gebruikers:", error);
    else setUsers(data || []);
    setLoading(false);
  };

  const updateApproval = async (userId: string, isApproved: boolean) => {
    const { error } = await supabase
      .from('user_roles')
      .update({ is_approved: isApproved })
      .eq('user_id', userId);

    if (error) {
      alert("Fout bij bijwerken: " + error.message);
    } else {
      fetchUsers();
    }
  };

  const updateRole = async (userId: string, role: string) => {
    const { error } = await supabase
      .from('user_roles')
      .update({ role })
      .eq('user_id', userId);

    if (error) alert(error.message);
    else fetchUsers();
  };

  const pendingUsers = users.filter(u => !u.is_approved);
  const activeUsers = users.filter(u => u.is_approved);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md transition-all">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-white/20 animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
           <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3 uppercase">
                Toegangsbeheer
                {pendingUsers.length > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] px-3 py-1 rounded-full font-black animate-pulse">
                    {pendingUsers.length} WACHTEND
                  </span>
                )}
              </h2>
              <p className="text-sm text-slate-500 font-medium mt-1">Beheer wie toegang heeft tot de interne documentatie.</p>
           </div>
           <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-2xl transition-all text-slate-400 hover:rotate-90">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
           </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8 space-y-8">
           {loading ? (
             <div className="flex flex-col items-center justify-center py-20 gap-4">
               <div className="w-10 h-10 border-4 border-slate-100 border-t-teal-600 rounded-full animate-spin"></div>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Lijst laden...</p>
             </div>
           ) : users.length === 0 ? (
             <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Geen gebruikers gevonden in de database</p>
             </div>
           ) : (
             <div className="space-y-10">
                {/* Wachtlijst */}
                {pendingUsers.length > 0 && (
                  <section>
                    <h3 className="text-xs font-black text-rose-500 uppercase tracking-[0.2em] mb-4 ml-1">Nieuwe Aanvragen</h3>
                    <div className="bg-rose-50/30 border border-rose-100 rounded-3xl overflow-hidden">
                       <table className="w-full text-left">
                         <tbody className="divide-y divide-rose-100">
                           {pendingUsers.map(user => (
                             <tr key={user.user_id} className="hover:bg-rose-50/50 transition-colors">
                               <td className="px-6 py-5">
                                 <div className="font-black text-slate-900">{user.email}</div>
                                 <div className="text-[10px] text-slate-400 font-mono mt-0.5">{user.user_id}</div>
                               </td>
                               <td className="px-6 py-5 text-right">
                                 <button 
                                   onClick={() => updateApproval(user.user_id, true)}
                                   className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-xl text-xs font-black transition-all shadow-lg shadow-teal-600/20 active:scale-95"
                                 >
                                   GOEDKEUREN
                                 </button>
                               </td>
                             </tr>
                           ))}
                         </tbody>
                       </table>
                    </div>
                  </section>
                )}

                {/* Actieve Gebruikers */}
                <section>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-1">Geautoriseerde Medewerkers</h3>
                  <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <tr>
                          <th className="px-6 py-4">Medewerker</th>
                          <th className="px-6 py-4">Rol</th>
                          <th className="px-6 py-4 text-right">Actie</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {activeUsers.map(user => (
                          <tr key={user.user_id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-emerald-100 text-emerald-700 flex items-center justify-center rounded-lg text-xs font-black">
                                  {user.email.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-bold text-slate-700">{user.email}</span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                               <select 
                                 className="bg-slate-100 border-none rounded-lg text-xs font-black text-slate-600 focus:ring-2 focus:ring-teal-500/20 py-1.5 px-3 cursor-pointer"
                                 value={user.role}
                                 onChange={(e) => updateRole(user.user_id, e.target.value)}
                               >
                                 <option value="user">Gebruiker</option>
                                 <option value="moderator">Moderator</option>
                                 <option value="admin">Admin</option>
                               </select>
                            </td>
                            <td className="px-6 py-5 text-right">
                               <button 
                                 onClick={() => updateApproval(user.user_id, false)}
                                 className="text-slate-400 hover:text-rose-600 text-[10px] font-black uppercase tracking-widest transition-colors py-2 px-4 rounded-xl hover:bg-rose-50"
                               >
                                 Blokkeren
                               </button>
                            </td>
                          </tr>
                        ))}
                        {activeUsers.length === 0 && (
                          <tr><td colSpan={3} className="px-6 py-10 text-center text-slate-300 italic text-sm">Geen actieve gebruikers.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
             </div>
           )}
        </div>

        {/* Footer */}
        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
             <svg className="w-4 h-4 text-teal-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zM10 5a1 1 0 011 1v3h3a1 1 0 110 2h-4a1 1 0 01-1-1V6a1 1 0 011-1z" clipRule="evenodd"></path></svg>
             Encryptie Actief
           </p>
           <button onClick={onClose} className="bg-slate-900 text-white px-10 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-95">
              Sluiten
           </button>
        </div>
      </div>
    </div>
  );
};

export default AdminModal;
