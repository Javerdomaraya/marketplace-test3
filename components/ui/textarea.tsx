import * as React from 'react';
import { cn } from '../../lib/utils';

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea className={cn('min-h-32 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#1877F2] focus:ring-4 focus:ring-blue-100 disabled:opacity-60', className)} {...props} />;
}
