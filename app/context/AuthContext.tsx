import { createContext, FC, PropsWithChildren, useCallback, useContext, useMemo } from "react"
import { useMMKVString } from "react-native-mmkv"

export type AuthContextType = {
  isAuthenticated: boolean
  authToken?: string
  authPhone?: string 
  setAuthToken: (token?: string) => void
  setAuthPhone: (phone: string) => void
  logout: () => void
  validationError: string
}

export const AuthContext = createContext<AuthContextType | null>(null)

export const AuthProvider: FC<PropsWithChildren<{}>> = ({ children }) => {
  const [authToken, setAuthToken] = useMMKVString("AuthProvider.authToken")
  const [authPhone, setAuthPhone] = useMMKVString("AuthProvider.authPhone")

  const logout = useCallback(() => {
    setAuthToken(undefined)
    setAuthPhone("")
  }, [setAuthPhone, setAuthToken])

  const validationError = useMemo(() => {
    const value = authPhone || ""
    if (value.length === 0) return "Phone number is required"
    if (value.length < 10) return "Number is too short"
    return ""
  }, [authPhone])

  const value = {
    isAuthenticated: !!authToken,
    authToken,
    authPhone,
    setAuthPhone,
    setAuthToken,
    logout,
    validationError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within an AuthProvider")
  return context
}