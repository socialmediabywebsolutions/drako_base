export default function AIChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex flex-col bg-[#030312] lg:left-64">
      {children}
    </div>
  );
}
