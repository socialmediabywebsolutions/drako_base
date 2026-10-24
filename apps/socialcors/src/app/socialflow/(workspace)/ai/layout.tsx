export default function AIChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex flex-col bg-white lg:left-64">
      {children}
    </div>
  );
}
