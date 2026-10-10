import { useEffect, useState, useCallback } from 'react';
import api, { errorMessage } from '../api/axios';

// GETs `path` and re-fetches whenever it (or refreshKey) changes. Pass a null
// path to skip. Loading is derived from whether the latest response matches
// the current request, so stale data stays on screen during a refetch.
export function useFetch(path, refreshKey = '') {
  const [nonce, setNonce] = useState(0);
  const key = path ? `${path}#${refreshKey}#${nonce}` : null;
  const [state, setState] = useState({ key: null, data: null, error: '' });

  useEffect(() => {
    if (!key) return;
    let ignore = false;
    api
      .get(path)
      .then((res) => !ignore && setState({ key, data: res.data, error: '' }))
      .catch((err) => !ignore && setState({ key, data: null, error: errorMessage(err) }));
    return () => {
      ignore = true;
    };
  }, [key, path]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return {
    data: state.data,
    error: state.key === key ? state.error : '',
    loading: Boolean(key) && state.key !== key,
    reload,
  };
}
