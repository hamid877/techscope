import LoadingSpinner from '@/components/ui/LoadingSpinner';

/**
 * Next.js App Router `loading.tsx` convention.
 * Wraps the packages page in a Suspense boundary so the loading spinner
 * shows immediately while the async Server Component fetches the score.
 * Satisfies the "UI shows a loading state throughout" Performance NFR.
 */
export default function PackagesLoading() {
  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <LoadingSpinner />
    </main>
  );
}
