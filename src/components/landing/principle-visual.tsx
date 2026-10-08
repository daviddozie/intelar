import styles from "./landing-page.module.css";

export default function PrincipleVisual({ kind }: { kind: "sources" | "learning" | "peers" }) {
  return (
    <div className={styles.principleVisual} aria-hidden="true" data-ambient>
      <svg viewBox="0 0 280 200" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        {kind === "sources" && <>
          <g className={styles.sourceBack}><rect x="62" y="32" width="112" height="130" rx="9" /><path d="M80 58h54M80 71h72M80 84h59" /></g>
          <g className={styles.sourceFront}><rect x="92" y="48" width="112" height="130" rx="9" /><path d="M111 72h35M111 89h73M111 102h60M111 115h73M111 128h43" /><path className={styles.scanLine} d="M102 65h92" /><circle cx="188" cy="153" r="22" /><path className={styles.verifiedCheck} d="m177 153 7 7 14-15" /></g>
          <g className={styles.sourceSpark}><path d="M218 42v12M212 48h12M42 120v8M38 124h8" /></g>
        </>}
        {kind === "learning" && <>
          <path className={styles.learningTrail} d="M47 138h44c25 0 17-55 48-55h55c27 0 23-42 45-42" />
          <g className={styles.bookShape}><path d="M31 122c13-5 24-5 36 1v36c-12-6-23-6-36-1zM67 123c12-6 23-6 36-1v36c-13-5-24-5-36 1z" /><path d="M42 135h14M42 143h14M78 135h14M78 143h14" /></g>
          <g className={styles.learningStep}><circle cx="142" cy="83" r="19" /><path d="m135 83 5 5 9-10" /></g>
          <g className={styles.learningGoal}><circle cx="239" cy="41" r="21" /><path d="m239 29 3 8 9 1-7 5 2 9-7-5-7 5 2-9-7-5 9-1z" /></g>
          <circle className={styles.pathParticle} cx="113" cy="119" r="3" fill="currentColor" stroke="none" />
          <path d="M128 112h48M128 124h35M128 136h55" className={styles.lessonLines} />
        </>}
        {kind === "peers" && <>
          <path className={styles.peerConnections} d="m72 54 68 50 68-50M72 54v96l68-46 68 46V54" />
          <g className={styles.peerHub}><rect x="115" y="79" width="50" height="50" rx="14" /><path d="M126 93h5v23h-5zM136 116v-13a7 7 0 0 1 14 0v13h-4v-13a3 3 0 0 0-6 0v13z" fill="currentColor" stroke="none" /></g>
          {[[72,54],[208,54],[72,150],[208,150]].map(([x,y], index) => <g key={index} className={styles.peerNode} style={{animationDelay: `${index * -1.5}s`}}><circle cx={x} cy={y} r="22" /><circle cx={x} cy={y-5} r="6" /><path d={`M${x-11} ${y+12}c0-13 22-13 22 0`} /></g>)}
          <circle className={styles.peerSignal} cx="105" cy="79" r="3" fill="currentColor" stroke="none" />
        </>}
      </svg>
    </div>
  );
}
