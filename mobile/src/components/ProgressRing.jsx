import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const DURATION = 700;
const easeOutCubic = (t) => 1 - (1 - t) ** 3;

/**
 * Lleva un número hacia `target` con una curva ease-out, partiendo del valor que se ve en pantalla
 * (si cambia a mitad de camino, sigue desde ahí sin saltos). Sin animación si se redujo el movimiento.
 * Se hace con requestAnimationFrame porque Animated + react-native-svg ensucia el DOM en web.
 */
function useEased(target) {
  const [value, setValue] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    let frame;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        const from = current.current;
        if (reduce || from === target) {
          current.current = target;
          setValue(target);
          return;
        }
        const start = Date.now();
        const step = () => {
          const t = Math.min((Date.now() - start) / DURATION, 1);
          current.current = from + (target - from) * easeOutCubic(t);
          setValue(current.current);
          if (t < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [target]);

  return value;
}

/**
 * Anillo de progreso al estilo de los anillos de Actividad de Apple:
 * la pista es el mismo color atenuado y el trazo tiene puntas redondeadas.
 */
export function ProgressRing({ size = 160, stroke = 16, progress = 0, color, children, accessibilityLabel }) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const shown = useEased(Math.max(0, Math.min(progress, 1)));

  return (
    <View style={{ width: size, height: size }} accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeOpacity={0.22} strokeWidth={stroke} fill="none" />
        {shown > 0.001 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - shown)}
            fill="none"
          />
        ) : null}
      </Svg>
      {children ? <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
