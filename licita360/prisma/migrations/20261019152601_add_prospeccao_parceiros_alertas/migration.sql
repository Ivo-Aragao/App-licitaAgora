-- CreateTable
CREATE TABLE "ProspectingSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "recipientEmail" TEXT,
    "dailyEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "documentAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "partnerAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ufs" TEXT[] DEFAULT ARRAY['CE']::TEXT[],
    "modalities" TEXT[] DEFAULT ARRAY['8']::TEXT[],
    "daysAhead" INTEGER NOT NULL DEFAULT 30,
    "minAmount" DECIMAL(14,2),
    "maxAmount" DECIMAL(14,2),
    "documentAlertDays" INTEGER[] DEFAULT ARRAY[30, 15, 7, 1, 0]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerCompany" (
    "id" TEXT NOT NULL,
    "ownerCompanyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cnpj" TEXT,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "uf" TEXT NOT NULL DEFAULT 'CE',
    "cities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minimumAmount" DECIMAL(14,2),
    "maximumAmount" DECIMAL(14,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notifyOpportunities" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerBranch" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "PartnerBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveredOpportunity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "pncpId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "unit" TEXT,
    "city" TEXT,
    "uf" TEXT,
    "modality" TEXT NOT NULL,
    "amount" DECIMAL(14,2),
    "deadline" TIMESTAMP(3),
    "url" TEXT,
    "raw" JSONB,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveredOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerOpportunityMatch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "discoveryId" TEXT NOT NULL,
    "matchedBranches" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reason" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerOpportunityMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProspectingSettings_companyId_key" ON "ProspectingSettings"("companyId");

-- CreateIndex
CREATE INDEX "PartnerCompany_ownerCompanyId_active_idx" ON "PartnerCompany"("ownerCompanyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerCompany_ownerCompanyId_cnpj_key" ON "PartnerCompany"("ownerCompanyId", "cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerBranch_partnerId_name_key" ON "PartnerBranch"("partnerId", "name");

-- CreateIndex
CREATE INDEX "DiscoveredOpportunity_companyId_firstSeenAt_idx" ON "DiscoveredOpportunity"("companyId", "firstSeenAt");

-- CreateIndex
CREATE INDEX "DiscoveredOpportunity_deadline_idx" ON "DiscoveredOpportunity"("deadline");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveredOpportunity_companyId_pncpId_key" ON "DiscoveredOpportunity"("companyId", "pncpId");

-- CreateIndex
CREATE INDEX "PartnerOpportunityMatch_companyId_createdAt_idx" ON "PartnerOpportunityMatch"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "PartnerOpportunityMatch_partnerId_notifiedAt_idx" ON "PartnerOpportunityMatch"("partnerId", "notifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerOpportunityMatch_partnerId_discoveryId_key" ON "PartnerOpportunityMatch"("partnerId", "discoveryId");

-- CreateIndex
CREATE INDEX "NotificationLog_companyId_type_createdAt_idx" ON "NotificationLog"("companyId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_companyId_dedupeKey_key" ON "NotificationLog"("companyId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "ProspectingSettings" ADD CONSTRAINT "ProspectingSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCompany" ADD CONSTRAINT "PartnerCompany_ownerCompanyId_fkey" FOREIGN KEY ("ownerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerBranch" ADD CONSTRAINT "PartnerBranch_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveredOpportunity" ADD CONSTRAINT "DiscoveredOpportunity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOpportunityMatch" ADD CONSTRAINT "PartnerOpportunityMatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOpportunityMatch" ADD CONSTRAINT "PartnerOpportunityMatch_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "PartnerCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerOpportunityMatch" ADD CONSTRAINT "PartnerOpportunityMatch_discoveryId_fkey" FOREIGN KEY ("discoveryId") REFERENCES "DiscoveredOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
