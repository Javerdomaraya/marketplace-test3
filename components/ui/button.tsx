'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:pointer-events-none disabled:opacity-50',
  { variants: {
    variant: {
      default: 'bg-[#1877F2] text-white hover:bg-[#1163ce] shadow-sm',
      secondary: 'bg-blue-50 text-[#1877F2] hover:bg-blue-100',
      outline: 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50',
      ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    },
    size: { default: 'h-11 px-5', sm: 'h-9 px-3', lg: 'h-12 px-6' },
  }, defaultVariants: { variant: 'default', size: 'default' } },
);

type ButtonProps = React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  return <Component data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { Button, buttonVariants };
