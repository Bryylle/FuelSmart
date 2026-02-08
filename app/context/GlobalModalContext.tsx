import React, { createContext, useCallback, useContext, useMemo, useState } from "react"
import { Modal, View, Pressable, StyleSheet } from "react-native"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { useAppTheme } from "@/theme/context"

type ModalType = "info" | "success" | "error"

type ModalAction = {
  text: string
  onPress?: () => void
  variant?: "default" | "primary" | "danger"
}

type ModalOptions = {
  type?: ModalType
  title?: string
  message?: string
  actions?: ModalAction[]
  autoCloseMs?: number
}

type GlobalModalContextValue = {
  show: (options: ModalOptions) => void
  hide: () => void
  showError: (title: string, message: string, actions?: ModalAction[]) => void
  showSuccess: (title: string, message: string, actions?: ModalAction[]) => void
}

const GlobalModalContext = createContext<GlobalModalContextValue | undefined>(undefined)

export const GlobalModalProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { theme, themed } = useAppTheme()
  const [visible, setVisible] = useState(false)
  const [options, setOptions] = useState<ModalOptions | null>(null)

  const hide = useCallback(() => {
    setVisible(false)
    setTimeout(() => setOptions(null), 200)
  }, [])

  const show = useCallback(
    (opts: ModalOptions) => {
      setOptions(opts)
      setVisible(true)
      if (opts.autoCloseMs && opts.autoCloseMs > 0) {
        setTimeout(() => hide(), opts.autoCloseMs)
      }
    },
    [hide],
  )

  const showError = useCallback(
    (title: string, message: string, actions?: ModalAction[]) => {
      show({ type: "error", title, message, actions })
    },
    [show],
  )

  const showSuccess = useCallback(
    (title: string, message: string, actions?: ModalAction[]) => {
      show({ type: "success", title, message, actions })
    },
    [show],
  )

  const value = useMemo<GlobalModalContextValue>(
    () => ({ show, hide, showError, showSuccess }),
    [show, hide, showError, showSuccess],
  )

  const type = options?.type ?? "info"
  const title = options?.title ?? (type === "error" ? "Something went wrong" : "Notice")
  const message = options?.message ?? ""
  const actions = options?.actions ?? [{ text: "OK" }]

  const borderColorByType =
    type === "error"
      ? theme.colors.error
      : type === "success"
      ? theme.colors.tint
      : theme.colors.border

  return (
    <GlobalModalContext.Provider value={value}>
      {children}

      <Modal visible={visible} transparent animationType="fade" onRequestClose={hide}>
        {/* Backdrop */}
        <Pressable style={styles.backdrop} onPress={hide} />

        {/* Centered card */}
        <View style={styles.center}>
          <View
            style={[
              styles.card,
              { backgroundColor: theme.colors.background, borderColor: borderColorByType },
            ]}
          >
            {!!title && <Text preset="subheading" style={{ marginBottom: 8 }} text={title} />}
            {!!message && <Text style={{ marginBottom: 16 }} text={message} />}

            <View style={styles.actionsRow}>
              {actions.map((a, idx) => {
                const onPress = () => {
                  a.onPress?.()
                  hide()
                }
                const style =
                  a.variant === "danger"
                    ? themed(styles.btnDanger)
                    : a.variant === "primary"
                    ? themed(styles.btnPrimary)
                    : themed(styles.btnDefault)

                return (
                  <Button key={`${a.text}-${idx}`} style={style} onPress={onPress}>
                    {a.text}
                  </Button>
                )
              })}
            </View>
          </View>
        </View>
      </Modal>
    </GlobalModalContext.Provider>
  )
}

export const useGlobalModal = () => {
  const ctx = useContext(GlobalModalContext)
  if (!ctx) throw new Error("useGlobalModal must be used within GlobalModalProvider")
  return ctx
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  center: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  card: { borderRadius: 12, borderWidth: 1, padding: 16 },
  actionsRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  btnDefault: { minWidth: 90 },
  btnPrimary: { minWidth: 90 },
  btnDanger: { minWidth: 90 },
})