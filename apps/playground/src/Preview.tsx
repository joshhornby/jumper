import { useCallback, useEffect, useRef, useState } from "react";

type PreviewProps = { svg: string | null; width: number; height: number; fitSignal: number };

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;

function clamp(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function Preview({ svg, width, height, fitSignal }: PreviewProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  const fit = useCallback(() => {
    const element = viewport.current;
    if (element === null || width === 0) return;
    setZoom(clamp(Math.min((element.clientWidth - 32) / width, 1)));
  }, [width]);

  // Fit on first draw and when a new example or share link loads, not on every keystroke.
  const fitted = useRef(false);
  useEffect(() => {
    if (svg !== null && !fitted.current) {
      fitted.current = true;
      fit();
    }
  }, [svg, fit]);
  useEffect(() => {
    if (fitSignal > 0) fit();
  }, [fitSignal, fit]);

  return (
    <div className="preview">
      <fieldset className="zoom" aria-label="Zoom">
        <button type="button" onClick={() => setZoom((value) => clamp(value / 1.2))} aria-label="Zoom out">
          −
        </button>
        <span className="zoom-level">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((value) => clamp(value * 1.2))} aria-label="Zoom in">
          +
        </button>
        <button type="button" onClick={fit}>
          Fit
        </button>
        <button type="button" onClick={() => setZoom(1)}>
          100%
        </button>
      </fieldset>
      <div className="viewport" ref={viewport}>
        {svg === null ? (
          <p className="empty">Nothing to draw yet.</p>
        ) : (
          <div
            className="paper"
            style={{ width: width * zoom, height: height * zoom }}
            // The SVG comes from the Jumper renderer, which escapes all source text.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
      </div>
    </div>
  );
}
