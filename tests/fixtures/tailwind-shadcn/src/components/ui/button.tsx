import { cva } from 'class-variance-authority';

export const buttonVariants = cva('rounded-md text-base', {
  variants: {
    variant: { solid: 'bg-primary text-surface', ghost: 'bg-transparent text-primary' },
    size: { md: 'p-4', sm: 'p-2' },
  },
  defaultVariants: { variant: 'solid', size: 'md' },
});

export function Button(props: { variant?: 'solid' | 'ghost'; size?: 'md' | 'sm' }) {
  return <button className={buttonVariants(props)} />;
}
