-- CreateEnum
CREATE TYPE "CertificateType" AS ENUM ('C_MATRICULACION', 'SEGURO', 'RTO', 'TACOGRAFO');

-- CreateTable
CREATE TABLE "CertificateDocument" (
    "id" SERIAL NOT NULL,
    "controlId" INTEGER NOT NULL,
    "certificateType" "CertificateType" NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "description" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificateDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CertificateDocument_controlId_certificateType_idx" ON "CertificateDocument"("controlId", "certificateType");

-- CreateIndex
CREATE INDEX "CertificateDocument_controlId_certificateNumber_idx" ON "CertificateDocument"("controlId", "certificateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateDocument_controlId_certificateType_key" ON "CertificateDocument"("controlId", "certificateType");

-- AddForeignKey
ALTER TABLE "CertificateDocument" ADD CONSTRAINT "CertificateDocument_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "ControlRegister"("id") ON DELETE CASCADE ON UPDATE CASCADE;
