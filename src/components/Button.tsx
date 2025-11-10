export function Button({ children, onClick }: { children: React.ReactNode, onClick: () => void }) {
  return <button onClick={onClick} className="bg-black text-white px-4 py-2 border border-neutral-700 hover:border-neutral-300 active:bg-neutral-800 transition-colors duration-200 rounded-md">{children}</button>;
}