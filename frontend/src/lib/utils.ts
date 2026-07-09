import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isChatchawanUser = (user: any): boolean => {
  if (!user) return false;
  const email = (user.email || '').toLowerCase();
  const nickname = (user.nickname || '').toLowerCase();
  const name = (user.name || '').toLowerCase();
  return email.includes('chatchawan') || nickname.includes('chatchawan') || name.includes('chatchawan');
};
