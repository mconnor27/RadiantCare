import { useEffect, useState } from 'react'
import { AuthProvider } from './components/auth/AuthProvider'
import { Dashboard } from './components/Dashboard'
import { initializeYearConfig } from './config/yearConfig'
import { initializeHistoricData } from './components/dashboard/shared/defaults'
import { getSetting } from './services/settingsService'

function App() {
  const [yearConfigLoaded, setYearConfigLoaded] = useState(false)

  useEffect(() => {
    // Initialize year configuration and historic data on startup
    const loadConfiguration = async () => {
      try {
        // First initialize year config (needed for historic data)
        await initializeYearConfig(getSetting)
        console.log('✅ Year configuration initialized')

        // Then auto-load any missing historic years from QBO cache
        await initializeHistoricData()
        console.log('✅ Historic data initialized')
      } catch (error) {
        console.error('Failed to initialize configuration:', error)
      } finally {
        setYearConfigLoaded(true)
      }
    }

    loadConfiguration()
  }, [])

  // Show loading state while year config initializes
  if (!yearConfigLoaded) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Loading configuration...
      </div>
    )
  }

  return (
    <AuthProvider>
      <Dashboard />
    </AuthProvider>
  )
}

export default App
