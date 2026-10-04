-- CreateTable
CREATE TABLE "mentions" (
    "id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "mentioned_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mentions_mentioned_id_idx" ON "mentions"("mentioned_id");

-- CreateIndex
CREATE UNIQUE INDEX "mentions_comment_id_mentioned_id_key" ON "mentions"("comment_id", "mentioned_id");

-- AddForeignKey
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_mentioned_id_fkey" FOREIGN KEY ("mentioned_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
