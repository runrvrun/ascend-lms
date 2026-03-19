-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "ext_expires_in" INTEGER;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
