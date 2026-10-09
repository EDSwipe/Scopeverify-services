import PublicHome from './components/PublicHome'

interface AppProps {
  onPartnerSignup?: () => void
  onLogin?: () => void
}

export default function App({ onPartnerSignup, onLogin }: AppProps) {
  return <PublicHome onPartnerSignup={onPartnerSignup ?? (() => {})} onLogin={onLogin ?? (() => {})} />
}
