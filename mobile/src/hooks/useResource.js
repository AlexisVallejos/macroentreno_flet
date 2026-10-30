import { useFocusEffect } from 'expo-router';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * Carga datos de la API cada vez que la pantalla gana foco (así se ven los cambios
 * hechos en otra pantalla) o cambian `deps`.
 * Devuelve { data, error, loading, refreshing, reload, setData }.
 */
export function useResource(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);
  const fetcherRef = useRef(fetcher);
  const depsKey = JSON.stringify(deps);

  // Siempre se usa la última versión del fetcher (con los valores actuales de la pantalla).
  useLayoutEffect(() => {
    fetcherRef.current = fetcher;
  });

  const load = useCallback(async ({ pull = false } = {}) => {
    const id = ++requestId.current; // descarta respuestas viejas si el usuario cambió de filtro
    if (pull) setRefreshing(true);
    try {
      const result = await fetcherRef.current();
      if (id === requestId.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (id === requestId.current) setError(err);
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load, depsKey]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const reload = useCallback(() => load({ pull: true }), [load]);
  return { data, error, loading, refreshing, reload, setData };
}
