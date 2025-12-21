-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserConfig" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "pdfGenerate" BOOLEAN NOT NULL DEFAULT false,
    "showAllRegistries" BOOLEAN NOT NULL DEFAULT false,
    "cacheRegistries" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControlRegister" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "agente" TEXT NOT NULL,
    "fecha" TIMESTAMP(3),
    "lugar" TEXT NOT NULL,
    "conductor_nombre" TEXT NOT NULL,
    "licencia_tipo" TEXT NOT NULL,
    "licencia_numero" TEXT NOT NULL,
    "licencia_vencimiento" TIMESTAMP(3),
    "empresa_select" TEXT NOT NULL,
    "dominio" TEXT NOT NULL,
    "interno" TEXT,
    "c_matriculacion_venc" TIMESTAMP(3),
    "c_matriculacion_cert" TEXT,
    "seguro_venc" TIMESTAMP(3),
    "seguro_cert" TEXT,
    "rto_venc" TIMESTAMP(3),
    "rto_cert" TEXT,
    "tacografo_venc" TIMESTAMP(3),
    "tacografo_cert" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ControlRegister_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserConfig_userId_key" ON "UserConfig"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ControlRegister_userId_key" ON "ControlRegister"("userId");

-- AddForeignKey
ALTER TABLE "UserConfig" ADD CONSTRAINT "UserConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlRegister" ADD CONSTRAINT "ControlRegister_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
