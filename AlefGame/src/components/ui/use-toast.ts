// Mock de useToast: expone una API compatible mínima.
type ToastOptions = {
  title?: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
}

export function useToast() {
  function toast(opts: ToastOptions) {
    // Por ahora, log al console; luego podremos integrar shadcn/sonner.
    const { title, description, variant } = opts || {}
    const prefix = variant ? `[${variant.toUpperCase()}]` : ''
    console.log('toast:', prefix, title || '', description || '')
  }
  return { toast }
}
export default useToast

