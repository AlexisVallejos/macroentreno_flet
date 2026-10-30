import { Screen } from '../../components';
import { FoodList } from './FoodList';

/** "Mis alimentos" del atleta (se abre desde Perfil). */
export default function FoodsScreen() {
  return (
    <Screen>
      <FoodList initialScope="mine" />
    </Screen>
  );
}
