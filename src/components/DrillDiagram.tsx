import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Polygon, Rect } from 'react-native-svg';
import { colors } from '../theme';
import type { DiagramKey } from '../types';

type Props = {
  type: DiagramKey;
  compact?: boolean;
};

const W = 320;
const H = 160;
const coneOrange = '#FF7A00';

export function DrillDiagram({ type, compact }: Props) {
  return (
    <View style={[styles.frame, compact && styles.compact]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
        <Frame />
        {type === 'circle' && <CircleDiagram />}
        {type === 'figure-eight' && <FigureEightDiagram />}
        {type === 'hairpin' && <HairpinDiagram />}
        {type === 'l-turn' && <LTurnDiagram />}
      </Svg>
    </View>
  );
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
});
