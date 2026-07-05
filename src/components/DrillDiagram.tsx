import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../theme';
import type { DiagramKey } from '../types';

type Props = {
  type: DiagramKey;
  compact?: boolean;
  variant?: 'card' | 'detail';
};

const W = 320;
const H = 160;
const coneOrange = '#FF7A00';
const detailViewBoxes: Record<DiagramKey, string> = {
  circle: '92 54 444 390',
  'figure-eight': '36 72 528 284',
  'straight-line': '0 0 320 160',
  loop: '120 40 400 340',
};
const detailAspectRatios: Record<DiagramKey, number> = {
  circle: 444 / 390,
  'figure-eight': 528 / 284,
  'straight-line': 320 / 160,
  loop: 400 / 340,
};

export function DrillDiagram({ type, compact, variant = 'card' }: Props) {
  const isDetail = variant === 'detail';
  const viewBox = isDetail ? detailViewBoxes[type] : `0 0 ${W} ${H}`;
  const { width: windowWidth } = useWindowDimensions();
  const detailWidth = Math.max(320, windowWidth - 4);
  const detailHeight = detailWidth / detailAspectRatios[type];
  return (
    <View style={[styles.frame, compact && styles.compact, isDetail && styles.detail, isDetail && { height: detailHeight }]}>
      <Svg width="100%" height="100%" viewBox={viewBox}>
        {!isDetail && type === 'circle' && <CircleDiagram />}
        {!isDetail && type === 'loop' && <LoopDiagram />}
        {!isDetail && type === 'figure-eight' && <FigureEightDiagram />}
        {(type === 'straight-line') && <StraightLineDiagram />}
        {isDetail && type === 'circle' && <CircleDetailDiagram />}
        {isDetail && type === 'loop' && <LoopDetailDiagram />}
        {isDetail && type === 'figure-eight' && <FigureEightDetailDiagram />}
      </Svg>
    </View>
  );
}

function Cone({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <Circle cx={x} cy={y} r="5.625" fill={coneOrange} />
      <Circle cx={x} cy={y} r="2.2" fill={colors.silver} />
    </G>
  );
}

function RiderPath({ d }: { d: string }) {
  return (
    <Path
      d={d}
      fill="none"
      stroke={colors.charcoal}
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="2 12"
    />
  );
}

function TrackSurface({ d }: { d: string }) {
  return (
    <Path d={d} fill={colors.silverMid} fillOpacity="0.48" stroke={colors.charcoal} strokeOpacity="0.2" strokeWidth="1.5" />
  );
}

function Arrow({ x, y, rotation }: { x: number; y: number; rotation: number }) {
  return (
    <Polygon points="-5,-4 6,0 -5,4" fill={colors.charcoal} transform={`translate(${x} ${y}) rotate(${rotation})`} />
  );
}

function CircleDiagram() {
  return (
    <G>
      <Circle
        cx="160"
        cy="80"
        r="56"
        fill="none"
        stroke={colors.charcoal}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="2 12"
      />
      <Cone x={160} y={33} />
      <Cone x={193} y={47} />
      <Cone x={207} y={80} />
      <Cone x={193} y={113} />
      <Cone x={160} y={127} />
      <Cone x={127} y={113} />
      <Cone x={113} y={80} />
      <Cone x={127} y={47} />
      <Arrow x={120} y={40} rotation={-45} />
      <Arrow x={200} y={40} rotation={45} />
      <Arrow x={200} y={120} rotation={135} />
      <Arrow x={120} y={120} rotation={-135} />
    </G>
  );
}

function LoopDiagram() {
  return (
    <G>
      <Path
        d="M120 40 H200 A40 40 0 0 1 200 120 H120 A40 40 0 0 1 120 40 Z"
        fill="none"
        stroke={colors.charcoal}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="2 12"
      />
      <Cone x={160} y={120} />
      <Arrow x={160} y={40} rotation={0} />
      <Arrow x={240} y={80} rotation={90} />
      <Arrow x={130} y={120} rotation={180} />
      <Arrow x={80} y={80} rotation={-90} />
      <CameraMarker transform="translate(160 92) rotate(180) scale(0.42)" />
    </G>
  );
}

