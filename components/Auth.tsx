
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const Auth: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isRegistering) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        if (data.user) {
          // Bij registratie maken we direct een profiel aan met is_approved op false
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert([{ 
                user_id: data.user.id, 
                email: data.user.email, 
                role: 'user', 
                is_approved: false 
            }]);
          
          if (roleError) console.error("Kon rol niet opslaan:", roleError);
        }
        alert('Registratie gelukt! Je aanvraag is ingediend bij de beheerder.');
        setIsRegistering(false); // Ga terug naar login na registratie
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      alert("Fout: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-teal-600"></div>
        
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-teal-50 rounded-xl flex items-center justify-center mx-auto mb-4 border border-teal-100">
             <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m0 0v2m0-2h2m-2 0H10m4-6a2 2 0 100-4 2 2 0 000 4zm0 10a7 7 0 110-14 7 7 0 010 14z" /></svg>
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Onderhoud Centrale</h1>
          <p className="text-slate-400 mt-2 font-medium text-sm">
            {isRegistering ? 'Maak een nieuw account' : 'Toegang voor medewerkers'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">E-mailadres</label>
            <input 
              type="email" 
              required 
              className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all text-sm"
              placeholder="naam@organisatie.nl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Wachtwoord</label>
            <input 
              type="password" 
              required 
              className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-all text-sm"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3.5 px-6 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 mt-2"
          >
            {loading ? 'Bezig...' : (isRegistering ? 'Account aanvragen' : 'Inloggen')}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-50 text-center">
          <button 
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-teal-600 hover:text-teal-800 font-bold text-xs uppercase tracking-wider transition"
          >
            {isRegistering ? 'Heb je al een account? Log in' : 'Nieuw hier? Registreer je account'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
