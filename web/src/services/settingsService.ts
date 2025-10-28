import { supabase } from '../lib/supabase'

export interface AppSetting {
  key: string
  value: any
  description?: string
  updated_at: string
  updated_by?: string
}

/**
 * Get a specific app setting from the database
 */
export async function getAppSetting(key: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .single()

    if (error) {
      console.error(`Error fetching app setting '${key}':`, error)
      return null
    }

    return data?.value
  } catch (error) {
    console.error(`Error fetching app setting '${key}':`, error)
    return null
  }
}

/**
 * Get all app settings from the database
 */
export async function getAllAppSettings(): Promise<Record<string, any>> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')

    if (error) {
      console.error('Error fetching app settings:', error)
      return {}
    }

    // Convert array to object for easier access
    return data?.reduce((acc, setting) => {
      acc[setting.key] = setting.value
      return acc
    }, {} as Record<string, any>) || {}
  } catch (error) {
    console.error('Error fetching app settings:', error)
    return {}
  }
}

/**
 * Update an app setting in the database (admin only)
 */
export async function updateAppSetting(key: string, value: any): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('app_settings')
      .update({ value })
      .eq('key', key)

    if (error) {
      console.error(`Error updating app setting '${key}':`, error)
      return false
    }

    return true
  } catch (error) {
    console.error(`Error updating app setting '${key}':`, error)
    return false
  }
}

/**
 * Subscribe to changes in app settings
 */
export function subscribeToAppSettings(
  callback: (settings: Record<string, any>) => void
) {
  const channel = supabase
    .channel('app_settings_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'app_settings'
      },
      async () => {
        // Refetch all settings when any change occurs
        const settings = await getAllAppSettings()
        callback(settings)
      }
    )
    .subscribe()

  return () => {
    channel.unsubscribe()
  }
}
