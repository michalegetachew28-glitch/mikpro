import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ngimgjttpvoimxoubkpw.supabase.co';
// WARNING: Replace with actual Anon Key if provided by user
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY_HERE'; 

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const uploadAttachment = async (file, pathPrefix = 'chat') => {
  try {
    const fileName = `${Date.now()}_${file.name || 'blob'}`;
    const filePath = `${pathPrefix}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('file_attachment')
      .upload(filePath, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('file_attachment')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (err) {
    console.error('[Supabase Storage Error]', err);
    throw err;
  }
};

export default supabase;
