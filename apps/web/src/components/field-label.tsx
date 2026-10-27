import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/** Small uppercase mono label used across the tool. */
export function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return <Label className={cn('font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase', className)} {...props} />
}
