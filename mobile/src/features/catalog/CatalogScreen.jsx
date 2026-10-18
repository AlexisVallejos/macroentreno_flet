import { useState } from 'react';
import { Chips, Screen } from '../../components';
import { ExerciseList } from './ExerciseList';
import { FoodList } from './FoodList';

/** Pestaña Catálogo (coach y admin): alimentos globales y ejercicios. */
export default function CatalogScreen() {
  const [tab, setTab] = useState('foods');
  return (
    <Screen>
      <Chips
        options={[
          { value: 'foods', label: 'Alimentos' },
          { value: 'exercises', label: 'Ejercicios' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'foods' ? <FoodList initialScope="global" /> : <ExerciseList />}
    </Screen>
  );
}
