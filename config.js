// Supabase connection. Both values are safe to be public: the database only lets
// the signed-in owner read or write their own row (see supabase.sql).
// Leave them empty to run in local-only mode (data stays in this browser).
export const CONFIG = {
  supabaseUrl: 'https://lutltmwntrejouykeojo.supabase.co',      // e.g. 'https://abcdefgh.supabase.co'
  supabaseAnonKey: 'sb_publishable_OR2zDRdPaekbpbHA2ip9uw_gsJaV5Ol',  // Publishable key (Project Settings → API Keys)
};
