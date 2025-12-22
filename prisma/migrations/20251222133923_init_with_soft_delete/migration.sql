-- AlterTable
ALTER TABLE "CertificateDocument" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ControlRegister" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "CertificateDocument_isDeleted_idx" ON "CertificateDocument"("isDeleted");

-- CreateIndex
CREATE INDEX "ControlRegister_isDeleted_idx" ON "ControlRegister"("isDeleted");
