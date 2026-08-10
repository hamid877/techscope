'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Search } from 'lucide-react';

type FormValues = {
  name: string;
  registry: 'npm' | 'pypi';
};

export default function SearchForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { name: '', registry: 'npm' },
  });

  function onSubmit(values: FormValues) {
    const params = new URLSearchParams({
      name: values.name.trim(),
      registry: values.registry,
    });
    router.push(`/packages?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-label="Package search"
    >
      {/* Registry selector */}
      <fieldset
        className="flex gap-2 mb-4"
        aria-label="Registry selection"
      >
        <legend className="sr-only">Select registry</legend>
        {(['npm', 'pypi'] as const).map((reg) => (
          <label
            key={reg}
            className="flex items-center gap-2 cursor-pointer select-none"
          >
            <input
              {...register('registry')}
              type="radio"
              value={reg}
              id={`registry-${reg}`}
              className="sr-only peer"
            />
            <span
              className={[
                'px-4 py-2 rounded-full text-sm font-semibold border transition-colors',
                'peer-checked:bg-[var(--accent)] peer-checked:border-[var(--accent)] peer-checked:text-white',
                'border-[var(--border)] text-[var(--text-secondary)]',
                'hover:border-[var(--accent-hover)] hover:text-[var(--text-primary)]',
              ].join(' ')}
            >
              {reg === 'npm' ? 'npm' : 'PyPI'}
            </span>
          </label>
        ))}
      </fieldset>

      {/* Search row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <label htmlFor="package-name" className="sr-only">
            Package name
          </label>
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
            size={18}
            aria-hidden="true"
          />
          <input
            {...register('name', {
              required: 'Package name is required',
              validate: (v) =>
                v.trim().length > 0 || 'Package name cannot be blank',
            })}
            id="package-name"
            type="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="e.g. react, requests, next"
            aria-invalid={errors.name ? 'true' : 'false'}
            aria-describedby={errors.name ? 'name-error' : undefined}
            className={[
              'w-full pl-10 pr-4 py-3 rounded-xl text-sm',
              'bg-[var(--bg-elevated)] border text-[var(--text-primary)]',
              'placeholder:text-[var(--text-muted)]',
              'focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]',
              errors.name
                ? 'border-red-500'
                : 'border-[var(--border)] hover:border-[var(--border-focus)]',
            ].join(' ')}
          />
          {errors.name && (
            <p
              id="name-error"
              role="alert"
              className="mt-1 text-xs text-red-400"
            >
              {errors.name.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          aria-label="Search for package"
          className={[
            'flex items-center justify-center gap-2 px-6 py-3 rounded-xl',
            'bg-[var(--accent)] hover:bg-[var(--accent-hover)]',
            'text-white text-sm font-semibold transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)] focus:ring-offset-2',
            'focus:ring-offset-[var(--bg-base)]',
          ].join(' ')}
        >
          {isSubmitting ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            'Search'
          )}
        </button>
      </div>
    </form>
  );
}
