"use client";

export function PrintReceiptButton() {
  return (
    <button
      className="print:hidden min-h-11 rounded-md bg-brand-green px-5 py-3 text-sm font-black text-white"
      onClick={() => window.print()}
      type="button"
    >
      Imprimir
    </button>
  );
}
