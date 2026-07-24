import { type ReactNode, useCallback, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
}

/**
 * Promise-based confirmation dialog — a drop-in replacement for the native
 * `confirm()`, but rendered with the app's shadcn Dialog so it's accessible,
 * themeable, and testable (native dialogs block the event loop and can't be
 * driven by Playwright).
 *
 * Usage:
 * ```tsx
 * const { confirm, dialog } = useConfirm();
 * // ...
 * if (await confirm({ title: "Delete file?", variant: "destructive" })) {
 *   await doDelete();
 * }
 * // render `{dialog}` once anywhere in the component's tree
 * ```
 */
export function useConfirm(): {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((result: boolean) => {
    setOpen(false);
    resolver.current?.(result);
    resolver.current = null;
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    setOpts(options);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const dialog = (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Closing via overlay/esc counts as cancel.
        if (!next) settle(false);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{opts?.title}</DialogTitle>
          {opts?.description ? <DialogDescription>{opts.description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => settle(false)}>
            {opts?.cancelLabel ?? "Cancel"}
          </Button>
          <Button variant={opts?.variant ?? "default"} onClick={() => settle(true)}>
            {opts?.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirm, dialog };
}
