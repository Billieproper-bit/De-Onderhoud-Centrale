import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { UserProfile } from './types';
import Auth from './components/Auth.tsx';
import Dashboard from './components/Dashboard.tsx';
import PendingApproval from './components/PendingApproval.tsx';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) console.error("Error fetching profile:", error);
      
      if (!data && session) {
        const { data: newProfile, error: insertError } = await supabase
          .from('user_roles')
          .insert([{ user_id: userId, email: session.user.email, is_approved: false }])
          .select()
          .single();
          
        if (!insertError) setProfile(newProfile);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  if (!profile || !profile.is_approved) {
    return <PendingApproval email={session.user.email} onRefresh={() => fetchProfile(session.user.id)} />;
  }

  return <Dashboard profile={profile} />;
};

export default App;