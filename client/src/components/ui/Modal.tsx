import { ReactNode } from "react"
import { Dialog, DialogContent } from "./dialog"
import { Drawer, DrawerContent } from "./drawer"
import { Sheet, SheetContent } from "./sheet"

export interface ModalProps {
  type: 'dialog' | 'drawer' | 'sheet'
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  position?: 'left' | 'right' | 'top' | 'bottom' // For drawer and sheet
  className?: string
}

export function Modal({
  type,
  isOpen,
  onClose,
  children,
  position = 'right',
  className = ''
}: ModalProps) {
  switch (type) {
    case 'dialog':
      return (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className={className}>
            {children}
          </DialogContent>
        </Dialog>
      )
    case 'drawer':
      return (
        <Drawer open={isOpen} onOpenChange={onClose} direction={position as 'left' | 'right'}>
          <DrawerContent className={className}>
            {children}
          </DrawerContent>
        </Drawer>
      )
    case 'sheet':
      return (
        <Sheet open={isOpen} onOpenChange={onClose}>
          <SheetContent side={position} className={className}>
            {children}
          </SheetContent>
        </Sheet>
      )
    default:
      return null
  }
}
