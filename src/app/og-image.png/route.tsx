import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export function GET() {
    return new ImageResponse(
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "70px 80px", background: "#0a0a0a", color: "#fafafa", fontFamily: "sans-serif" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 22, fontSize: 42 }}>
                <svg viewBox="0 0 524 445" width="62" height="54" fill="#fafafa"><path d="M5 0H23C75 0 119 44 119 96V440Q119 445 114 445H96C43 445 0 402 0 349V5Q0 0 5 0Z" /><path d="M149 223C149 123 232 47 334 47C437 47 524 126 524 223V440Q524 445 519 445H473C439 445 413 419 413 386V219C413 176 379 146 334 146C289 146 255 176 255 219V440Q255 445 250 445H204C173 445 149 423 149 392Z" /></svg>
                Intelar
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                <div style={{ display: "flex", flexDirection: "column", fontSize: 72, lineHeight: 1.12, letterSpacing: -3 }}><span>Follow the question.</span><span>Build understanding.</span></div>
                <div style={{ fontSize: 28, color: "#a3a3a3" }}>Cited research · Personal learning · Shared workspaces</div>
            </div>
            <div style={{ display: "flex", fontSize: 22, color: "#a3a3a3", borderTop: "1px solid #333", paddingTop: 24 }}>Research. Learn. Think together.</div>
        </div>,
        { width: 1200, height: 630 }
    );
}
