export default function PageStub({
  title,
  desc,
  step,
}: {
  title: string;
  desc: string;
  step: string;
}) {
  return (
    <div>
      <div className="card p-5 mb-4 flex items-center justify-between">
        <div>
          <div className="text-[15px] font-medium text-ink-primary">{title}</div>
          <div className="text-[13px] text-ink-secondary mt-1">{desc}</div>
        </div>
        <span className="chip font-medium">{step}</span>
      </div>
      <div className="card p-12 flex flex-col items-center justify-center text-ink-tertiary min-h-[400px]">
        <div className="text-sm">页面骨架已就位，等待后续步骤填充功能</div>
      </div>
    </div>
  );
}
