export default function LoadingNewPayment() {
  return (
    <div className="grid animate-pulse gap-6" role="status">
      <span className="sr-only">Cargando registro de pago...</span>
      <div className="h-40 rounded-lg border border-charcoal bg-gray-light" />
      <div className="h-72 rounded-lg border border-charcoal bg-paper" />
    </div>
  );
}