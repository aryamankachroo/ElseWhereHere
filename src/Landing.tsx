import { useState } from "react";

const LEAVE_MS = 1100;
const STAR_COUNT = 22;

function windows(
  x: number,
  y: number,
  w: number,
  h: number,
  cols: number,
  rows: number,
) {
  const cells = [];
  const gapX = w / (cols + 1);
  const gapY = h / (rows + 1);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if ((r * 3 + c) % 4 === 0) continue;
      cells.push(
        <rect
          key={`${x}-${y}-${r}-${c}`}
          x={x + gapX * (c + 0.55)}
          y={y + gapY * (r + 0.45)}
          width={2.2}
          height={3.4}
        />,
      );
    }
  }
  return cells;
}

function SkylineSilhouette() {
  return (
    <div className="skyline" aria-hidden="true">
      <div className="skyline-glow" />
      <svg
        className="skyline-art"
        viewBox="0 0 1440 480"
        preserveAspectRatio="xMidYMax meet"
      >
        <g className="skyline-back">
          <rect x="20" y="210" width="28" height="270" />
          <rect x="250" y="168" width="24" height="312" />
          <rect x="430" y="292" width="36" height="188" />
          <rect x="980" y="300" width="32" height="180" />
          <rect x="1160" y="176" width="26" height="304" />
          <rect x="1388" y="230" width="30" height="250" />
        </g>
        <g className="skyline-front">
          <rect x="0" y="300" width="40" height="180" />
          <rect x="36" y="188" width="22" height="292" />
          <polygon points="70,48 126,48 138,480 58,480" />
          <polygon points="88,48 98,4 108,4 116,48" />
          <line className="skyline-spire" x1="98" y1="4" x2="98" y2="0" />
          <rect x="132" y="128" width="22" height="352" />
          <rect x="152" y="196" width="34" height="284" />
          <rect x="184" y="96" width="24" height="384" />
          <rect x="206" y="168" width="40" height="312" />
          <rect x="244" y="240" width="28" height="240" />
          <rect x="270" y="118" width="20" height="362" />
          <rect x="288" y="204" width="36" height="276" />
          <rect x="322" y="86" width="22" height="394" />
          <rect x="460" y="328" width="28" height="152" />
          <rect x="486" y="300" width="22" height="180" />
          <rect x="506" y="338" width="36" height="142" />
          <rect x="540" y="312" width="24" height="168" />
          <rect x="562" y="348" width="40" height="132" />
          <rect x="600" y="320" width="26" height="160" />
          <rect x="624" y="342" width="34" height="138" />
          <rect x="656" y="308" width="20" height="172" />
          <rect x="674" y="334" width="38" height="146" />
          <rect x="710" y="318" width="24" height="162" />
          <rect x="732" y="350" width="42" height="130" />
          <rect x="772" y="304" width="22" height="176" />
          <rect x="792" y="336" width="32" height="144" />
          <rect x="822" y="318" width="26" height="162" />
          <rect x="846" y="344" width="36" height="136" />
          <polygon points="980,138 1072,138 1072,480 980,480" />
          <polygon points="994,78 1058,78 1058,138 994,138" />
          <polygon points="1008,40 1044,40 1044,78 1008,78" />
          <rect x="1020" y="16" width="12" height="24" />
          <line className="skyline-spire" x1="1026" y1="16" x2="1026" y2="0" />
          <rect x="1070" y="188" width="24" height="292" />
          <polygon points="1100,122 1164,122 1164,480 1100,480" />
          <polygon points="1110,84 1154,84 1154,122 1110,122" />
          <polygon points="1120,56 1144,56 1148,84 1116,84" />
          <polygon points="1126,32 1138,32 1142,56 1122,56" />
          <line className="skyline-spire" x1="1132" y1="32" x2="1132" y2="8" />
          <rect x="1162" y="156" width="30" height="324" />
          <rect x="1190" y="92" width="20" height="388" />
          <rect x="1208" y="200" width="40" height="280" />
          <rect x="1246" y="110" width="24" height="370" />
          <rect x="1268" y="176" width="36" height="304" />
          <rect x="1302" y="74" width="20" height="406" />
          <rect x="1320" y="214" width="44" height="266" />
          <rect x="1362" y="128" width="22" height="352" />
          <rect x="1382" y="248" width="58" height="232" />
        </g>
        <g className="skyline-windows">
          {windows(70, 60, 56, 390, 4, 18)}
          {windows(184, 110, 22, 350, 2, 16)}
          {windows(322, 100, 20, 360, 2, 16)}
          {windows(994, 88, 60, 360, 4, 16)}
          {windows(1110, 94, 46, 360, 3, 16)}
          {windows(1190, 108, 18, 350, 2, 16)}
          {windows(1302, 90, 18, 360, 2, 16)}
        </g>
      </svg>
    </div>
  );
}

export function SparkleField() {
  return (
    <div className="sparkle-layer" aria-hidden="true">
      <div className="landing-sheen" />
      <div className="landing-stars">
        {Array.from({ length: STAR_COUNT }, (_, i) => (
          <span
            key={i}
            className={`landing-star landing-star-${i + 1}${i >= 18 ? " landing-star-flare" : ""}`}
          />
        ))}
      </div>
      <SkylineSilhouette />
    </div>
  );
}

export default function Landing({
  onBegin,
  ready,
  error,
}: {
  onBegin: () => void;
  ready: boolean;
  error: string | null;
}) {
  const [leaving, setLeaving] = useState(false);

  function begin() {
    if (leaving || !ready) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      onBegin();
      return;
    }
    setLeaving(true);
    window.setTimeout(onBegin, LEAVE_MS);
  }

  return (
    <div className={leaving ? "landing is-leaving" : "landing"}>
      <div className="landing-flash" aria-hidden="true" />
      <div className="landing-inner">
        <p className="landing-kicker">Know Your City</p>
        <h1 className="landing-title">
          <span className="landing-word">Elsewhere</span>
          <span className="landing-comma">,</span>
          <span className="landing-word landing-word-two">Here</span>
        </h1>
        <span className="landing-rule" aria-hidden="true" />
        <p className="landing-lede">
          Name a place you miss. Meet an NYC neighborhood that shares a feeling
          — and stays itself.
        </p>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : (
          <button
            type="button"
            className="primary landing-begin"
            onClick={begin}
            disabled={!ready || leaving}
          >
            {ready ? "Begin" : "Loading…"}
          </button>
        )}
      </div>
    </div>
  );
}
