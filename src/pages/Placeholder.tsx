export default function Placeholder({ title, phase }: { title: string; phase?: number }) {
  return (
    <main className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      {phase && <p className="mt-2 text-sm text-slate-500">Se implementa en la fase {phase}.</p>}
    </main>
  );
}
