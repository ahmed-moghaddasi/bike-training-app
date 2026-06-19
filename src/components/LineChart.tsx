import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../theme';
import { formatLap } from '../lib/metrics';

type Props = {
  values: number[];
  height?: number;
  emptyLabel?: string;
};

const WIDTH = 320;
const PAD_X = 26;
const PAD_TOP = 18;
const PAD_BOTTOM = 30;

export function LineChart({ values, height = 112, emptyLabel = 'Not enough sessions for a trend yet.' }: Props) {
  if (values.length < 2) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    );
  }

  const chartHeight = height;
  const innerWidth = WIDTH - PAD_X * 2;
  const innerHeight = chartHeight - PAD_TOP - PAD_BOTTOM;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 0.1);
  const bestIndex = values.indexOf(min);
  const latest = values[values.length - 1];

  const points = values.map((value, index) => {
    const x = PAD_X + (index / (values.length - 1)) * innerWidth;
    const normalized = (value - min) / range;
    const y = PAD_TOP + normalized * innerHeight;
    return { x, y, value, index };
  });

  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight - PAD_BOTTOM} L ${points[0].x} ${chartHeight - PAD_BOTTOM} Z`;

  return (
    <View style={[styles.wrap, { height: chartHeight }]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${WIDTH} ${chartHeight}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.red} stopOpacity="0.2" />
            <Stop offset="1" stopColor={colors.red} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>
        <Rect x="0.5" y="0.5" width={WIDTH - 1} height={chartHeight - 1} rx="8" fill={colors.silver} stroke={colors.silverMid} />
        {[0, 0.5, 1].map((ratio) => {
          const y = PAD_TOP + ratio * innerHeight;
          return <Line key={ratio} x1={PAD_X} y1={y} x2={WIDTH - PAD_X} y2={y} stroke={colors.white} strokeWidth="1.5" />;
        })}
        {points.map((point) => (
          <Line key={`tick-${point.index}`} x1={point.x} y1={PAD_TOP} x2={point.x} y2={chartHeight - PAD_BOTTOM} stroke={colors.white} strokeWidth="0.8" opacity="0.7" />
        ))}
        <Path d={areaPath} fill="url(#chartFill)" />
        <Path d={linePath} fill="none" stroke={colors.red} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <G>
          {points.map((point) => (
            <G key={`${point.index}-${point.value}`}>
              <Circle
                cx={point.x}
                cy={point.y}
                r={point.index === bestIndex ? 7 : 5}
                fill={point.index === bestIndex ? colors.red : colors.charcoal}
                stroke={colors.white}
                strokeWidth="2"
              />
              {point.index === bestIndex && (
                <SvgText x={point.x} y={Math.max(12, point.y - 12)} fill={colors.red} fontSize="9" fontWeight="800" textAnchor="middle">
                  BEST
                </SvgText>
              )}
            </G>
          ))}
        </G>
        <SvgText x={PAD_X} y={chartHeight - 10} fill={colors.silverDark} fontSize="10" fontWeight="800">
          BEST {formatLap(min)}s
        </SvgText>
        <SvgText x={WIDTH - PAD_X} y={chartHeight - 10} fill={colors.silverDark} fontSize="10" fontWeight="800" textAnchor="end">
          LATEST {formatLap(latest)}s
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.silver,
    borderRadius: 8,
    overflow: 'hidden',
  },
  empty: {
    alignItems: 'center',
    backgroundColor: colors.silver,
    borderColor: colors.silverMid,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    padding: 18,
  },
  emptyText: {
    color: colors.silverDark,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
