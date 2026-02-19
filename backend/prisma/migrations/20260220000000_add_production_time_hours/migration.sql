-- Add production time in hours for products and make printTime optional in input layer via DB default.
ALTER TABLE "Product"
ADD COLUMN "productionTimeHours" INTEGER DEFAULT 24;

ALTER TABLE "Product"
ALTER COLUMN "printTime" SET DEFAULT '24 часа';
