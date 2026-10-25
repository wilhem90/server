import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const clientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

const supabase = createClient(supabaseUrl, supabaseKey, clientOptions);

// signInWithPassword stores the user's session in the client, which would replace
// the secret key on later requests. Use a throwaway client for every login.
export const createAuthClient = () =>
  createClient(supabaseUrl, supabaseKey, clientOptions);

export default supabase;
