import { AuthProvider } from './components/auth/AuthProvider'
import { Dashboard } from './components/Dashboard'

function App() {
  return (
    <AuthProvider>
      <Dashboard />
    </AuthProvider>
  )
}

export default App
