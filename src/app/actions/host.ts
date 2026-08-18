'use server';

import { getHostAuth } from '@/lib/supabase/hostAuth';
import { isLocale, type Locale } from '@/lib/i18n/locale';

export async function setHostLocale(locale: Locale) {
  if (!isLocale(locale)) {
    throw new Error('Invalid locale.');
  }
  try {
    const { supabase, user } = await getHostAuth();
    const { error } = await supabase.from('hosts').update({ ui_locale: locale }).eq('id', user.id);
    if (error) throw error;
    return { success: true, locale };
  } catch (err: unknown) {
    console.error('setHostLocale error:', err);
    return { success: false, locale };
  }
}
