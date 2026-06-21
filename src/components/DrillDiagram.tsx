import { StyleSheet, View } from 'react-native';
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

export function DrillDiagram({ type, compact, variant = 'card' }: Props) {
  const isDetail = variant === 'detail';
  return (
    <View style={[styles.frame, compact && styles.compact, isDetail && styles.detail]}>
      <Svg width="100%" height="100%" viewBox={isDetail ? '0 0 640 500' : `0 0 ${W} ${H}`}>
        {isDetail ? <DetailFrame /> : <Frame />}
        {!isDetail && type === 'circle' && <CircleDiagram />}
        {!isDetail && type === 'figure-eight' && <FigureEightDiagram />}
        {!isDetail && type === 'hairpin' && <HairpinDiagram />}
        {!isDetail && type === 'l-turn' && <LTurnDiagram />}
        {isDetail && type === 'circle' && <CircleDetailDiagram />}
        {isDetail && type === 'figure-eight' && <FigureEightDetailDiagram />}
        {isDetail && type === 'hairpin' && <HairpinDetailDiagram />}
        {isDetail && type === 'l-turn' && <LTurnDetailDiagram />}
      </Svg>
    </View>
  );
}

function DetailFrame() {
  return <Rect x="1" y="1" width="638" height="498" rx="8" fill={colors.silver} stroke={colors.silverMid} strokeWidth="1" />;
}

