/*
  Warnings:

  - Added the required column `fileSize` to the `CertificateDocument` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CertificateDocument" ADD COLUMN     "fileSize" TEXT NOT NULL;
