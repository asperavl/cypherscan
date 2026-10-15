import { describe, it, expect } from 'vitest';
import { cn } from '../utils';

describe('cn utility', () => {
  it('combines multiple class names', () => {
    expect(cn('btn', 'btn-primary')).toBe('btn btn-primary');
  });

  it('handles falsy and conditional classes', () => {
    const isHidden = false;
    const isPrimary = true;
    expect(cn('base', isHidden && 'hidden', isPrimary && 'primary')).toBe('base primary');
  });

  it('resolves conflicting Tailwind utility classes properly', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('handles array and object inputs from clsx', () => {
    expect(cn(['class1', 'class2'])).toBe('class1 class2');
    expect(cn({ active: true, disabled: false })).toBe('active');
  });
});
