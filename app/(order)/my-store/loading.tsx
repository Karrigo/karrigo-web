/** Panel-shaped placeholders, so a slow 3G load holds the layout still. */
export default function Loading() {
  return (
    <div className="gap-lg flex flex-col" aria-busy="true" aria-label="Loading">
      <div className="bg-bg/60 rounded-panel-sm h-[120px] animate-pulse" />
      <div className="bg-bg/60 rounded-panel-sm h-[220px] animate-pulse" />
    </div>
  );
}
