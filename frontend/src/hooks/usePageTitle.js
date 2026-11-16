import { useEffect } from 'react'

/**
 * Hook to manage page document titles across all routes.
 *
 * @param {string} [title] - Specific page name
 */
export function usePageTitle(title) {
  useEffect(() => {
    const base = 'ProctorNet'
    if (title) {
      document.title = `${title} — ${base}`
    } else {
      document.title = `${base} — Online Examination & Proctoring Platform`
    }
  }, [title])
}

export default usePageTitle
