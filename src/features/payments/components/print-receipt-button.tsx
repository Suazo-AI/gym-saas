"use client";

export function PrintReceiptButton() {
  return (
    <button
      className="btn btn-secondary print:hidden"
      onClick={() => window.print()}
      type="button"
    >
      Imprimir
    </button>
  );
}
