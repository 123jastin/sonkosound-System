import { FileText } from 'lucide-react';

interface InvoiceProps {
  userRole?: 'admin' | 'staff' | 'cashier' | null;
}

// Placeholder — replace with the full invoice creator system
export default function Invoice({ userRole }: InvoiceProps) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3 shadow-sm">
      <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center mx-auto shadow-md">
        <FileText size={26} className="text-white" />
      </div>
      <h2 className="text-lg font-extrabold text-slate-800">Invoice</h2>
      <p className="text-xs text-slate-400">
        Mfumo wa kutengeneza Invoice unakuja hivi karibuni. ({userRole})
      </p>
    </div>
  );
}