function FigureEightDiagram() {
  return (
    <G>
      <RiderPath d="M160 80 A56 56 0 1 0 48 80 A56 56 0 1 0 160 80 A56 56 0 1 1 272 80 A56 56 0 1 1 160 80" />
      <Cone x={104} y={33} />
      <Cone x={57} y={80} />
      <Cone x={104} y={127} />
      <Cone x={142} y={82} />
      <Cone x={216} y={33} />
      <Cone x={263} y={80} />
      <Cone x={216} y={127} />
      <Arrow x={64} y={40} rotation={-45} />
      <Arrow x={144} y={120} rotation={135} />
      <Arrow x={144} y={40} rotation={45} />
      <Arrow x={176} y={40} rotation={135} />
      <Arrow x={256} y={40} rotation={-135} />
      <Arrow x={176} y={120} rotation={45} />
    </G>
  );
}

function StraightLineDiagram() {
  return (
    <G>
      <TrackSurface d="M20 60 H300 V100 H20 Z" />
      <RiderPath d="M20 80 H220" />
      <Cone x={220} y={80} />
      <Arrow x={80} y={80} rotation={0} />
      <Arrow x={140} y={80} rotation={0} />
      <Arrow x={260} y={80} rotation={180} />
      <Line x1={220} y1={55} x2={220} y2={105} stroke={coneOrange} strokeWidth="2" strokeDasharray="4 3" />
    </G>
  );
}

function DetailCone({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <Circle cx={x} cy={y} r="10.625" fill={coneOrange} />
      <Circle cx={x} cy={y} r="4.1" fill={colors.silver} />
    </G>
  );
}

function DetailArrow({ x, y, rotation }: { x: number; y: number; rotation: number }) {
  return <Polygon points="-10,-7 12,0 -10,7" fill={colors.charcoal} transform={`translate(${x} ${y}) rotate(${rotation})`} />;
}

function DimensionGuide({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colors.red} strokeDasharray="4 6" strokeLinecap="round" strokeOpacity="0.58" strokeWidth="1.5" />;
}

function DimensionMeasure({ d }: { d: string }) {
  return <Path d={d} fill="none" stroke={colors.red} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />;
}

function DimensionLabel({
  x,
  y,
  children,
  rotation,
  textAnchor = 'middle',
}: {
  x: number;
  y: number;
  children: string;
  rotation?: number;
  textAnchor?: 'start' | 'middle' | 'end';
}) {
  return (
    <SvgText
      x={x}
      y={y}
      fill={colors.red}
      fontFamily={fonts.body}
      fontSize="14"
      fontWeight="500"
      textAnchor={textAnchor}
      transform={rotation ? `rotate(${rotation} ${x} ${y})` : undefined}
    >
      {children}
    </SvgText>
  );
}

