import type {Bill} from "@/lib/model";
import {paymentStatusLabel,settlementFor} from "@/lib/invoice-settlement";
const amount=(n:number)=>`Rs. ${n.toLocaleString("en-PK",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export function InvoicePaymentBadge({bill}:{bill:Bill}){const payment=settlementFor(bill);return <span className="invoice-payment-badge" data-status={payment.status}>{paymentStatusLabel[payment.status]}</span>}
export default function InvoicePaymentSummary({bill}:{bill:Bill}){
 const payment=settlementFor(bill);
 return <div className="invoice-payment-summary"><div className="invoice-payment-summary-heading"><strong>Payment</strong><InvoicePaymentBadge bill={bill}/></div><dl><div><dt>Cash received</dt><dd>{amount(payment.cash)}</dd></div><div><dt>Bank received</dt><dd>{amount(payment.bank)}</dd></div>{payment.other>0&&<div><dt>Other / legacy receipts</dt><dd>{amount(payment.other)}</dd></div>}<div><dt>Total received</dt><dd>{amount(payment.received)}</dd></div><div className="invoice-payment-remaining"><dt>Remaining credit</dt><dd>{amount(payment.remaining)}</dd></div></dl></div>
}
