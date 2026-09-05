ALTER TABLE "Invoice" ADD COLUMN "publicLinkExpiresAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN "publicLinkRevokedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "reconciledAt" TIMESTAMP(3);

CREATE TABLE "InvoiceRevision" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvoiceRevision_invoiceId_version_key" ON "InvoiceRevision"("invoiceId", "version");
CREATE INDEX "InvoiceRevision_invoiceId_createdAt_idx" ON "InvoiceRevision"("invoiceId", "createdAt");
CREATE UNIQUE INDEX "Payment_upi_reference_unique" ON "Payment"("referenceId") WHERE "method" = 'UPI' AND "referenceId" IS NOT NULL;

ALTER TABLE "InvoiceRevision" ADD CONSTRAINT "InvoiceRevision_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