function DiagramBounds({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  return <Rect x={x} y={y} width={width} height={height} rx="6" fill="none" stroke={colors.silverDark} strokeDasharray="6 8" strokeWidth="1.5" />;
}

function CameraMarker({ transform }: { transform: string }) {
  return (
    <G transform={transform}>
      <Path d="M-22 -15 H-11 L-6 -23 H6 L11 -15 H22 V13 H-22 Z" fill={colors.charcoal} />
      <Circle cx="0" cy="-1" r="8" fill={colors.silver} />
      <Rect x="-17" y="-9" width="8" height="4" rx="2" fill={colors.silver} />
    </G>
  );
}

function CircleDetailDiagram() {
  const cones = [[320, 88], [385, 115], [412, 180], [385, 245], [320, 272], [255, 245], [228, 180], [255, 115]];
  const arrows = [[241, 101, -45], [399, 101, 45], [399, 259, 135], [241, 259, -135]];
  return (
    <G>
      <DiagramBounds x={106} y={56} width={416} height={378} />
      <Circle cx="320" cy="180" r="112" fill="none" stroke={colors.charcoal} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 12" />
      {cones.map(([x, y]) => <DetailCone key={`${x}-${y}`} x={x} y={y} />)}
      {arrows.map(([x, y, rotation]) => <DetailArrow key={`${x}-${y}`} x={x} y={y} rotation={rotation} />)}
      <DimensionGuide x1={320} y1={88} x2={150} y2={88} />
      <DimensionGuide x1={320} y1={272} x2={150} y2={272} />
      <DimensionMeasure d="M150 88 V272 M140 88 H160 M140 272 H160" />
      <DimensionLabel x={126} y={185} rotation={-90}>8m dia.</DimensionLabel>
      <DimensionGuide x1={320} y1={272} x2={470} y2={272} />
      <DimensionGuide x1={320} y1={410} x2={470} y2={410} />
      <DimensionMeasure d="M470 272 V410 M460 272 H480 M460 410 H480" />
      <DimensionLabel x={502} y={346} rotation={-90}>6m camera</DimensionLabel>
      <CameraMarker transform="translate(320 410)" />
    </G>
  );
}

function LoopDetailDiagram() {
  return (
    <G>
      <DiagramBounds x={140} y={60} width={370} height={340} />
      <Path
        d="M250 88 H390 A92 92 0 0 1 390 272 H250 A92 92 0 0 1 250 88 Z"
        fill="none"
        stroke={colors.charcoal}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="2 12"
      />
      <DetailCone x={320} y={272} />
      <DetailArrow x={320} y={88} rotation={0} />
      <DetailArrow x={482} y={180} rotation={90} />
      <DetailArrow x={280} y={272} rotation={180} />
      <DetailArrow x={158} y={180} rotation={-90} />
      <CameraMarker transform="translate(320 210) rotate(180)" />
      <DimensionGuide x1={390} y1={210} x2={460} y2={210} />
      <DimensionGuide x1={390} y1={272} x2={460} y2={272} />
      <DimensionMeasure d="M460 210 V272 M450 210 H470 M450 272 H470" />
      <DimensionLabel x={492} y={246} rotation={-90}>~8m camera</DimensionLabel>
    </G>
  );
}

function FigureEightDetailDiagram() {
  const cones = [[208, 88], [116, 180], [208, 272], [292, 184], [432, 88], [524, 180], [432, 272]];
  const arrows = [[129, 101, -45], [287, 259, 135], [287, 101, 45], [353, 101, 135], [511, 101, -135], [353, 259, 45]];
  return (
    <G>
      <Path d="M320 180 A112 112 0 1 0 96 180 A112 112 0 1 0 320 180 A112 112 0 1 1 544 180 A112 112 0 1 1 320 180" fill="none" stroke={colors.charcoal} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 12" />
      {cones.map(([x, y]) => <DetailCone key={`${x}-${y}`} x={x} y={y} />)}
      {arrows.map(([x, y, rotation]) => <DetailArrow key={`${x}-${y}`} x={x} y={y} rotation={rotation} />)}
      <DimensionGuide x1={208} y1={88} x2={74} y2={88} />
      <DimensionGuide x1={208} y1={272} x2={74} y2={272} />
      <DimensionMeasure d="M74 88 V272 M64 88 H84 M64 272 H84" />
      <DimensionLabel x={52} y={185} rotation={-90}>8m dia.</DimensionLabel>
      <DimensionGuide x1={292} y1={184} x2={360} y2={184} />
      <DimensionGuide x1={292} y1={324} x2={360} y2={324} />
      <DimensionMeasure d="M360 184 V324 M350 184 H370 M350 324 H370" />
      <DimensionLabel x={394} y={258} rotation={-90}>5m camera</DimensionLabel>
      <CameraMarker transform="translate(292 324)" />
    </G>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: 154,
    backgroundColor: colors.silver,
    borderColor: colors.silverMid,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  compact: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    height: 132,
  },
  detail: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    height: undefined,
    overflow: 'visible',
  },
});