function Frame() {
  return (
    <Rect x="1" y="1" width={W - 2} height={H - 2} rx="8" fill={colors.silver} stroke={colors.silverMid} strokeWidth="1" />
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

function HairpinDiagram() {
  return (
    <G>
      <TrackSurface d="M34 29 H171 A60 60 0 0 1 171 149 H52 V121 H171 A32 32 0 0 0 171 57 H34 Z" />
      <RiderPath d="M34 36 C124 36 191 34 203 84 C214 130 148 139 52 139" />
      <Cone x={79} y={29} />
      <Cone x={171} y={29} />
      <Cone x={231} y={89} />
      <Cone x={171} y={149} />
      <Cone x={79} y={149} />
      <Cone x={79} y={57} />
      <Cone x={171} y={57} />
      <Cone x={203} y={89} />
      <Cone x={171} y={121} />
      <Cone x={79} y={121} />
      <Arrow x={104} y={36} rotation={0} />
      <Arrow x={202} y={103} rotation={112} />
      <Arrow x={102} y={139} rotation={180} />
    </G>
  );
}

function LTurnDiagram() {
  return (
    <G>
      <TrackSurface d="M70 150 V88 A70 70 0 0 1 140 18 H288 V46 H140 A42 42 0 0 0 98 88 V150 Z" />
      <RiderPath d="M76 150 C76 110 76 94 86 88 C98 60 114 45 128 39 C170 24 224 22 288 25" />
      <Cone x={70} y={136} />
      <Cone x={98} y={136} />
      <Cone x={70} y={88} />
      <Cone x={98} y={88} />
      <Cone x={91} y={39} />
      <Cone x={110} y={58} />
      <Cone x={140} y={18} />
      <Cone x={140} y={46} />
      <Cone x={260} y={18} />
      <Cone x={260} y={46} />
      <Arrow x={76} y={116} rotation={-90} />
      <Arrow x={112} y={50} rotation={-38} />
      <Arrow x={222} y={24} rotation={0} />
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
      <Circle cx="320" cy="180" r="112" fill="none" stroke={colors.charcoal} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 12" />
      {cones.map(([x, y]) => <DetailCone key={`${x}-${y}`} x={x} y={y} />)}
      {arrows.map(([x, y, rotation]) => <DetailArrow key={`${x}-${y}`} x={x} y={y} rotation={rotation} />)}
      <DimensionGuide x1={320} y1={88} x2={150} y2={88} />
      <DimensionGuide x1={320} y1={272} x2={150} y2={272} />
      <DimensionMeasure d="M150 88 V272 M140 88 H160 M140 272 H160" />
      <DimensionLabel x={52} y={185} rotation={-90}>8m dia.</DimensionLabel>
      <DimensionGuide x1={320} y1={272} x2={470} y2={272} />
      <DimensionGuide x1={320} y1={410} x2={470} y2={410} />
      <DimensionMeasure d="M470 272 V410 M460 272 H480 M460 410 H480" />
      <DimensionLabel x={502} y={346} rotation={-90}>6m camera</DimensionLabel>
      <CameraMarker transform="translate(320 410)" />
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

function HairpinDetailDiagram() {
  const cones = [[160, 86], [344, 86], [464, 206], [344, 326], [160, 326], [160, 142], [344, 142], [408, 206], [344, 270], [160, 270]];
  return (
    <G>
      <Path d="M70 86 H344 A120 120 0 0 1 344 326 H106 V270 H344 A64 64 0 0 0 344 142 H70 Z" fill={colors.silverMid} fillOpacity="0.48" stroke={colors.charcoal} strokeOpacity="0.2" strokeWidth="1.5" />
      <Path d="M70 100 C250 100 384 96 408 196 C430 288 298 306 106 306" fill="none" stroke={colors.charcoal} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 12" />
      {cones.map(([x, y]) => <DetailCone key={`${x}-${y}`} x={x} y={y} />)}
      <DetailArrow x={210} y={100} rotation={0} />
      <DetailArrow x={406} y={234} rotation={112} />
      <DetailArrow x={206} y={306} rotation={180} />
      <DimensionGuide x1={160} y1={142} x2={160} y2={50} />
      <DimensionGuide x1={344} y1={142} x2={344} y2={50} />
      <DimensionMeasure d="M160 50 H344 M160 40 V60 M344 40 V60" />
      <DimensionLabel x={252} y={34}>12m brake</DimensionLabel>
      <DimensionGuide x1={160} y1={86} x2={82} y2={86} />
      <DimensionGuide x1={160} y1={142} x2={82} y2={142} />
      <DimensionMeasure d="M82 86 V142 M72 86 H92 M72 142 H92" />
      <DimensionLabel x={62} y={118} rotation={-90}>3m entry lane</DimensionLabel>
      <DimensionLabel x={160} y={166}>start</DimensionLabel>
      <DimensionGuide x1={344} y1={142} x2={344} y2={246} />
      <DimensionGuide x1={408} y1={206} x2={408} y2={246} />
      <DimensionMeasure d="M344 246 H408 M344 236 V256 M408 236 V256" />
      <DimensionLabel x={320} y={251} textAnchor="end">4m horizontal</DimensionLabel>
      <DimensionGuide x1={344} y1={142} x2={520} y2={142} />
      <DimensionGuide x1={408} y1={206} x2={520} y2={206} />
      <DimensionMeasure d="M520 142 V206 M510 142 H530 M510 206 H530" />
      <DimensionLabel x={548} y={179} rotation={-90}>4m vertical</DimensionLabel>
      <DimensionGuide x1={160} y1={270} x2={82} y2={270} />
      <DimensionGuide x1={160} y1={326} x2={82} y2={326} />
      <DimensionMeasure d="M82 270 V326 M72 270 H92 M72 326 H92" />
      <DimensionLabel x={62} y={298} rotation={-90}>3m exit lane</DimensionLabel>
      <DimensionGuide x1={344} y1={326} x2={344} y2={362} />
      <DimensionGuide x1={160} y1={326} x2={160} y2={362} />
      <DimensionMeasure d="M160 362 H344 M160 352 V372 M344 352 V372" />
      <DimensionLabel x={252} y={386}>12m exit</DimensionLabel>
      <DimensionGuide x1={160} y1={326} x2={126} y2={326} />
      <DimensionGuide x1={160} y1={458} x2={126} y2={458} />
      <DimensionMeasure d="M126 326 V458 M116 326 H136 M116 458 H136" />
      <DimensionLabel x={106} y={392} rotation={-90}>6m camera</DimensionLabel>
      <CameraMarker transform="translate(160 458)" />
    </G>
  );
}

function LTurnDetailDiagram() {
  const cones = [[140, 380], [196, 380], [140, 176], [196, 176], [181, 77], [221, 117], [280, 36], [280, 92], [500, 36], [500, 92]];
  return (
    <G>
      <Path d="M140 420 V176 A140 140 0 0 1 280 36 H548 V92 H280 A84 84 0 0 0 196 176 V420 Z" fill={colors.silverMid} fillOpacity="0.48" stroke={colors.charcoal} strokeOpacity="0.2" strokeWidth="1.5" />
      <Path d="M152 420 C152 300 152 212 172 176 C196 120 228 90 256 78 C340 48 448 44 548 50" fill="none" stroke={colors.charcoal} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 12" />
      {cones.map(([x, y]) => <DetailCone key={`${x}-${y}`} x={x} y={y} />)}
      <DetailArrow x={152} y={300} rotation={-90} />
      <DetailArrow x={224} y={96} rotation={-38} />
      <DetailArrow x={420} y={49} rotation={0} />
      <DimensionGuide x1={140} y1={380} x2={140} y2={432} />
      <DimensionGuide x1={196} y1={380} x2={196} y2={432} />
      <DimensionMeasure d="M140 432 H196 M140 422 V442 M196 422 V442" />
      <DimensionLabel x={168} y={456}>3m start gate</DimensionLabel>
      <DimensionGuide x1={140} y1={380} x2={104} y2={380} />
      <DimensionGuide x1={140} y1={176} x2={104} y2={176} />
      <DimensionMeasure d="M104 176 V380 M94 176 H114 M94 380 H114" />
      <DimensionLabel x={84} y={278} rotation={-90}>12m approach</DimensionLabel>
      <DimensionGuide x1={500} y1={36} x2={570} y2={36} />
      <DimensionGuide x1={500} y1={92} x2={570} y2={92} />
      <DimensionMeasure d="M570 36 V92 M560 36 H580 M560 92 H580" />
      <DimensionLabel x={596} y={64} rotation={-90}>3m exit gate</DimensionLabel>
      <DimensionGuide x1={280} y1={92} x2={280} y2={124} />
      <DimensionGuide x1={500} y1={92} x2={500} y2={124} />
      <DimensionMeasure d="M280 124 H500 M280 114 V134 M500 114 V134" />
      <DimensionLabel x={390} y={148}>12m exit</DimensionLabel>
      <DimensionGuide x1={140} y1={176} x2={140} y2={154} />
      <DimensionGuide x1={280} y1={176} x2={280} y2={154} />
      <DimensionMeasure d="M140 154 H280 M140 144 V164 M280 144 V164" />
      <DimensionLabel x={128} y={150} textAnchor="end">7.5m radius</DimensionLabel>
      <DimensionGuide x1={140} y1={380} x2={500} y2={380} />
      <DimensionGuide x1={500} y1={92} x2={500} y2={380} />
      <DimensionLabel x={320} y={370}>19.5m camera line</DimensionLabel>
      <CameraMarker transform="translate(500 380) rotate(-45)" />
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
    height: 132,
  },
  detail: {
    aspectRatio: 1.28,
    height: undefined,
  },
});
