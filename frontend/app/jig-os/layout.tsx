export const metadata = {
  title: 'JIG-OS — Ringi-Flow & Citation Engine · Nishi Link',
  description: 'Japan-India Gateway OS, Module 2: generate Honsha-ready Ringi-sho with statutory citations, nemawashi readiness and friction scoring.',
};

export default function JigOsLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#f3f1ec]">{children}</div>;
}
