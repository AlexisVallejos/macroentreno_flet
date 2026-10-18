import { useRouter } from 'expo-router';
import { useState } from 'react';
import { diaryApi } from '../../api/endpoints';
import { DateSwitcher, ErrorState, Loading, Screen } from '../../components';
import { useResource } from '../../hooks/useResource';
import { confirm, notify } from '../../utils/confirm';
import { today } from '../../utils/dates';
import { DiaryDay } from './DiaryDay';

export default function DiaryScreen() {
  const router = useRouter();
  const [date, setDate] = useState(today());
  const { data: day, error, loading, refreshing, reload, setData } = useResource(() => diaryApi.day(date), [date]);

  const handleDelete = async (entry) => {
    if (!(await confirm('Eliminar registro', `¿Eliminar "${entry.name}" del diario?`))) return;
    try {
      await diaryApi.remove(entry.id);
      reload();
    } catch (err) {
      notify('No se pudo eliminar', err.message);
    }
  };

  const changeDate = (next) => {
    setData(null);
    setDate(next);
  };

  return (
    <Screen onRefresh={reload} refreshing={refreshing}>
      <DateSwitcher date={date} onChange={changeDate} />
      {error && !day ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !day ? (
        <Loading />
      ) : (
        <DiaryDay
          day={day}
          onAdd={(meal) => router.push({ pathname: '/diary-entry', params: { date, meal } })}
          onEdit={(entry) => router.push({ pathname: '/diary-entry', params: { date, id: String(entry.id) } })}
          onDelete={handleDelete}
        />
      )}
    </Screen>
  );
}
