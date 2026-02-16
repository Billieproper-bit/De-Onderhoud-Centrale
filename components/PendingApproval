
import React from 'react';
import { supabase } from '../supabaseClient';

interface Props {
  email: string;
  onRefresh: () => void;
}

const PendingApproval: React.FC<Props> = ({ email, onRefresh }) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center border border-slate-200">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m0 0v2m0-2h2m-2 0H10m4-6a2 2 0 100-4 2 2 0 000 4zm0 10a7 7 0 110-14 7 7 0 010 14z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Toegang in afwachting</h1>
        <p className="text-slate-600 mb-6">
          Hoi <strong>{email}</strong>,<br />
          Je account is succesvol aangemaakt, maar moet nog handmatig worden goedgekeurd door een beheerder. 
        </p>
        <div className="flex flex-col gap-3">
          <button 
            onClick={onRefresh}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-lg transition"
          >
            Check status opnieuw
          </button>
          <button 
            onClick={() => supabase.auth.signOut()}
            className="w-full border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-3 rounded-lg transition"
          >
            Uitloggen
          </button>
        </div>
        <p className="mt-6 text-sm text-slate-400">
          Zodra je bent goedgekeurd krijg je direct toegang tot alle afstelinstructies.
        </p>
      </div>
    </div>
  );
};

export default PendingApproval;
